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
        identity: { status: 'ACTIVE', roleAssignments: { some: { status: 'ACTIVE' } } },
      }),
    }));
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
});
