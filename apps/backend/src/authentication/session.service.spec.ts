import { describe, expect, it, vi } from 'vitest';

import { functionalRoles } from '../identity/role-assignment.service.js';
import { SessionService } from './session.service.js';

describe('SessionService USER compatibility', () => {
  it('recognizes USER as a controlled functional role without changing session validation', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222' });
    const service = new SessionService(
      { authenticationSession: { findFirst } } as never,
      {} as never,
      {} as never,
    );

    expect(functionalRoles).toContain('USER');
    await expect(service.validate(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    )).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'ACTIVE',
        identity: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    }));
  });

  it('validates an active pending-applicant session while still requiring a live pending access fact', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222' });
    const service = new SessionService({ authenticationSession: { findFirst } } as never, {} as never, {} as never);

    await expect(service.validate('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ identity: {
      status: 'ACTIVE',
      OR: [
        { roleAssignments: { some: { status: 'ACTIVE' } } },
        { registrationApplicantAccesses: { some: { status: 'PENDING_ONBOARDING' } } },
      ],
    } }) }));
  });

  it('does not create roles or passport relationships while creating a session', async () => {
    const create = vi.fn().mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222' });
    const service = new SessionService({} as never, {} as never, {} as never);
    const transaction = { authenticationSession: { create } };

    await expect(service.createInTransaction(
      transaction as never,
      '11111111-1111-4111-8111-111111111111',
    )).resolves.toBe('22222222-2222-4222-8222-222222222222');
    expect(Object.keys(transaction)).toEqual(['authenticationSession']);
    expect(create).toHaveBeenCalledOnce();
  });

  it('reuses current and all-session revocation for pending identities without changing authorization facts', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const execute = vi.fn(async (operation) => operation({ authenticationSession: { updateMany } }));
    const record = vi.fn().mockResolvedValue(undefined);
    const service = new SessionService({} as never, { execute } as never, { record } as never);

    await expect(service.logoutCurrent('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')).resolves.toBe(true);
    await expect(service.logoutAll('11111111-1111-4111-8111-111111111111')).resolves.toBe(true);
    expect(updateMany).toHaveBeenNthCalledWith(1, { where: { id: '22222222-2222-4222-8222-222222222222', identityId: '11111111-1111-4111-8111-111111111111', status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: expect.any(Date), revocationReason: 'logout-current' } });
    expect(updateMany).toHaveBeenNthCalledWith(2, { where: { identityId: '11111111-1111-4111-8111-111111111111', status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: expect.any(Date), revocationReason: 'logout-all' } });
    expect(record).toHaveBeenCalledTimes(2);
  });
});
