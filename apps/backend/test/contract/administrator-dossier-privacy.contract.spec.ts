import { describe, expect, it, vi } from 'vitest';

import { FEATURE_007_CANARIES } from '../fixtures/feature-007.fixture.js';
import { AdminDossierQueryService } from '../../src/registration-requests/review/admin-dossier-query.service.js';

describe('Feature 007 dossier privacy contract', () => {
  it('projects no deleted evidence, object keys, digests, civil identity, contacts, credentials or categories', async () => {
    const row = { id: '20000000-0000-4000-8000-000000000001', requestId: '30000000-0000-4000-8000-000000000001', requestVersion: 4, confirmedAt: new Date('2026-09-29T16:42:00Z'), labelCiphertext: 'cipher:Nombre permitido', requestType: 'PERSONAL_ADULT', requestStatus: 'APPROVED', approvalExecutionStatus: 'FINALIZED', executionStatus: 'FINALIZED', finalizedAt: new Date('2026-09-29T17:00:00Z'), deletionStatuses: ['COMPLETED'], deletionVerifiedAt: new Date('2026-09-29T16:55:00Z'), linkedPassport: null, protected: { ...FEATURE_007_CANARIES, transferredCategories: ['IDENTITY_FRONT'] } };
    const repository = { listCandidates: vi.fn().mockResolvedValue({ rows: [row] }), findById: vi.fn().mockResolvedValue(row), cursorFor: vi.fn() };
    const service = new AdminDossierQueryService(repository as never, { authorize: vi.fn().mockResolvedValue({ allowed: true }) } as never, { decrypt: (value) => value.replace('cipher:', '') });
    const output = JSON.stringify({ list: await service.list('10000000-0000-4000-8000-000000000001', { limit: 20 }), detail: await service.detail('10000000-0000-4000-8000-000000000001', row.id) });
    for (const value of [...Object.values(FEATURE_007_CANARIES), 'IDENTITY_FRONT']) expect(output).not.toContain(value);
    expect(output).not.toMatch(/objectKey|contentDigest|email|phone|credential|civilDocument|transferredCategories|deletedEvidence/i);
  });

  it('keeps denial and failure projections generic without logging protected values', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = new AdminDossierQueryService({ listCandidates: vi.fn().mockRejectedValue(new Error(FEATURE_007_CANARIES.deletedEvidence)) } as never, { authorize: vi.fn().mockResolvedValue({ allowed: true }) } as never, { decrypt: vi.fn() });
    await expect(service.list('10000000-0000-4000-8000-000000000001', { limit: 20 })).resolves.toEqual({ outcome: 'unavailable' });
    expect(log).not.toHaveBeenCalled(); log.mockRestore();
  });
});
