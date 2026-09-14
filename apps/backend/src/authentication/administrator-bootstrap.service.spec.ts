import { describe, expect, it } from 'vitest';

import { AdministratorBootstrapService } from './administrator-bootstrap.service.js';

describe('AdministratorBootstrapService', () => {
  it('creates only identity, permanent credential, Administrator assignment, and redacted evidence', async () => {
    const calls: string[] = [];
    const transaction = {
      roleAssignment: { findFirst: async () => null, create: async () => { calls.push('role'); } },
      identity: { create: async () => ({ id: '33333333-3333-3333-3333-333333333333' }) },
      authenticationCredential: { create: async () => { calls.push('credential'); } },
    };
    const events: unknown[] = [];
    const service = new AdministratorBootstrapService(
      { execute: async (operation: (tx: typeof transaction) => Promise<unknown>) => operation(transaction) } as never,
      { validPassword: () => true, hashPassword: async () => 'argon2-hash' } as never,
      { record: async (_tx: unknown, event: unknown) => { calls.push('event'); events.push(event); } } as never,
    );
    await expect(service.initialize({ confirmation: true, email: 'first-admin@example.test', password: 'a-valid-operator-password' }))
      .resolves.toEqual({ outcome: 'initialized', identityId: '33333333-3333-3333-3333-333333333333' });
    expect(calls).toEqual(['credential', 'role', 'event']);
    expect(events).toEqual([{ type: 'INITIALIZATION_SUCCEEDED', outcome: 'APPLIED', identityId: '33333333-3333-3333-3333-333333333333' }]);
  });
});
