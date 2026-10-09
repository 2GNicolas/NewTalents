import { describe, expect, it, vi } from 'vitest';
import { AuthenticationService } from './authentication.service.js';
describe('AuthenticationService', () => {
  it('provides a generic safe invalid outcome', async () => { const service = new AuthenticationService({ authenticationCredential: { findUnique: async () => null } } as never, {} as never, { throttled: async () => false, failed: async () => undefined } as never, {} as never, {} as never, {} as never); await expect(service.login({ email: 'nobody@example.test', password: 'invalid-password', source: { remoteAddress: '127.0.0.1' } })).resolves.toEqual({ outcome: 'invalid-credentials' }); });
  it('accepts USER through the existing session flow without provisioning roles', async () => {
    let createdSession = false;
    const service = new AuthenticationService({ authenticationCredential: { findUnique: async () => ({ identityId: '11111111-1111-4111-8111-111111111111', passwordHash: 'hash', status: 'ACTIVE', identity: { status: 'ACTIVE', roleAssignments: [{ role: 'USER' }] } }) } } as never, { verifyPassword: async () => true } as never, { throttled: async () => false, failed: async () => undefined, succeeded: async () => undefined } as never, { create: async () => { createdSession = true; return 'session'; } } as never, { issueAccessToken: async () => 'access' } as never, { issue: async () => 'refresh' } as never);
    await expect(service.login({ email: 'user@example.test', password: 'valid-password', source: { remoteAddress: '127.0.0.1' } })).resolves.toMatchObject({ outcome: 'authenticated' });
    expect(createdSession).toBe(true);
  });
  it('accepts a restricted pending applicant without provisioning an ordinary role', async () => {
    const create = vi.fn().mockResolvedValue('session');
    const service = new AuthenticationService({ authenticationCredential: { findUnique: async () => ({ identityId: '11111111-1111-4111-8111-111111111111', passwordHash: 'hash', status: 'ACTIVE', identity: { status: 'ACTIVE', roleAssignments: [], registrationApplicantAccesses: [{ requestId: '22222222-2222-4222-8222-222222222222', status: 'PENDING_ONBOARDING', request: { status: 'REQUIRES_CORRECTION' } }] } }) } } as never, { verifyPassword: async () => true } as never, { throttled: async () => false, failed: async () => undefined, succeeded: async () => undefined } as never, { create } as never, { issueAccessToken: async () => 'access' } as never, { issue: async () => 'refresh' } as never);
    await expect(service.login({ email: 'pending@example.test', password: 'valid-password', source: { remoteAddress: '127.0.0.1' } })).resolves.toMatchObject({ outcome: 'authenticated', access: { classification: 'pending-onboarding', capabilities: expect.arrayContaining(['registration.request.own.view', 'registration.request.own.upload-evidence', 'registration.request.own.resubmit']) } });
    expect(create).toHaveBeenCalledOnce();
  });
  it('projects academy request entry capabilities for an active academy user without granting a resource', async () => {
    const academyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const service = new AuthenticationService({ authenticationCredential: { findUnique: async () => ({ identityId: '11111111-1111-4111-8111-111111111111', passwordHash: 'hash', status: 'ACTIVE', identity: { status: 'ACTIVE', roleAssignments: [{ role: 'ACADEMY_USER' }], memberships: [{ academyId, status: 'ACTIVE' }], registrationApplicantAccesses: [] } }) } } as never, { verifyPassword: async () => true } as never, { throttled: async () => false, failed: async () => undefined, succeeded: async () => undefined } as never, { create: async () => 'session' } as never, { issueAccessToken: async () => 'access' } as never, { issue: async () => 'refresh' } as never);
    await expect(service.login({ email: 'academy@example.test', password: 'valid-password', source: { remoteAddress: '127.0.0.1' } })).resolves.toMatchObject({ outcome: 'authenticated', access: { classification: 'product', academyId, capabilities: expect.arrayContaining(['registration.request.academy.list', 'registration.request.academy.create-adult-player']) } });
  });
  it('projects only the Administrator inbox entry capability without granting resource decisions', async () => {
    const service = new AuthenticationService({ authenticationCredential: { findUnique: async () => ({ identityId: '11111111-1111-4111-8111-111111111111', passwordHash: 'hash', status: 'ACTIVE', identity: { status: 'ACTIVE', roleAssignments: [{ role: 'ADMINISTRATOR' }], registrationApplicantAccesses: [] } }) } } as never, { verifyPassword: async () => true } as never, { throttled: async () => false, failed: async () => undefined, succeeded: async () => undefined } as never, { create: async () => 'session' } as never, { issueAccessToken: async () => 'access' } as never, { issue: async () => 'refresh' } as never);
    await expect(service.login({ email: 'admin@example.test', password: 'valid-password', source: { remoteAddress: '127.0.0.1' } })).resolves.toMatchObject({ outcome: 'authenticated', access: { classification: 'product', capabilities: ['registration.review.list'] } });
  });
});
