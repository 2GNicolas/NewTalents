import { describe, expect, it } from 'vitest';

import { documentFingerprint, nameDobFingerprint } from './fingerprint.js';
import { loadPassportKeys } from './passport-keys.js';

const keys = loadPassportKeys({
  PASSPORT_DOCUMENT_HMAC_KEY: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
  PASSPORT_NAME_DOB_HMAC_KEY: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=',
  PASSPORT_PRIVATE_ENCRYPTION_KEY: 'AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM=',
});

describe('passport fingerprints', () => {
  it('produces deterministic 256-bit hex fingerprints', () => {
    const first = documentFingerprint(keys.documentHmacKey, 'CÉDULA DE CIUDADANÍA', '1 234 567-890');
    const second = documentFingerprint(keys.documentHmacKey, 'CÉDULA DE CIUDADANÍA', '1 234 567-890');
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);

    const nameDob = nameDobFingerprint(keys.nameDobHmacKey, 'MATEO GONZÁLEZ', '2026-09-16');
    expect(nameDob).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when any normalized component changes', () => {
    const base = documentFingerprint(keys.documentHmacKey, 'CC', '123');
    expect(documentFingerprint(keys.documentHmacKey, 'TI', '123')).not.toBe(base);
    expect(documentFingerprint(keys.documentHmacKey, 'CC', '124')).not.toBe(base);

    const nameDob = nameDobFingerprint(keys.nameDobHmacKey, 'MATEO GONZÁLEZ', '2026-09-16');
    expect(nameDobFingerprint(keys.nameDobHmacKey, 'MATEO GONZÁLEZ', '2026-09-17')).not.toBe(nameDob);
    expect(nameDobFingerprint(keys.nameDobHmacKey, 'MATEO A. GONZÁLEZ', '2026-09-16')).not.toBe(nameDob);
  });

  it('uses the two HMAC keys strictly for their own purpose', () => {
    const documentWithDocumentKey = documentFingerprint(keys.documentHmacKey, 'CC', '123');
    const documentWithNameDobKey = documentFingerprint(keys.nameDobHmacKey, 'CC', '123');
    const nameDobWithNameDobKey = nameDobFingerprint(keys.nameDobHmacKey, 'MATEO GONZÁLEZ', '2026-09-16');
    const nameDobWithDocumentKey = nameDobFingerprint(keys.documentHmacKey, 'MATEO GONZÁLEZ', '2026-09-16');

    expect(documentWithDocumentKey).not.toBe(documentWithNameDobKey);
    expect(nameDobWithNameDobKey).not.toBe(nameDobWithDocumentKey);
  });

  it('does not contain recoverable input in the fingerprint value', () => {
    const fingerprint = documentFingerprint(keys.documentHmacKey, 'CÉDULA DE CIUDADANÍA', '1 234 567-890');
    expect(fingerprint).not.toContain('CÉDULA');
    expect(fingerprint).not.toContain('1 234 567-890');
  });
});
