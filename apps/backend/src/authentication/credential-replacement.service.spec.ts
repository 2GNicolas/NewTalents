import { describe, expect, it } from 'vitest';

import { CredentialReplacementService } from './credential-replacement.service.js';
import { CredentialService } from './credential.service.js';

describe('CredentialReplacementService', () => {
  it('consumes the temporary credential, activates the permanent credential, invokes the transaction-scoped session collaborator, and records redacted evidence', async () => {
    const credentials = new CredentialService();
    const temporaryPassword = 'temporary-pass-123';
    const temporaryHash = await credentials.hashPassword(temporaryPassword);
    const calls: string[] = [];
    const tx = {
      temporaryCredential: {
        findFirst: async () => ({ id: 'temporary-id', secretHash: temporaryHash, expiresAt: new Date(Date.now() + 60_000), normalizedEmail: 'target@example.test' }),
        updateMany: async () => ({ count: 1 }),
      },
      identity: { findUnique: async () => ({ status: 'ACTIVE', roleAssignments: [{ id: 'role-id' }] }) },
      authenticationCredential: { upsert: async () => { calls.push('credential'); } },
    };
    const service = new CredentialReplacementService(
      {} as never,
      credentials,
      { execute: async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx) } as never,
      { record: async (_transaction: unknown, input: { outcome: string }) => { calls.push(`audit:${input.outcome}`); } } as never,
      { issueFirstSession: async () => { calls.push('session'); } },
    );
    const result = await service.replace({ identityId: '11111111-1111-4111-8111-111111111111', temporaryCredential: temporaryPassword, replacementPassword: 'replacement-pass-123' });
    expect(result).toEqual({ outcome: 'replaced' });
    expect(calls).toEqual(['credential', 'session', 'audit:APPLIED']);
  });

  it('does not invoke session issuance or apply evidence for an invalid temporary credential', async () => {
    const credentials = new CredentialService();
    const calls: string[] = [];
    const service = new CredentialReplacementService(
      {} as never, credentials,
      { execute: async (operation: (transaction: object) => Promise<unknown>) => operation({ temporaryCredential: { findFirst: async () => null }, identity: { findUnique: async () => null } }) } as never,
      { record: async (_transaction: unknown, input: { outcome: string }) => { calls.push(input.outcome); } } as never,
      { issueFirstSession: async () => { calls.push('session'); } },
    );
    await expect(service.replace({ identityId: '11111111-1111-4111-8111-111111111111', temporaryCredential: 'temporary-pass-123', replacementPassword: 'replacement-pass-123' })).resolves.toEqual({ outcome: 'denied' });
    expect(calls).toEqual(['DENIED']);
  });
});
