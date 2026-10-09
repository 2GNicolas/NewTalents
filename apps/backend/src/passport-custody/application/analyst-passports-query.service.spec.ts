import { describe, expect, it, vi } from 'vitest';

import { AnalystPassportsQueryService } from './analyst-passports-query.service.js';

const identityId = '11111111-1111-4111-8111-111111111111';

describe('AnalystPassportsQueryService', () => {
  it('rechecks the active identity and Analyst role before every stable page', async () => {
    const prisma = { identity: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', roleAssignments: [{ role: 'ANALYST' }], analystOperationalProfile: { identityId } }) } };
    const custody = { listPassports: vi.fn().mockResolvedValue({ items: [], nextCursor: 'next' }) };
    const service = new AnalystPassportsQueryService(prisma as never, custody as never);
    await expect(service.list({ identityId, cursor: 'cursor', limit: 10 })).resolves.toEqual({ items: [], nextCursor: 'next' });
    expect(custody.listPassports).toHaveBeenCalledWith({ assignment: 'ASSIGNED', analystId: identityId, cursor: 'cursor', limit: 10 });
  });

  it('fails closed after identity or role revocation without trusting session claims', async () => {
    for (const identity of [{ status: 'INACTIVE', roleAssignments: [{ role: 'ANALYST' }], analystOperationalProfile: { identityId } }, { status: 'ACTIVE', roleAssignments: [], analystOperationalProfile: { identityId } }, { status: 'ACTIVE', roleAssignments: [{ role: 'ANALYST' }], analystOperationalProfile: null }, null]) {
      const service = new AnalystPassportsQueryService({ identity: { findUnique: vi.fn().mockResolvedValue(identity) } } as never, { listPassports: vi.fn() } as never);
      await expect(service.list({ identityId, limit: 20 })).resolves.toEqual({ outcome: 'forbidden' });
    }
  });
});
