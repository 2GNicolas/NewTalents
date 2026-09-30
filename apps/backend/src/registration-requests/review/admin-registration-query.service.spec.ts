import { describe, expect, it, vi } from 'vitest';

import { AdminRegistrationQueryService } from './admin-registration-query.service.js';

const adminId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';

describe('AdminRegistrationQueryService', () => {
  it('returns one redacted page containing every typed request and preserves filters/cursor', async () => {
    const types = ['PERSONAL_ADULT', 'REPRESENTED_MINOR', 'FORMAL_ACADEMY', 'NATURAL_PERSON_ACADEMY', 'ADDITIONAL_ACADEMY_ACCOUNT', 'ACADEMY_ADULT_PLAYER', 'ACADEMY_MINOR_PLAYER'] as const;
    const repository = { listForReview: vi.fn().mockResolvedValue({ items: types.map((type, index) => ({ id: `${requestId.slice(0, -1)}${index}`, type, status: 'SUBMITTED', version: 1, createdAt: new Date('2026-09-24T12:00:00Z'), submittedAt: new Date('2026-09-24T12:01:00Z'), latestSafeReason: null, applicants: [{ encryptedLegalName: 'PRIVATE' }], academyContext: { name: 'PRIVATE' }, evidenceItems: [{ status: 'CLEAN' }], corrections: [] })), nextCursor: 'next' }) };
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }) };
    const service = new AdminRegistrationQueryService(repository as never, {} as never, authorization as never, {} as never);

    const page = await service.list(adminId, { limit: 20, cursor: 'cursor', type: 'PERSONAL_ADULT', status: 'SUBMITTED' });

    expect(repository.listForReview).toHaveBeenCalledWith({ limit: 20, cursor: 'cursor', type: 'PERSONAL_ADULT', status: 'SUBMITTED' });
    if ('outcome' in page) throw new Error('expected authorized page');
    expect(page.items.map((item) => item.type)).toEqual(types);
    expect(page.nextCursor).toBe('next');
    expect(JSON.stringify(page)).not.toContain('PRIVATE');
    expect(page.items[0]).toMatchObject({ safeApplicantLabel: 'Solicitante', evidenceComplete: true, correctionRequired: false });
  });

  it('returns minimum-necessary detail with safe evidence, deletion and redacted history', async () => {
    const repository = {};
    const prisma = { registrationRequest: { findUnique: vi.fn().mockResolvedValue({ id: requestId, type: 'PERSONAL_ADULT', status: 'SUBMITTED', version: 2, createdAt: new Date('2026-09-24T12:00:00Z'), submittedAt: new Date('2026-09-24T12:01:00Z'), latestSafeReason: null, academyContextId: null, applicants: [{ encryptedLegalName: 'PRIVATE-NAME' }], evidenceItems: [{ id: 'e1', category: 'IDENTITY_FRONT', status: 'CLEAN', sizeBytes: 123 }], corrections: [], deletionRecords: [{ status: 'PENDING', updatedAt: new Date('2026-09-24T12:02:00Z') }] }) } };
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }), projectCapabilities: vi.fn().mockResolvedValue(['registration.review.view']) };
    const history = { administratorHistory: vi.fn().mockResolvedValue([{ actor: adminId, at: '2026-09-24T12:01:00.000Z', action: 'SUBMITTED', result: 'APPLIED' }]) };
    const service = new AdminRegistrationQueryService(repository as never, prisma as never, authorization as never, history as never);

    const result = await service.detail(adminId, requestId);

    expect(result).toMatchObject({ outcome: 'found', request: { id: requestId, evidence: [{ id: 'e1', category: 'IDENTITY_FRONT', status: 'CLEAN', sizeBytes: 123 }], deletion: { status: 'PENDING' } } });
    expect(JSON.stringify(result)).not.toContain('PRIVATE-NAME');
  });

  it('denies by default without disclosing whether a request exists', async () => {
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: false }) };
    const service = new AdminRegistrationQueryService({ listForReview: vi.fn() } as never, { registrationRequest: { findUnique: vi.fn() } } as never, authorization as never, {} as never);
    await expect(service.list(adminId, { limit: 20 })).resolves.toEqual({ outcome: 'denied' });
    await expect(service.detail(adminId, requestId)).resolves.toEqual({ outcome: 'not-found' });
  });
});
