import { Injectable } from '@nestjs/common';

import type { RegistrationRequestType } from '../domain/registration-request.types.js';
import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';
import { AdminDossierRepository, type DossierCandidate } from '../persistence/admin-dossier.repository.js';

export type DossierStatus = 'CONFIRMED' | 'DELETION_PENDING' | 'RECOVERY_REQUIRED' | 'APPROVED';
export type DossierQuery = Readonly<{ cursor?: string; limit: number; query?: string; status?: DossierStatus; requestType?: RegistrationRequestType; confirmedFrom?: string; confirmedTo?: string }>;
export type DossierLink = Readonly<{ id: string; maskedReference: string; displayLabel?: string; status: string; available: boolean }>;
export type DossierSummary = Readonly<{ dossierId: string; dossierName: string | null; maskedReference: string; displayLabel: string; status: DossierStatus; confirmedAt: string; requestType: RegistrationRequestType; originRequest: DossierLink; linkedPassport: DossierLink | Readonly<{ notApplicable: true }> }>;

@Injectable()
export class AdminDossierQueryService {
  constructor(private readonly repository: AdminDossierRepository, private readonly authorization: RegistrationAuthorizationAdapter, private readonly labels: Readonly<{ decrypt: (ciphertext: string) => string }>) {}

  async list(identityId: string, query: DossierQuery) {
    const decision = await this.authorization.authorize({ identityId, permission: 'registration.dossier.list' });
    if (!decision.allowed) return { outcome: 'denied' as const };
    try {
      const items: DossierSummary[] = [];
      let cursor = query.cursor;
      let nextCursor: string | undefined;
      let lastIncludedRow: DossierCandidate | undefined;
      const needle = normalize(query.query);
      for (let block = 0; block < 20 && items.length <= query.limit; block += 1) {
        const page = await this.repository.listCandidates({ limit: Math.max(50, query.limit + 1), order: 'confirmedAt-id-desc', ...(cursor ? { cursor } : {}), ...(query.requestType ? { requestType: query.requestType } : {}), ...(query.confirmedFrom ? { confirmedFrom: startOfDay(query.confirmedFrom) } : {}), ...(query.confirmedTo ? { confirmedTo: endOfDay(query.confirmedTo) } : {}) });
        for (const row of page.rows) {
          const projected = this.project(row);
          if ((!query.status || projected.status === query.status) && (!needle || normalize(projected.dossierName ?? undefined).includes(needle) || normalize(projected.displayLabel).includes(needle) || normalize(projected.maskedReference).includes(needle) || normalize(projected.originRequest.maskedReference).includes(needle) || ('maskedReference' in projected.linkedPassport && normalize(projected.linkedPassport.maskedReference).includes(needle)))) {
            items.push(projected);
            if (items.length <= query.limit) lastIncludedRow = row;
          }
          if (items.length > query.limit) { nextCursor = lastIncludedRow ? this.repository.cursorFor(lastIncludedRow) : undefined; break; }
        }
        if (items.length > query.limit || !page.nextCursor) break;
        cursor = page.nextCursor;
      }
      return Object.freeze({ outcome: 'found' as const, items: Object.freeze(items.slice(0, query.limit)), ...(nextCursor ? { nextCursor } : {}) });
    } catch { return { outcome: 'unavailable' as const }; }
  }

  async detail(identityId: string, dossierId: string) {
    try {
      const row = await this.repository.findById(dossierId);
      if (!row) return { outcome: 'not-found' as const };
      const decision = await this.authorization.authorize({ identityId, permission: 'registration.dossier.view', requestId: row.requestId, dossierConfirmed: true });
      if (!decision.allowed) return { outcome: 'not-found' as const };
      const summary = this.project(row);
      const history = [
        { at: row.confirmedAt.toISOString(), action: 'DOSSIER_CONFIRMED' as const, actorLabel: 'ADMINISTRATOR' as const },
        ...(row.deletionVerifiedAt ? [{ at: row.deletionVerifiedAt.toISOString(), action: 'EVIDENCE_DELETION_VERIFIED' as const, actorLabel: 'SYSTEM' as const }] : []),
        ...(row.finalizedAt ? [{ at: row.finalizedAt.toISOString(), action: 'APPROVAL_FINALIZED' as const, actorLabel: 'SYSTEM' as const }] : []),
      ].sort((a, b) => a.at.localeCompare(b.at));
      return { outcome: 'found' as const, detail: Object.freeze({ ...summary, confirmationHistory: Object.freeze(history) }) };
    } catch { return { outcome: 'unavailable' as const }; }
  }

  private project(row: DossierCandidate): DossierSummary {
    const displayLabel = this.readableLabel(row);
    const status = deriveStatus(row);
    return Object.freeze({
      dossierId: row.id, dossierName: row.dossierName ?? null, maskedReference: masked('EXP', row.id), displayLabel, status, confirmedAt: row.confirmedAt.toISOString(), requestType: row.requestType,
      originRequest: Object.freeze({ id: row.requestId, maskedReference: masked('SOL', row.requestId), displayLabel, status: row.requestStatus, available: true }),
      linkedPassport: row.linkedPassport ? Object.freeze({ id: row.linkedPassport.id, maskedReference: masked('PAS', row.linkedPassport.id), displayLabel, status: `${row.linkedPassport.state}:${row.linkedPassport.enrichmentStatus}`, available: true }) : Object.freeze({ notApplicable: true as const }),
    });
  }

  private readableLabel(row: DossierCandidate): string {
    const candidates = row.labelCiphertexts?.length ? row.labelCiphertexts : [row.labelCiphertext];
    for (const ciphertext of candidates) {
      try {
        const value = this.labels.decrypt(ciphertext).trim().slice(0, 180);
        if (value && !isReferenceShaped(value) && value !== row.id) return value;
      } catch { /* Try the next authorized name projection. */ }
    }
    return 'Expediente confirmado';
  }
}

function deriveStatus(row: DossierCandidate): DossierStatus {
  if (row.requestStatus === 'APPROVED' && (row.executionStatus === 'FINALIZED' || row.approvalExecutionStatus === 'FINALIZED')) return 'APPROVED';
  if (row.executionStatus === 'RECOVERY_REQUIRED' || row.approvalExecutionStatus === 'RECOVERY_REQUIRED' || row.deletionStatuses.includes('RECOVERY_REQUIRED')) return 'RECOVERY_REQUIRED';
  if (row.executionStatus === 'DELETING_EVIDENCE' || row.approvalExecutionStatus === 'DELETING_EVIDENCE' || row.deletionStatuses.some((value) => value === 'PENDING' || value === 'IN_PROGRESS')) return 'DELETION_PENDING';
  return 'CONFIRMED';
}
const masked = (prefix: string, id: string) => `${prefix}-••••-${id.slice(-4).toUpperCase()}`;
const normalize = (value?: string) => value?.trim().normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es-CO') ?? '';
const isReferenceShaped = (value: string) => /^(?:EXP|SOL|PAS)-/i.test(value) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
const startOfDay = (value: string) => new Date(`${value}T00:00:00.000Z`);
const endOfDay = (value: string) => new Date(`${value}T23:59:59.999Z`);
