import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';

const COMPONENT_SEPARATOR = '\u0000';

function keyedHmacSha256(key: Buffer, ...components: string[]): string {
  return createHmac('sha256', key).update(components.join(COMPONENT_SEPARATOR)).digest('hex');
}

export function documentFingerprint(key: Buffer, normalizedDocumentType: string, normalizedDocumentNumber: string): string {
  return keyedHmacSha256(key, normalizedDocumentType, normalizedDocumentNumber);
}

export function nameDobFingerprint(key: Buffer, normalizedLegalName: string, normalizedDateOfBirth: string): string {
  return keyedHmacSha256(key, normalizedLegalName, normalizedDateOfBirth);
}
