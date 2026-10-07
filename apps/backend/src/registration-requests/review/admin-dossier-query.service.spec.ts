import { describe, expect, it, vi } from 'vitest';

import { AdminDossierQueryService } from './admin-dossier-query.service.js';

const adminId = '10000000-0000-4000-8000-000000000001';
const dossierId = '20000000-0000-4000-8000-000000000001';
const requestId = '30000000-0000-4000-8000-000000000001';
const passportId = '40000000-0000-4000-8000-000000000001';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: dossierId, requestId, requestVersion: 4, dossierName: 'exp-prueba-001', confirmedAt: new Date('2026-09-29T16:42:00.000Z'),
  labelCiphertext: 'cipher:Valentina P.', requestType: 'ACADEMY_MINOR_PLAYER', requestStatus: 'APPROVED',
  approvalExecutionStatus: 'FINALIZED', executionStatus: 'FINALIZED', finalizedAt: new Date('2026-09-29T16:52:00.000Z'),
  deletionStatuses: ['COMPLETED'], deletionVerifiedAt: new Date('2026-09-29T16:50:00.000Z'),
  linkedPassport: { id: passportId, state: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT' },
  ...overrides,
});

describe('AdminDossierQueryService', () => {
  it('lists confirmed rows in stable order with filters, safe links and a backward-page cursor', async () => {
    const repository = { listCandidates: vi.fn().mockResolvedValue({ rows: [row()], nextCursor: undefined }), cursorFor: vi.fn().mockReturnValue('cursor-1') };
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }) };
    const service = new AdminDossierQueryService(repository as never, authorization as never, { decrypt: (value: string) => value.replace('cipher:', '') });
    const result = await service.list(adminId, { limit: 20, query: 'valentina', requestType: 'ACADEMY_MINOR_PLAYER', status: 'APPROVED', confirmedFrom: '2026-09-01', confirmedTo: '2026-09-30' });

    expect(result).toMatchObject({ outcome: 'found', items: [{ dossierId, displayLabel: 'Valentina P.', status: 'APPROVED', requestType: 'ACADEMY_MINOR_PLAYER', originRequest: { id: requestId, displayLabel: 'Valentina P.', available: true }, linkedPassport: { id: passportId, displayLabel: 'Valentina P.', available: true } }] });
    expect(repository.listCandidates).toHaveBeenCalledWith(expect.objectContaining({ order: 'confirmedAt-id-desc', requestType: 'ACADEMY_MINOR_PLAYER' }));
    expect(JSON.stringify(result)).not.toMatch(/cipher|transferredCategories|declaration|document|email|phone|credential|objectKey|digest/i);
  });

  it('projects the stored dossier name separately and searches it without replacing person labels', async () => {
    const repository = { listCandidates: vi.fn().mockResolvedValue({ rows: [row()], nextCursor: undefined }), findById: vi.fn().mockResolvedValue(row()) };
    const service = new AdminDossierQueryService(repository as never, { authorize: vi.fn().mockResolvedValue({ allowed: true }) } as never, { decrypt: (value: string) => value.replace('cipher:', '') });
    await expect(service.list(adminId, { limit: 20, query: 'EXP-PRUEBA-001' })).resolves.toMatchObject({ items: [{ dossierName: 'exp-prueba-001', displayLabel: 'Valentina P.' }] });
    await expect(service.detail(adminId, dossierId)).resolves.toMatchObject({ detail: { dossierName: 'exp-prueba-001' } });
  });

  it('leaves an older dossier without a stored name unnamed', async () => {
    const repository = { findById: vi.fn().mockResolvedValue(row({ dossierName: null })) };
    const service = new AdminDossierQueryService(repository as never, { authorize: vi.fn().mockResolvedValue({ allowed: true }) } as never, { decrypt: (value: string) => value.replace('cipher:', '') });
    await expect(service.detail(adminId, dossierId)).resolves.toMatchObject({ detail: { dossierName: null, displayLabel: 'Valentina P.' } });
  });

  it.each([
    [{ executionStatus: 'PREPARED', requestStatus: 'SUBMITTED', approvalExecutionStatus: 'PREPARED' }, 'CONFIRMED'],
    [{ executionStatus: 'DELETING_EVIDENCE', requestStatus: 'SUBMITTED', approvalExecutionStatus: 'DELETING_EVIDENCE', deletionStatuses: ['PENDING'] }, 'DELETION_PENDING'],
    [{ executionStatus: 'RECOVERY_REQUIRED', requestStatus: 'SUBMITTED', approvalExecutionStatus: 'RECOVERY_REQUIRED', deletionStatuses: ['RECOVERY_REQUIRED'] }, 'RECOVERY_REQUIRED'],
    [{ executionStatus: 'FINALIZED', requestStatus: 'APPROVED', approvalExecutionStatus: 'FINALIZED' }, 'APPROVED'],
  ])('derives current status from Feature 006 state', async (overrides, status) => {
    const repository = { listCandidates: vi.fn().mockResolvedValue({ rows: [row(overrides)] }), cursorFor: vi.fn() };
    const service = new AdminDossierQueryService(repository as never, { authorize: vi.fn().mockResolvedValue({ allowed: true }) } as never, { decrypt: (value: string) => value.replace('cipher:', '') });
    await expect(service.list(adminId, { limit: 20 })).resolves.toMatchObject({ items: [{ status }] });
  });

  it('returns read-only detail with safe ordered confirmation history and notApplicable passport', async () => {
    const repository = { findById: vi.fn().mockResolvedValue(row({ linkedPassport: null, requestType: 'FORMAL_ACADEMY' })) };
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }) };
    const service = new AdminDossierQueryService(repository as never, authorization as never, { decrypt: (value: string) => value.replace('cipher:', '') });
    const result = await service.detail(adminId, dossierId);

    expect(result).toMatchObject({ outcome: 'found', detail: { linkedPassport: { notApplicable: true }, confirmationHistory: [
      { action: 'DOSSIER_CONFIRMED', actorLabel: 'ADMINISTRATOR' },
      { action: 'EVIDENCE_DELETION_VERIFIED', actorLabel: 'SYSTEM' },
      { action: 'APPROVAL_FINALIZED', actorLabel: 'SYSTEM' },
    ] } });
    expect(authorization.authorize).toHaveBeenLastCalledWith(expect.objectContaining({ permission: 'registration.dossier.view', requestId, dossierConfirmed: true }));
  });

  it('uses an authorized readable name candidate instead of a reference-shaped label', async () => {
    const repository = { findById: vi.fn().mockResolvedValue(row({ labelCiphertext: 'cipher:EXP-0000-WED2', labelCiphertexts: ['cipher:EXP-0000-WED2', 'cipher:Valentina Pérez'] })) };
    const service = new AdminDossierQueryService(repository as never, { authorize: vi.fn().mockResolvedValue({ allowed: true }) } as never, { decrypt: (value: string) => value.replace('cipher:', '') });

    await expect(service.detail(adminId, dossierId)).resolves.toMatchObject({
      outcome: 'found',
      detail: {
        displayLabel: 'Valentina Pérez',
        originRequest: { displayLabel: 'Valentina Pérez' },
        linkedPassport: { displayLabel: 'Valentina Pérez' },
      },
    });
  });

  it('fails closed for collection denial, missing/inaccessible detail and repository failure', async () => {
    const denied = new AdminDossierQueryService({} as never, { authorize: vi.fn().mockResolvedValue({ allowed: false }) } as never, { decrypt: vi.fn() });
    await expect(denied.list(adminId, { limit: 20 })).resolves.toEqual({ outcome: 'denied' });

    const missing = new AdminDossierQueryService({ findById: vi.fn().mockResolvedValue(null) } as never, { authorize: vi.fn().mockResolvedValue({ allowed: true }) } as never, { decrypt: vi.fn() });
    await expect(missing.detail(adminId, dossierId)).resolves.toEqual({ outcome: 'not-found' });

    const unavailable = new AdminDossierQueryService({ listCandidates: vi.fn().mockRejectedValue(new Error('private storage detail')) } as never, { authorize: vi.fn().mockResolvedValue({ allowed: true }) } as never, { decrypt: vi.fn() });
    await expect(unavailable.list(adminId, { limit: 20 })).resolves.toEqual({ outcome: 'unavailable' });
  });
});
