import { Buffer } from 'node:buffer';

const PASSPORT_KEY_PLACEHOLDERS = new Set(['__REQUIRED__', 'CHANGE_ME']);
const PASSPORT_KEY_PATTERN = /^[A-Za-z0-9+/]{43}=$/;

export type PassportKeyMaterial = Readonly<{
  documentHmacKey: Buffer;
  nameDobHmacKey: Buffer;
  privateEncryptionKey: Buffer;
}>;

export function parsePassportKey(name: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || PASSPORT_KEY_PLACEHOLDERS.has(value.trim())) {
    throw new Error(`Invalid configuration: ${name}`);
  }
  if (!PASSPORT_KEY_PATTERN.test(value)) {
    throw new Error(`Invalid configuration: ${name}`);
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length !== 32) {
    throw new Error(`Invalid configuration: ${name}`);
  }
  return value;
}

export function decodePassportKey(name: string, value: unknown): Buffer {
  return Buffer.from(parsePassportKey(name, value), 'base64');
}

export function loadPassportKeys(environment: Record<string, unknown>): PassportKeyMaterial {
  return Object.freeze({
    documentHmacKey: decodePassportKey('PASSPORT_DOCUMENT_HMAC_KEY', environment.PASSPORT_DOCUMENT_HMAC_KEY),
    nameDobHmacKey: decodePassportKey('PASSPORT_NAME_DOB_HMAC_KEY', environment.PASSPORT_NAME_DOB_HMAC_KEY),
    privateEncryptionKey: decodePassportKey('PASSPORT_PRIVATE_ENCRYPTION_KEY', environment.PASSPORT_PRIVATE_ENCRYPTION_KEY),
  });
}
