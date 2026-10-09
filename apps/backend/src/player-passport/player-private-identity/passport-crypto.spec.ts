import { describe, expect, it } from 'vitest';

import { decryptPassportValue, encryptPassportValue } from './passport-crypto.js';
import { loadPassportKeys } from './passport-keys.js';

const keys = loadPassportKeys({
  PASSPORT_DOCUMENT_HMAC_KEY: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
  PASSPORT_NAME_DOB_HMAC_KEY: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=',
  PASSPORT_PRIVATE_ENCRYPTION_KEY: 'AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM=',
});

describe('passport crypto', () => {
  it('round-trips authenticated ciphertext', () => {
    const encrypted = encryptPassportValue(keys.privateEncryptionKey, 'Mateo González');
    expect(decryptPassportValue(keys.privateEncryptionKey, encrypted)).toBe('Mateo González');
  });

  it('uses a unique random 12-byte IV for every encryption', () => {
    const first = encryptPassportValue(keys.privateEncryptionKey, 'same-value');
    const second = encryptPassportValue(keys.privateEncryptionKey, 'same-value');
    expect(first).not.toBe(second);
  });

  it('rejects ciphertext whose bytes have been tampered with', () => {
    const encrypted = encryptPassportValue(keys.privateEncryptionKey, 'protected value');
    const bytes = Buffer.from(encrypted, 'base64');
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 0x01;
    expect(() => decryptPassportValue(keys.privateEncryptionKey, bytes.toString('base64'))).toThrow();
  });

  it('rejects malformed or truncated ciphertext', () => {
    expect(() => decryptPassportValue(keys.privateEncryptionKey, 'not-base64-!!')).toThrow();
    expect(() => decryptPassportValue(keys.privateEncryptionKey, Buffer.from('short').toString('base64'))).toThrow();
  });

  it('fails closed when the encryption key is not 32 bytes', () => {
    expect(() => encryptPassportValue(Buffer.alloc(16, 1), 'value')).toThrow('Invalid encryption key');
  });
});
