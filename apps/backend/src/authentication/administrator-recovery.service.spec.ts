import { describe, expect, it } from 'vitest';

import { AdministratorRecoveryService } from './administrator-recovery.service.js';

describe('AdministratorRecoveryService', () => {
  it('refuses recovery without explicit confirmation before it begins a transaction', async () => {
    const execute = async () => { throw new Error('transaction must not run'); };
    const service = new AdministratorRecoveryService({ execute } as never, {} as never, {} as never);
    await expect(service.recover({ confirmation: false, email: 'recovery@example.test', password: 'a-valid-operator-password' })).resolves.toEqual({ outcome: 'refused' });
  });

  it('refuses recovery while an active eligible Administrator exists without changing history', async () => {
    const events: unknown[] = [];
    const transaction = {
      roleAssignment: { findFirst: async () => ({ id: 'existing' }), create: async () => { throw new Error('must not create'); } },
      identity: { create: async () => { throw new Error('must not create'); } },
      authenticationCredential: { create: async () => { throw new Error('must not create'); } },
      authenticationSession: { updateMany: async () => ({ count: 0 }) },
    };
    const service = new AdministratorRecoveryService(
      { execute: async (operation: (tx: typeof transaction) => Promise<unknown>) => operation(transaction) } as never,
      { validPassword: () => true, hashPassword: async () => 'hash' } as never,
      { record: async (_tx: unknown, event: unknown) => { events.push(event); } } as never,
    );
    await expect(service.recover({ confirmation: true, email: 'recovery@example.test', password: 'a-valid-operator-password' })).resolves.toEqual({ outcome: 'refused' });
    expect(events).toEqual([{ type: 'RECOVERY_DENIED', outcome: 'DENIED', reasonCategory: 'active-administrator-exists' }]);
  });
});
