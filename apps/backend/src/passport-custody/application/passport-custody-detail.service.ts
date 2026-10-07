import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { PASSPORT_CUSTODY_LABEL_DECRYPTOR, type CustodyPassportSummary, type PassportCustodyLabelDecryptor } from './passport-custody-query.service.js';
import { mapPassportCustodyHistory, type CustodyCreationMilestone, type CustodyHistoryEntry } from './passport-custody-history.mapper.js';

export type SafeCustodyLink = Readonly<{ id: string; maskedReference: string; displayLabel?: string; status: string; available: boolean }>;
export type CustodyPassportDetail = CustodyPassportSummary & Readonly<{
  originRequest: SafeCustodyLink;
  linkedDossier: SafeCustodyLink;
  history: readonly CustodyHistoryEntry[];
  creationMilestone: CustodyCreationMilestone;
}>;

@Injectable()
export class PassportCustodyDetailService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASSPORT_CUSTODY_LABEL_DECRYPTOR) private readonly labels: PassportCustodyLabelDecryptor,
  ) {}

  async get(passportId: string): Promise<Readonly<{ outcome: 'found'; detail: CustodyPassportDetail }> | Readonly<{ outcome: 'not-found' }> | Readonly<{ outcome: 'unavailable' }>> {
    try {
      const passport = await this.prisma.playerPassport.findFirst({
        where: { id: passportId, state: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT' },
        select: {
          id: true, playerId: true, state: true, enrichmentStatus: true, createdAt: true,
          player: { select: { privateIdentity: { select: { encryptedLegalName: true } } } },
          originAcademy: { select: { displayName: true } },
          custody: { select: { version: true, assignedAt: true, currentAnalyst: { select: { analystOperationalProfile: { select: { identityId: true, displayLabel: true } } } } } },
          custodyEvents: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: {
              id: true, action: true, createdAt: true, safeReason: true,
              previousAnalyst: { select: { analystOperationalProfile: { select: { displayLabel: true } } } },
              nextAnalyst: { select: { analystOperationalProfile: { select: { displayLabel: true } } } },
            },
          },
        },
      });
      if (!passport?.player.privateIdentity?.encryptedLegalName) return { outcome: 'not-found' };
      const displayLabel = this.labels.decrypt(passport.player.privateIdentity.encryptedLegalName).trim();
      if (!displayLabel) return { outcome: 'not-found' };
      const requestPlayer = await this.prisma.registrationRequestPlayer.findFirst({
        where: { linkedPlayerId: passport.playerId },
        orderBy: [{ request: { updatedAt: 'desc' } }, { id: 'desc' }],
        select: { request: { select: { id: true, status: true, dossierConfirmations: { orderBy: [{ confirmedAt: 'desc' }, { id: 'desc' }], take: 1, select: { id: true } } } } },
      });
      const profile = passport.custody?.currentAnalyst?.analystOperationalProfile;
      const activeCustodyCount = profile ? await this.prisma.passportCustody.count({ where: { currentAnalystIdentityId: profile.identityId } }) : 0;
      const custody = profile && passport.custody ? Object.freeze({
        state: 'ASSIGNED' as const,
        version: passport.custody.version,
        analyst: Object.freeze({ identityId: profile.identityId, displayLabel: profile.displayLabel, activeCustodyCount }),
        ...(passport.custody.assignedAt ? { assignedAt: passport.custody.assignedAt.toISOString() } : {}),
      }) : Object.freeze({ state: 'UNASSIGNED' as const, version: passport.custody?.version ?? 0 });
      const history = mapPassportCustodyHistory({ passportId, passportCreatedAt: passport.createdAt, events: passport.custodyEvents });
      const originRequest = requestPlayer ? link(requestPlayer.request.id, 'SOL', requestPlayer.request.status, true, displayLabel) : link(passport.id, 'SOL', 'UNAVAILABLE', false);
      const dossier = requestPlayer?.request.dossierConfirmations[0];
      const linkedDossier = dossier ? link(dossier.id, 'EXP', requestPlayer.request.status === 'APPROVED' ? 'APPROVED' : 'CONFIRMED', true, displayLabel) : link(passport.id, 'EXP', 'UNAVAILABLE', false);
      return { outcome: 'found', detail: Object.freeze({
        passportId: passport.id,
        maskedReference: masked('PAS', passport.id),
        displayLabel,
        lifecycleState: 'ACTIVE',
        enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT',
        ...(passport.originAcademy?.displayName ? { academyLabel: passport.originAcademy.displayName } : {}),
        custody,
        capabilities: Object.freeze(profile ? ['CHANGE', 'REMOVE'] as const : ['ASSIGN'] as const),
        originRequest,
        linkedDossier,
        history: history.events,
        creationMilestone: history.milestone,
      }) };
    } catch {
      return { outcome: 'unavailable' };
    }
  }
}

function masked(prefix: 'PAS' | 'SOL' | 'EXP', id: string): string {
  return `${prefix}-••••-${id.slice(-4).toUpperCase()}`;
}

function link(id: string, prefix: 'SOL' | 'EXP', status: string, available: boolean, displayLabel?: string): SafeCustodyLink {
  return Object.freeze({ id, maskedReference: available ? masked(prefix, id) : 'No disponible', ...(available && displayLabel ? { displayLabel } : {}), status, available });
}
