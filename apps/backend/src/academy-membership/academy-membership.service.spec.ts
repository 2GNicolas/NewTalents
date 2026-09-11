import { describe, expect, it, vi } from 'vitest';

import { AcademyMembershipService } from './academy-membership.service.js';
import { MembershipTransitionService } from './membership-transition.service.js';

const identityId = '11111111-1111-4111-8111-111111111111';
const academyId = '22222222-2222-4222-8222-222222222222';

describe('AcademyMembershipService', () => {
  it('creates, finds, ends, and retains membership history without granting active context to history', async () => {
    const prisma = {
      identity: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE' }) },
      academy: { findUnique: vi.fn().mockResolvedValue({ id: academyId }) },
      academyMembership: {
        create: vi.fn().mockResolvedValue({ id: '33333333-3333-4333-8333-333333333333', academyId, status: 'ACTIVE' }),
        findFirst: vi.fn().mockResolvedValueOnce({ id: '33333333-3333-4333-8333-333333333333', academyId, status: 'ACTIVE' }).mockResolvedValueOnce({ id: '33333333-3333-4333-8333-333333333333' }).mockResolvedValueOnce(null),
        findMany: vi.fn().mockResolvedValue([{ id: '33333333-3333-4333-8333-333333333333', academyId, status: 'ENDED' }]),
        update: vi.fn().mockResolvedValue({ id: '33333333-3333-4333-8333-333333333333', status: 'ENDED' }),
      },
    };
    const service = new AcademyMembershipService(prisma as never);
    await expect(service.create(identityId, academyId, identityId)).resolves.toEqual(expect.objectContaining({ outcome: 'created' }));
    await expect(service.current(identityId)).resolves.toEqual(expect.objectContaining({ academyId, status: 'ACTIVE' }));
    await expect(service.end('33333333-3333-4333-8333-333333333333')).resolves.toEqual({ outcome: 'ended' });
    await expect(service.current(identityId)).resolves.toEqual(null);
    await expect(service.history(identityId)).resolves.toEqual([expect.objectContaining({ status: 'ENDED' })]);
  });

  it('returns controlled results for unknown, invalid, inactive, and persistence-conflict inputs', async () => {
    const prisma = { identity: { findUnique: vi.fn().mockResolvedValue(null) }, academy: { findUnique: vi.fn() }, academyMembership: { create: vi.fn() } };
    const service = new AcademyMembershipService(prisma as never);
    await expect(service.create(identityId, academyId, identityId)).resolves.toEqual({ outcome: 'unknown-identity' });
    await expect(service.create('bad', academyId, identityId)).resolves.toEqual({ outcome: 'invalid' });
  });
});

describe('MembershipTransitionService retry policy', () => {
  it('retries only P2034 with 50 ms then 100 ms and uses a fresh transaction each time', async () => {
    const error = Object.assign(new Error('serialization'), { code: 'P2034' });
    const transaction = vi.fn().mockRejectedValueOnce(error).mockRejectedValueOnce(error).mockResolvedValueOnce({ outcome: 'transitioned' });
    const delay = vi.fn().mockResolvedValue(undefined);
    const service = new MembershipTransitionService({ $transaction: transaction } as never, delay);
    await expect(service.transition(identityId, academyId, identityId)).resolves.toEqual({ outcome: 'transitioned' });
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenNthCalledWith(1, 50);
    expect(delay).toHaveBeenNthCalledWith(2, 100);
  });

  it('returns conflict after three P2034 attempts and does not retry non-retryable errors', async () => {
    const p2034 = Object.assign(new Error('serialization'), { code: 'P2034' });
    const delay = vi.fn().mockResolvedValue(undefined);
    const retries = vi.fn().mockRejectedValue(p2034);
    const service = new MembershipTransitionService({ $transaction: retries } as never, delay);
    await expect(service.transition(identityId, academyId, identityId)).resolves.toEqual({ outcome: 'conflict' });
    expect(retries).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(2);
    const noRetry = vi.fn().mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    await expect(new MembershipTransitionService({ $transaction: noRetry } as never, delay).transition(identityId, academyId, identityId)).resolves.toEqual({ outcome: 'conflict' });
    expect(noRetry).toHaveBeenCalledOnce();
  });
});
