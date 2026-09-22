import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';

import { PrismaService } from '../database/prisma.service.js';
import { PassportAgePolicyService } from './age-policy/passport-age-policy.service.js';
import { DuplicateReviewService } from './duplicate-review/duplicate-review.service.js';
import { PASSPORT_KEY_MATERIAL } from './passport-key.token.js';
import { PassportTraceService } from './passport-lifecycle/passport-trace.service.js';
import { PassportTransactionRunner } from './passport-lifecycle/transaction-runner.js';
import { documentFingerprint } from './player-private-identity/fingerprint.js';
import { normalizeDocumentNumber, normalizeDocumentType } from './player-private-identity/identity-normalization.js';
import { decryptPassportValue, encryptPassportValue } from './player-private-identity/passport-crypto.js';
import type { PassportKeyMaterial } from './player-private-identity/passport-keys.js';
import { PrivateIdentityService, type PrivateIdentityInput } from './player-private-identity/private-identity.service.js';

export type ManagementContext = 'SELF' | 'LEGAL_REPRESENTATIVE' | 'ACADEMY';
export type RepresentativeInput = Readonly<{
  legalName: string;
  documentType: string;
  documentNumber: string;
  relationship: 'MOTHER' | 'FATHER' | 'LEGAL_GUARDIAN';
  authorityConfirmed: true;
}>;
export type FootballProfileInput = Readonly<{
  position: string;
  ageCategory: string;
  city: string;
  country: string;
  dominantFoot: 'LEFT' | 'RIGHT' | 'BOTH' | 'UNDECLARED';
}>;
export type CorrectiveDraftInput = Readonly<{
  actorIdentityId: string;
  managementContext: ManagementContext;
  academyId?: string;
  representativeConfirmationId?: string;
  representative?: RepresentativeInput;
  privateIdentity: PrivateIdentityInput;
  profile: FootballProfileInput;
}>;
export type CorrectiveDraftResult =
  | Readonly<{ outcome: 'created'; passportId: string }>
  | Readonly<{ outcome: 'invalid' | 'forbidden' | 'duplicate-document' | 'conflict' | 'unavailable' }>;

const editableStates = ['DRAFT', 'RETURNED_FOR_CORRECTION'] as const;

@Injectable()
export class PlayerPassportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: PassportTransactionRunner,
    private readonly privateIdentities: PrivateIdentityService,
    private readonly ages: PassportAgePolicyService,
    private readonly duplicates: DuplicateReviewService,
    private readonly traces: PassportTraceService,
    @Inject(PASSPORT_KEY_MATERIAL) private readonly keys: PassportKeyMaterial,
  ) {}

  async createDraft(input: CorrectiveDraftInput): Promise<CorrectiveDraftResult> {
    let stored: ReturnType<PrivateIdentityService['createPrivateIdentity']>;
    let classification: 'MINOR' | 'ADULT';
    try {
      stored = this.privateIdentities.createPrivateIdentity(input.privateIdentity);
      classification = this.ages.classify(input.privateIdentity.dateOfBirth);
    } catch {
      return { outcome: 'invalid' };
    }
    if (input.managementContext === 'SELF' && classification !== 'ADULT') return { outcome: 'invalid' };
    if (input.managementContext === 'LEGAL_REPRESENTATIVE' && (classification !== 'MINOR' || !input.representative?.authorityConfirmed)) return { outcome: 'invalid' };
    if (input.managementContext !== 'ACADEMY' && (input.academyId || input.representativeConfirmationId)) return { outcome: 'invalid' };
    if (input.managementContext === 'ACADEMY' && !input.academyId) return { outcome: 'invalid' };
    if (input.managementContext === 'ACADEMY' && classification === 'MINOR' && !input.representativeConfirmationId) return { outcome: 'invalid' };
    if (input.managementContext === 'ACADEMY' && classification === 'ADULT' && input.representativeConfirmationId) return { outcome: 'invalid' };

    try {
      return await this.transactions.execute(async (tx) => {
        const allowed = await this.creationAuthority(tx, input, classification, stored.documentFingerprint);
        if (!allowed) return { outcome: 'forbidden' as const };

        const player = await tx.player.create({ data: {} });
        await tx.playerPrivateIdentity.create({ data: { playerId: player.id, ...stored } });
        const passport = await tx.playerPassport.create({ data: {
          playerId: player.id,
          originKind: input.managementContext === 'ACADEMY' ? 'ACADEMY' : 'PARTICULAR',
          position: input.profile.position,
          ageCategory: input.profile.ageCategory,
          city: input.profile.city,
          country: input.profile.country,
          dominantFoot: input.profile.dominantFoot,
          createdByIdentityId: input.actorIdentityId,
          originAcademyId: input.managementContext === 'ACADEMY' ? input.academyId! : null,
          version: 1,
        } });

        if (input.managementContext === 'SELF') {
          await tx.passportResponsibility.create({ data: { passportId: passport.id, identityId: input.actorIdentityId, kind: 'SELF' } });
        } else if (input.managementContext === 'LEGAL_REPRESENTATIVE') {
          await tx.passportResponsibility.create({ data: { passportId: passport.id, identityId: input.actorIdentityId, kind: 'LEGAL_REPRESENTATIVE' } });
          await this.persistConsumedRepresentativeConfirmation(tx, passport.id, input.actorIdentityId, input.representative!, stored.documentFingerprint);
        } else {
          await tx.passportResponsibility.create({ data: { passportId: passport.id, academyId: input.academyId!, kind: 'ACADEMY' } });
          if (classification === 'MINOR') {
            const confirmation = await tx.representativeConfirmation.findUnique({ where: { id: input.representativeConfirmationId! } });
            if (!confirmation) throw new Error('CONFIRMATION_CONFLICT');
            await tx.passportResponsibility.create({ data: { passportId: passport.id, identityId: confirmation.representativeIdentityId, kind: 'LEGAL_REPRESENTATIVE' } });
            const consumed = await tx.representativeConfirmation.updateMany({
              where: { id: confirmation.id, status: 'PENDING', playerDocumentBinding: stored.documentFingerprint, expiresAt: { gt: new Date() } },
              data: { status: 'CONSUMED', consumedAt: new Date(), passportId: passport.id },
            });
            if (consumed.count !== 1) throw new Error('CONFIRMATION_CONFLICT');
          }
        }

        await this.traces.record(tx, {
          passportId: passport.id,
          actorIdentityId: input.actorIdentityId,
          action: 'CREATED',
          outcome: 'APPLIED',
          resultingState: 'DRAFT',
        });
        const signal = await this.duplicates.createSignal(tx, { passportId: passport.id, playerId: player.id, nameDobFingerprint: stored.nameDobFingerprint });
        if (signal.outcome === 'invalid' || signal.outcome === 'unavailable') throw new Error('DUPLICATE_SIGNAL_FAILURE');
        return { outcome: 'created' as const, passportId: passport.id };
      });
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      if (code === 'P2002') return { outcome: 'duplicate-document' };
      if (error instanceof Error && error.message === 'CONFIRMATION_CONFLICT') return { outcome: 'conflict' };
      return { outcome: 'unavailable' };
    }
  }

  async listAccessible(identityId: string, context: 'PARTICULAR' | 'ACADEMY', academyId?: string) {
    const identity = await this.prisma.identity.findUnique({ where: { id: identityId }, include: { roleAssignments: { where: { status: 'ACTIVE' } } } });
    const internal = identity?.roleAssignments.some((assignment) => assignment.role === 'ANALYST' || assignment.role === 'ADMINISTRATOR') ?? false;
    if (context === 'PARTICULAR') {
      return this.prisma.playerPassport.findMany({
        where: internal ? { originKind: { in: ['PARTICULAR', 'TUTOR'] } } : { OR: [
          { responsibilities: { some: { identityId, kind: { in: ['SELF', 'LEGAL_REPRESENTATIVE'] } } } },
          { player: { initialTutorResponsibility: { tutorIdentityId: identityId } } },
        ] },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (internal) return this.prisma.playerPassport.findMany({ where: { originKind: 'ACADEMY' }, orderBy: { createdAt: 'desc' } });
    const memberships = await this.prisma.academyMembership.findMany({ where: { identityId, status: 'ACTIVE' }, select: { academyId: true } });
    const academyIds = memberships.map((membership) => membership.academyId).filter((id) => academyId === undefined || id === academyId);
    if (academyIds.length === 0) return [];
    return this.prisma.playerPassport.findMany({
      where: { originAcademyId: { in: academyIds }, responsibilities: { some: { academyId: { in: academyIds }, kind: 'ACADEMY' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async editableDraft(passportId: string) {
    const passport = await this.prisma.playerPassport.findUnique({ where: { id: passportId }, include: { player: { include: { privateIdentity: true } } } });
    const identity = passport?.player.privateIdentity;
    if (!passport || !identity || !editableStates.includes(passport.state as typeof editableStates[number])) return null;
    return {
      passportId,
      playerLegalName: decryptPassportValue(this.keys.privateEncryptionKey, identity.encryptedLegalName),
      dateOfBirth: decryptPassportValue(this.keys.privateEncryptionKey, identity.encryptedDateOfBirth),
      playerDocument: {
        documentType: decryptPassportValue(this.keys.privateEncryptionKey, identity.encryptedDocumentType),
        documentNumber: decryptPassportValue(this.keys.privateEncryptionKey, identity.encryptedDocumentNumber),
      },
      footballProfile: {
        primaryPosition: passport.position,
        declaredAgeCategory: passport.ageCategory,
        city: passport.city,
        country: passport.country,
        dominantFoot: passport.dominantFoot,
      },
      lifecycleState: passport.state,
      version: passport.version,
    };
  }

  async ageAuthorityCompatible(passportId: string, operationDate: Date = new Date()): Promise<boolean> {
    const passport = await this.prisma.playerPassport.findUnique({
      where: { id: passportId },
      include: { player: { include: { privateIdentity: true, initialTutorResponsibility: true } }, responsibilities: true },
    });
    if (!passport?.player.privateIdentity) return false;
    const birth = decryptPassportValue(this.keys.privateEncryptionKey, passport.player.privateIdentity.encryptedDateOfBirth);
    const classification = this.ages.classify(birth, operationDate);
    if (passport.responsibilities.some((item) => item.kind === 'SELF')) return classification === 'ADULT';
    if (passport.responsibilities.some((item) => item.kind === 'LEGAL_REPRESENTATIVE')) return classification === 'MINOR';
    if (passport.responsibilities.some((item) => item.kind === 'ACADEMY')) return true;
    return passport.player.initialTutorResponsibility !== null && classification === 'MINOR';
  }

  async updateDraft(passportId: string, input: Readonly<{ actorIdentityId: string; expectedVersion?: number; privateIdentity?: Partial<PrivateIdentityInput>; profile?: Partial<FootballProfileInput>; operationDate?: Date }>) {
    try {
      return await this.transactions.execute(async (tx) => {
        const passport = await tx.playerPassport.findUnique({ where: { id: passportId }, include: { player: { include: { privateIdentity: true } }, responsibilities: true } });
        const current = passport?.player.privateIdentity;
        if (!passport || !current || !editableStates.includes(passport.state as typeof editableStates[number])) return { outcome: 'invalid-state' as const };
        if (input.expectedVersion !== undefined && passport.version !== input.expectedVersion) return { outcome: 'conflict' as const };
        const privateInput: PrivateIdentityInput = {
          legalName: input.privateIdentity?.legalName ?? decryptPassportValue(this.keys.privateEncryptionKey, current.encryptedLegalName),
          dateOfBirth: input.privateIdentity?.dateOfBirth ?? decryptPassportValue(this.keys.privateEncryptionKey, current.encryptedDateOfBirth),
          documentType: input.privateIdentity?.documentType ?? decryptPassportValue(this.keys.privateEncryptionKey, current.encryptedDocumentType),
          documentNumber: input.privateIdentity?.documentNumber ?? decryptPassportValue(this.keys.privateEncryptionKey, current.encryptedDocumentNumber),
        };
        const classification = this.ages.classify(privateInput.dateOfBirth, input.operationDate ?? new Date());
        if (passport.responsibilities.some((item) => item.kind === 'SELF') && classification !== 'ADULT') return { outcome: 'conflict' as const };
        if (passport.responsibilities.some((item) => item.kind === 'LEGAL_REPRESENTATIVE') && classification !== 'MINOR') return { outcome: 'conflict' as const };
        if (input.privateIdentity) await tx.playerPrivateIdentity.update({ where: { playerId: passport.playerId }, data: this.privateIdentities.createPrivateIdentity(privateInput) });
        const profile = input.profile ?? {};
        await tx.playerPassport.update({ where: { id: passportId }, data: {
          ...(profile.position === undefined ? {} : { position: profile.position }),
          ...(profile.ageCategory === undefined ? {} : { ageCategory: profile.ageCategory }),
          ...(profile.city === undefined ? {} : { city: profile.city }),
          ...(profile.country === undefined ? {} : { country: profile.country }),
          ...(profile.dominantFoot === undefined ? {} : { dominantFoot: profile.dominantFoot }),
          version: { increment: 1 },
        } });
        await this.traces.record(tx, { passportId, actorIdentityId: input.actorIdentityId, action: 'EDITED', outcome: 'APPLIED', priorState: passport.state, resultingState: passport.state });
        return { outcome: 'applied' as const };
      });
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      return { outcome: code === 'P2002' ? 'duplicate-document' as const : 'unavailable' as const };
    }
  }

  private async creationAuthority(tx: Prisma.TransactionClient, input: CorrectiveDraftInput, classification: 'MINOR' | 'ADULT', binding: string) {
    const identity = await tx.identity.findUnique({ where: { id: input.actorIdentityId }, include: { roleAssignments: { where: { status: 'ACTIVE' } } } });
    if (!identity || identity.status !== 'ACTIVE') return false;
    const roles = new Set(identity.roleAssignments.map((assignment) => assignment.role));
    if (input.managementContext === 'SELF' || input.managementContext === 'LEGAL_REPRESENTATIVE') return roles.has('USER');
    if (!roles.has('ACADEMY_USER') || !input.academyId) return false;
    const membership = await tx.academyMembership.findFirst({ where: { identityId: input.actorIdentityId, academyId: input.academyId, status: 'ACTIVE' } });
    if (!membership) return false;
    if (classification === 'MINOR') {
      if (!input.representativeConfirmationId) return false;
      const confirmation = await tx.representativeConfirmation.findFirst({ where: { id: input.representativeConfirmationId, status: 'PENDING', playerDocumentBinding: binding, expiresAt: { gt: new Date() }, representativeIdentityId: { not: input.actorIdentityId } } });
      if (!confirmation) return false;
    }
    return true;
  }

  private async persistConsumedRepresentativeConfirmation(tx: Prisma.TransactionClient, passportId: string, identityId: string, representative: RepresentativeInput, binding: string) {
    const normalizedType = normalizeDocumentType(representative.documentType);
    const normalizedNumber = normalizeDocumentNumber(representative.documentNumber);
    await tx.representativeConfirmation.create({ data: {
      passportId,
      representativeIdentityId: identityId,
      encryptedLegalName: encryptPassportValue(this.keys.privateEncryptionKey, representative.legalName.trim()),
      encryptedDocumentType: encryptPassportValue(this.keys.privateEncryptionKey, representative.documentType.trim()),
      encryptedDocumentNumber: encryptPassportValue(this.keys.privateEncryptionKey, representative.documentNumber.trim()),
      encryptedRelationship: encryptPassportValue(this.keys.privateEncryptionKey, representative.relationship),
      documentFingerprint: documentFingerprint(this.keys.documentHmacKey, normalizedType, normalizedNumber),
      playerDocumentBinding: binding,
      status: 'CONSUMED',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      consumedAt: new Date(),
    } });
  }
}
