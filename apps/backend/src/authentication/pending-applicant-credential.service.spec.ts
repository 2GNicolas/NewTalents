import { describe, expect, it, vi } from 'vitest';

import { PendingApplicantCredentialService } from './pending-applicant-credential.service.js';

const requestId = '22222222-2222-4222-8222-222222222222';
const identityId = '11111111-1111-4111-8111-111111111111';

describe('PendingApplicantCredentialService', () => {
  it('atomically creates identity, active credential and PENDING_ONBOARDING access without roles', async () => {
    const tx = {
      identity: { create: vi.fn().mockResolvedValue({ id: identityId }) },
      authenticationCredential: { create: vi.fn().mockResolvedValue({ id: 'credential' }) },
      registrationRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      registrationApplicantAccess: { create: vi.fn().mockResolvedValue({ id: 'access' }) },
    };
    const transactions = { execute: vi.fn(async (operation) => operation(tx)) };
    const credentials = { validPassword: vi.fn().mockReturnValue(true), hashPassword: vi.fn().mockResolvedValue('argon2id-safe-hash') };
    const service = new PendingApplicantCredentialService(transactions as never, credentials as never);

    const result = await service.create({ requestId, email: ' Persona@Example.Test ', password: 'test-password-not-usable', passwordConfirmation: 'test-password-not-usable' });

    expect(result).toEqual({ outcome: 'created', identityId });
    expect(tx.authenticationCredential.create).toHaveBeenCalledWith({ data: { identityId, normalizedEmail: 'persona@example.test', passwordHash: 'argon2id-safe-hash', activatedAt: expect.any(Date) } });
    expect(tx.registrationRequest.updateMany).toHaveBeenCalledWith({ where: { id: requestId, ownerIdentityId: null, status: 'DRAFT' }, data: { ownerIdentityId: identityId } });
    expect(tx.registrationApplicantAccess.create).toHaveBeenCalledWith({ data: { requestId, identityId, status: 'PENDING_ONBOARDING' } });
    expect(Object.keys(tx)).toEqual(['identity', 'authenticationCredential', 'registrationRequest', 'registrationApplicantAccess']);
    expect(JSON.stringify(result)).not.toContain('password');
    expect(JSON.stringify(result)).not.toContain('argon2id-safe-hash');
  });

  it('rejects invalid confirmation before hashing and maps normalized-email conflicts generically', async () => {
    const credentials = { validPassword: vi.fn().mockReturnValue(true), hashPassword: vi.fn().mockResolvedValue('hash') };
    const conflictTransactions = { execute: vi.fn().mockRejectedValue({ code: 'P2002', meta: { target: ['normalizedEmail'] } }) };
    const service = new PendingApplicantCredentialService(conflictTransactions as never, credentials as never);

    await expect(service.create({ requestId, email: 'persona@example.test', password: 'test-password-not-usable', passwordConfirmation: 'different-secret' })).resolves.toEqual({ outcome: 'invalid' });
    expect(credentials.hashPassword).not.toHaveBeenCalled();

    await expect(service.create({ requestId, email: 'persona@example.test', password: 'test-password-not-usable', passwordConfirmation: 'test-password-not-usable' })).resolves.toEqual({ outcome: 'conflict' });
    expect(JSON.stringify(await service.create({ requestId, email: 'persona@example.test', password: 'test-password-not-usable', passwordConfirmation: 'test-password-not-usable' }))).not.toContain('normalizedEmail');
  });

  it('rolls back through the existing transaction boundary when the draft cannot be claimed', async () => {
    const tx = {
      identity: { create: vi.fn().mockResolvedValue({ id: identityId }) },
      authenticationCredential: { create: vi.fn() },
      registrationRequest: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      registrationApplicantAccess: { create: vi.fn() },
    };
    const transactions = { execute: vi.fn(async (operation) => operation(tx)) };
    const credentials = { validPassword: vi.fn().mockReturnValue(true), hashPassword: vi.fn().mockResolvedValue('hash') };
    const service = new PendingApplicantCredentialService(transactions as never, credentials as never);

    await expect(service.create({ requestId, email: 'persona@example.test', password: 'test-password-not-usable', passwordConfirmation: 'test-password-not-usable' })).resolves.toEqual({ outcome: 'conflict' });
    expect(tx.authenticationCredential.create).not.toHaveBeenCalled();
    expect(tx.registrationApplicantAccess.create).not.toHaveBeenCalled();
  });
});
