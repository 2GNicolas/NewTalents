import { describe, expect, it } from 'vitest';
import { AuthenticationService } from './authentication.service.js';
describe('AuthenticationService', () => {
  it('provides a generic safe invalid outcome', async () => { const service = new AuthenticationService({ authenticationCredential: { findUnique: async () => null } } as never, {} as never, { throttled: async () => false, failed: async () => undefined } as never, {} as never, {} as never, {} as never); await expect(service.login({ email: 'nobody@example.test', password: 'invalid-password', source: { remoteAddress: '127.0.0.1' } })).resolves.toEqual({ outcome: 'invalid-credentials' }); });
  it('accepts USER through the existing session flow without provisioning roles', async () => {
    let createdSession = false;
    const service = new AuthenticationService({ authenticationCredential: { findUnique: async () => ({ identityId: '11111111-1111-4111-8111-111111111111', passwordHash: 'hash', status: 'ACTIVE', identity: { status: 'ACTIVE', roleAssignments: [{ role: 'USER' }] } }) } } as never, { verifyPassword: async () => true } as never, { throttled: async () => false, failed: async () => undefined, succeeded: async () => undefined } as never, { create: async () => { createdSession = true; return 'session'; } } as never, { issueAccessToken: async () => 'access' } as never, { issue: async () => 'refresh' } as never);
    await expect(service.login({ email: 'user@example.test', password: 'valid-password', source: { remoteAddress: '127.0.0.1' } })).resolves.toMatchObject({ outcome: 'authenticated' });
    expect(createdSession).toBe(true);
  });
});
