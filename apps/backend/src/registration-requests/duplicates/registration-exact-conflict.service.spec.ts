import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';

import { RegistrationExactConflictService } from './registration-exact-conflict.service.js';

const keys = { documentHmacKey: Buffer.alloc(32, 1), nameDobHmacKey: Buffer.alloc(32, 2), privateEncryptionKey: Buffer.alloc(32, 3) };

function transaction() {
  return {
    playerPrivateIdentity: { findUnique: vi.fn().mockResolvedValue(null) },
    registrationRequestApplicant: { findFirst: vi.fn().mockResolvedValue(null) },
    registrationRequestPlayer: { findFirst: vi.fn().mockResolvedValue(null) },
    registrationRequestRepresentative: { findFirst: vi.fn().mockResolvedValue(null) },
    formalAcademyRequestDetail: { findFirst: vi.fn().mockResolvedValue(null) },
    naturalPersonAcademyRequestDetail: { findFirst: vi.fn().mockResolvedValue(null) },
    registrationExactIdentifierClaim: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

describe('RegistrationExactConflictService', () => {
  it('returns only the requested field when an existing normalized document conflicts', async () => {
    const tx = transaction();
    tx.registrationRequestPlayer.findFirst.mockResolvedValueOnce({ id: 'private-match' } as never);
    const service = new RegistrationExactConflictService({ $transaction: vi.fn() } as never, keys);
    await expect(service.inspect(tx as never, { documents: [{ field: 'person.documentNumber', documentType: 'CC', documentNumber: '1.234.567' }] })).resolves.toEqual({ outcome: 'conflict', field: 'person.documentNumber' });
    expect(JSON.stringify(await service.inspect(transaction() as never, { documents: [{ field: 'person.documentNumber', documentType: 'CC', documentNumber: '1234567' }] }))).not.toMatch(/fingerprint|private-match|1234567/);
  });

  it('checks the academy NIT independently from responsible-person documents', async () => {
    const tx = transaction();
    tx.formalAcademyRequestDetail.findFirst.mockResolvedValueOnce({ id: 'private-academy' } as never);
    const service = new RegistrationExactConflictService({ $transaction: vi.fn() } as never, keys);
    await expect(service.inspect(tx as never, { documents: [], nit: { field: 'nit', value: '900.123.456-7' } })).resolves.toEqual({ outcome: 'conflict', field: 'nit' });
  });

  it('reports an exact normalized academy-name conflict on its field', async () => {
    const tx = transaction();
    tx.naturalPersonAcademyRequestDetail.findFirst.mockResolvedValueOnce({ id: 'private-academy' } as never);
    const service = new RegistrationExactConflictService({ $transaction: vi.fn() } as never, keys);
    await expect(service.inspect(tx as never, { documents: [], academyName: { field: 'academy.academyName', value: ' Locales ' } })).resolves.toEqual({ outcome: 'conflict', field: 'academy.academyName' });
    expect(JSON.stringify(tx.naturalPersonAcademyRequestDetail.findFirst.mock.calls)).not.toContain('Locales');
  });

  it('reserves a normalized identifier exactly once for atomic draft creation', async () => {
    const tx = transaction();
    const service = new RegistrationExactConflictService({ $transaction: vi.fn() } as never, keys);
    await expect(service.reserve(tx as never, { documents: [{ field: 'minor.documentNumber', documentType: 'TI', documentNumber: '1234567890' }] }, 'request-id')).resolves.toEqual({ outcome: 'clear' });
    expect(tx.registrationExactIdentifierClaim.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    tx.registrationExactIdentifierClaim.createMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.reserve(tx as never, { documents: [{ field: 'minor.documentNumber', documentType: 'TI', documentNumber: '1234567890' }] }, 'request-id')).resolves.toEqual({ outcome: 'conflict', field: 'minor.documentNumber' });
  });
});
