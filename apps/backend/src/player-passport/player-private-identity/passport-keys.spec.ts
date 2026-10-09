import { describe, expect, it } from 'vitest';

import {
  decodePassportKey,
  loadPassportKeys,
  parsePassportKey,
} from './passport-keys.js';

const documentKey = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=';
const nameDobKey = 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=';
const encryptionKey = 'AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM=';

describe('passport key validation', () => {
  it.each([
    ['PASSPORT_DOCUMENT_HMAC_KEY', documentKey],
    ['PASSPORT_NAME_DOB_HMAC_KEY', nameDobKey],
    ['PASSPORT_PRIVATE_ENCRYPTION_KEY', encryptionKey],
  ])('accepts a canonical base64 32-byte key for %s', (name, value) => {
    expect(parsePassportKey(name, value)).toBe(value);
    expect(decodePassportKey(name, value)).toHaveLength(32);
  });

  it.each([
    ['PASSPORT_DOCUMENT_HMAC_KEY', undefined],
    ['PASSPORT_DOCUMENT_HMAC_KEY', ''],
    ['PASSPORT_DOCUMENT_HMAC_KEY', '__REQUIRED__'],
    ['PASSPORT_DOCUMENT_HMAC_KEY', 'CHANGE_ME'],
    ['PASSPORT_DOCUMENT_HMAC_KEY', 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE'], // missing padding
    ['PASSPORT_DOCUMENT_HMAC_KEY', 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ=='], // 33 bytes when decoded
    ['PASSPORT_DOCUMENT_HMAC_KEY', 'not-a-valid-base64-key!'],
    ['PASSPORT_NAME_DOB_HMAC_KEY', undefined],
    ['PASSPORT_NAME_DOB_HMAC_KEY', 'CHANGE_ME'],
    ['PASSPORT_NAME_DOB_HMAC_KEY', 'not-a-valid-base64-key!'],
    ['PASSPORT_PRIVATE_ENCRYPTION_KEY', undefined],
    ['PASSPORT_PRIVATE_ENCRYPTION_KEY', '__REQUIRED__'],
    ['PASSPORT_PRIVATE_ENCRYPTION_KEY', 'not-a-valid-base64-key!'],
  ])('fails closed for invalid %s', (name, value) => {
    expect(() => parsePassportKey(name, value)).toThrow(`Invalid configuration: ${name}`);
    expect(() => decodePassportKey(name, value)).toThrow(`Invalid configuration: ${name}`);
  });

  it('loads the three decoded passport keys without echoing secret material', () => {
    const keys = loadPassportKeys({
      PASSPORT_DOCUMENT_HMAC_KEY: documentKey,
      PASSPORT_NAME_DOB_HMAC_KEY: nameDobKey,
      PASSPORT_PRIVATE_ENCRYPTION_KEY: encryptionKey,
    });
    expect(keys.documentHmacKey).toHaveLength(32);
    expect(keys.nameDobHmacKey).toHaveLength(32);
    expect(keys.privateEncryptionKey).toHaveLength(32);
    expect(Object.isFrozen(keys)).toBe(true);
    expect(keys.documentHmacKey.toString('base64')).toBe(documentKey);
    expect(keys.nameDobHmacKey.toString('base64')).toBe(nameDobKey);
    expect(keys.privateEncryptionKey.toString('base64')).toBe(encryptionKey);
  });
});
