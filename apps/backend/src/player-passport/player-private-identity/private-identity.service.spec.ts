import { describe, expect, it } from 'vitest';

import { loadPassportKeys } from './passport-keys.js';
import { PrivateIdentityService } from './private-identity.service.js';

const keys = loadPassportKeys({
  PASSPORT_DOCUMENT_HMAC_KEY: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
  PASSPORT_NAME_DOB_HMAC_KEY: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=',
  PASSPORT_PRIVATE_ENCRYPTION_KEY: 'AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM=',
});

describe('PrivateIdentityService', () => {
  it('produces ciphertext plus both fingerprints and never returns raw document values', () => {
    const service = new PrivateIdentityService(keys);
    const stored = service.createPrivateIdentity({
      legalName: '  Mateo   González  ',
      dateOfBirth: ' 2026-09-16 ',
      documentType: ' Cédula de ciudadanía ',
      documentNumber: '  ABC-123-456  ',
    });

    expect(Object.keys(stored).sort()).toEqual([
      'documentFingerprint',
      'encryptedDateOfBirth',
      'encryptedDocumentNumber',
      'encryptedDocumentType',
      'encryptedLegalName',
      'nameDobFingerprint',
    ]);
    expect(stored.documentFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.nameDobFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.encryptedLegalName).not.toContain('Mateo');
    expect(stored.encryptedDocumentNumber).not.toContain('ABC-123-456');
    expect(JSON.stringify(stored)).not.toContain('ABC-123-456');
    expect(JSON.stringify(stored)).not.toContain('2026-09-16');
  });

  it('is deterministic for fingerprints while ciphertext varies', () => {
    const service = new PrivateIdentityService(keys);
    const input = {
      legalName: 'Mateo González',
      dateOfBirth: '2026-09-16',
      documentType: 'CC',
      documentNumber: '123-456-789',
    };
    const first = service.createPrivateIdentity(input);
    const second = service.createPrivateIdentity(input);

    expect(first.documentFingerprint).toBe(second.documentFingerprint);
    expect(first.nameDobFingerprint).toBe(second.nameDobFingerprint);
    expect(first.encryptedDocumentNumber).not.toBe(second.encryptedDocumentNumber);
  });

  it('changes only the document fingerprint when the document changes', () => {
    const service = new PrivateIdentityService(keys);
    const first = service.createPrivateIdentity({
      legalName: 'Mateo González',
      dateOfBirth: '2026-09-16',
      documentType: 'CC',
      documentNumber: '123',
    });
    const second = service.createPrivateIdentity({
      legalName: 'Mateo González',
      dateOfBirth: '2026-09-16',
      documentType: 'CC',
      documentNumber: '124',
    });
    expect(first.documentFingerprint).not.toBe(second.documentFingerprint);
    expect(first.nameDobFingerprint).toBe(second.nameDobFingerprint);
  });

  it('changes the name/date-of-birth fingerprint when those inputs change', () => {
    const service = new PrivateIdentityService(keys);
    const first = service.createPrivateIdentity({
      legalName: 'Mateo González',
      dateOfBirth: '2026-09-16',
      documentType: 'CC',
      documentNumber: '123',
    });
    const second = service.createPrivateIdentity({
      legalName: 'Mateo A. González',
      dateOfBirth: '2026-09-16',
      documentType: 'CC',
      documentNumber: '123',
    });
    expect(first.nameDobFingerprint).not.toBe(second.nameDobFingerprint);
    expect(first.documentFingerprint).toBe(second.documentFingerprint);
  });

  it.each([
    ['legalName', ''],
    ['dateOfBirth', ''],
    ['documentType', ''],
    ['documentNumber', ''],
  ])('rejects missing %s without echoing the value', (field, value) => {
    const service = new PrivateIdentityService(keys);
    const input = {
      legalName: 'Mateo González',
      dateOfBirth: '2026-09-16',
      documentType: 'CC',
      documentNumber: '123',
      [field]: value,
    };
    expect(() => service.createPrivateIdentity(input)).toThrow('Invalid identity input');
  });
});
