import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';

import { PrivateIdentityService } from '../../player-passport/player-private-identity/private-identity.service.js';
import { RegistrationDuplicateService } from './registration-duplicate.service.js';

const requestId = '11111111-1111-4111-8111-111111111111';
const person = { legalName: '  María   Núñez ', dateOfBirth: '2000-01-02', documentType: ' cc ', documentNumber: ' 123 456 ' };
const keys = { documentHmacKey: Buffer.alloc(32, 1), nameDobHmacKey: Buffer.alloc(32, 2), privateEncryptionKey: Buffer.alloc(32, 3) };

function transaction() {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    authenticationCredential: { findUnique: vi.fn().mockResolvedValue(null) },
    playerPrivateIdentity: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null) },
    registrationRequestApplicant: { findFirst: vi.fn().mockResolvedValue(null) },
    registrationPrivateDuplicateSignal: { create: vi.fn().mockResolvedValue({ id: 'signal' }) },
  };
}

describe('RegistrationDuplicateService', () => {
  it('normalizes email/document data and reuses Feature 005 keyed fingerprints', async () => {
    const tx = transaction();
    const service = new RegistrationDuplicateService(new PrivateIdentityService(keys));
    const result = await service.inspect(tx as never, { requestId, email: ' Person@Example.COM ', person });
    const stored = new PrivateIdentityService(keys).createPrivateIdentity({ ...person, legalName: 'María Núñez', documentType: 'CC', documentNumber: '123 456' });
    expect(result).toEqual({ outcome: 'clear' });
    expect(tx.authenticationCredential.findUnique).toHaveBeenCalledWith({ where: { normalizedEmail: 'person@example.com' }, select: { identityId: true } });
    expect(tx.playerPrivateIdentity.findUnique).toHaveBeenCalledWith({ where: { documentFingerprint: stored.documentFingerprint }, select: { playerId: true } });
    expect(JSON.stringify(result)).not.toMatch(/fingerprint|encrypted/i);
  });

  it.each([
    ['email', 'credentials.email'],
    ['document', 'person.documentNumber'],
  ] as const)('identifies the applicant field for exact %s matches without exposing candidate data', async (kind, field) => {
    const tx = transaction();
    if (kind === 'email') tx.authenticationCredential.findUnique.mockResolvedValueOnce({ identityId: 'private-candidate' } as never);
    else tx.playerPrivateIdentity.findUnique.mockResolvedValueOnce({ playerId: 'private-candidate' } as never);
    const service = new RegistrationDuplicateService(new PrivateIdentityService(keys));
    const result = await service.inspect(tx as never, { requestId, email: 'person@example.com', person });
    expect(result).toEqual({ outcome: 'conflict', code: 'REGISTRATION_CONFLICT', field });
    expect(JSON.stringify(result)).not.toMatch(/candidate|fingerprint|private-candidate/i);
  });

  it('records name/date similarity privately while returning a clear applicant result', async () => {
    const tx = transaction();
    tx.playerPrivateIdentity.findFirst.mockResolvedValueOnce({ playerId: 'private-candidate' } as never);
    const service = new RegistrationDuplicateService(new PrivateIdentityService(keys));
    const result = await service.inspect(tx as never, { requestId, email: 'person@example.com', person });
    expect(result.outcome).toBe('clear');
    expect(tx.registrationPrivateDuplicateSignal.create).toHaveBeenCalledWith({ data: { requestId, signalType: 'NAME_DOB_SIMILARITY', encryptedCandidateReference: null } });
    expect(JSON.stringify(result)).not.toContain('private-candidate');
  });

  it('takes transaction-scoped advisory locks before exact-match checks', async () => {
    const tx = transaction();
    const service = new RegistrationDuplicateService(new PrivateIdentityService(keys));
    await service.inspect(tx as never, { requestId, email: 'person@example.com', person });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.authenticationCredential.findUnique.mock.invocationCallOrder[0]!);
  });
});
