import { describe, expect, it } from 'vitest';

import { parseBackendEnvironment } from './environment.schema.js';

const valid = {
  NODE_ENV: 'test', PORT: '3000', DATABASE_URL: 'postgresql://tester:password@localhost:5433/new_talents_test',
  ALLOWED_ORIGINS: 'http://localhost:8081', JWT_ISSUER: 'new-talents.test', JWT_AUDIENCE: 'new-talents-client',
  JWT_SIGNING_SECRET: 'test-signing-secret-that-is-long-enough-to-be-safe', AUTH_ACCESS_TOKEN_TTL_SECONDS: '900',
  AUTH_REFRESH_TOKEN_TTL_SECONDS: '2592000', AUTH_TEMPORARY_CREDENTIAL_TTL_SECONDS: '86400', AUTH_ATTEMPT_LIMIT: '5',
  AUTH_ATTEMPT_WINDOW_SECONDS: '900', AUTH_TRUSTED_PROXY: 'false', AUTH_SESSION_RETENTION_DAYS: '90',
  AUTH_ATTEMPT_RETENTION_HOURS: '24', PASSPORT_DOCUMENT_HMAC_KEY: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
  PASSPORT_NAME_DOB_HMAC_KEY: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=',
  PASSPORT_PRIVATE_ENCRYPTION_KEY: 'AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM=',
  REGISTRATION_EVIDENCE_PROVIDER: 'local', REGISTRATION_EVIDENCE_PRIVATE_ROOT: 'C:/private/new-talents/evidence',
  REGISTRATION_EVIDENCE_ALLOWED_MIME_TYPES: 'application/pdf,image/jpeg,image/png',
  REGISTRATION_EVIDENCE_MAX_ITEM_BYTES: '10485760', REGISTRATION_EVIDENCE_MAX_REQUEST_BYTES: '41943040',
  REGISTRATION_SCANNER_HOST: '127.0.0.1', REGISTRATION_SCANNER_PORT: '3310', REGISTRATION_SCANNER_TIMEOUT_MS: '5000',
  REGISTRATION_PENDING_SESSION_TTL_SECONDS: '86400', REGISTRATION_DELETION_BATCH_SIZE: '25',
  REGISTRATION_DELETION_LEASE_SECONDS: '60', REGISTRATION_DELETION_BACKOFF_SECONDS: '30',
  REGISTRATION_DELETION_MAX_ATTEMPTS: '5', REGISTRATION_ORPHAN_GRACE_SECONDS: '86400',
};

describe('Feature 006 fail-closed configuration', () => {
  it('projects immutable local evidence, scanner, pending-session, and deletion settings', () => {
    const registration = parseBackendEnvironment(valid).registration;
    expect(registration).toEqual({
      evidence: {
        provider: 'local', privateRoot: 'C:/private/new-talents/evidence', bucket: null, region: null,
        encryption: null, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        maxItemBytes: 10_485_760, maxRequestBytes: 41_943_040,
      },
      scanner: { host: '127.0.0.1', port: 3310, timeoutMs: 5_000 },
      pendingSessionTtlSeconds: 86_400,
      deletion: { batchSize: 25, leaseSeconds: 60, backoffSeconds: 30, maxAttempts: 5, orphanGraceSeconds: 86_400 },
    });
    expect(Object.isFrozen(registration)).toBe(true);
    expect(Object.isFrozen(registration.evidence.allowedMimeTypes)).toBe(true);
  });

  it.each([
    'REGISTRATION_EVIDENCE_PROVIDER', 'REGISTRATION_EVIDENCE_PRIVATE_ROOT', 'REGISTRATION_EVIDENCE_ALLOWED_MIME_TYPES',
    'REGISTRATION_EVIDENCE_MAX_ITEM_BYTES', 'REGISTRATION_EVIDENCE_MAX_REQUEST_BYTES', 'REGISTRATION_SCANNER_HOST',
    'REGISTRATION_SCANNER_PORT', 'REGISTRATION_SCANNER_TIMEOUT_MS', 'REGISTRATION_PENDING_SESSION_TTL_SECONDS',
    'REGISTRATION_DELETION_BATCH_SIZE', 'REGISTRATION_DELETION_LEASE_SECONDS', 'REGISTRATION_DELETION_BACKOFF_SECONDS',
    'REGISTRATION_DELETION_MAX_ATTEMPTS', 'REGISTRATION_ORPHAN_GRACE_SECONDS',
  ])('rejects missing %s', (name) => {
    expect(() => parseBackendEnvironment({ ...valid, [name]: undefined })).toThrow(`Invalid configuration: ${name}`);
  });

  it.each([
    ['REGISTRATION_EVIDENCE_ALLOWED_MIME_TYPES', 'application/pdf,image/jpeg'],
    ['REGISTRATION_EVIDENCE_ALLOWED_MIME_TYPES', 'application/pdf,image/jpeg,image/png,text/plain'],
    ['REGISTRATION_EVIDENCE_MAX_ITEM_BYTES', '10485761'], ['REGISTRATION_EVIDENCE_MAX_REQUEST_BYTES', '41943039'],
    ['REGISTRATION_SCANNER_PORT', '0'], ['REGISTRATION_SCANNER_TIMEOUT_MS', '0'],
    ['REGISTRATION_DELETION_BATCH_SIZE', '0'], ['REGISTRATION_DELETION_LEASE_SECONDS', '0'],
    ['REGISTRATION_DELETION_BACKOFF_SECONDS', '0'], ['REGISTRATION_DELETION_MAX_ATTEMPTS', '4'],
    ['REGISTRATION_ORPHAN_GRACE_SECONDS', '0'],
  ])('rejects unsafe %s', (name, value) => {
    expect(() => parseBackendEnvironment({ ...valid, [name]: value })).toThrow(`Invalid configuration: ${name}`);
  });

  it('requires a private encrypted S3-compatible destination in production', () => {
    const production = { ...valid, NODE_ENV: 'production', REGISTRATION_EVIDENCE_PROVIDER: 's3', REGISTRATION_EVIDENCE_PRIVATE_ROOT: undefined,
      REGISTRATION_EVIDENCE_S3_BUCKET: 'new-talents-private-evidence', REGISTRATION_EVIDENCE_S3_REGION: 'us-east-1',
      REGISTRATION_EVIDENCE_S3_ENCRYPTION: 'AES256' };
    expect(parseBackendEnvironment(production).registration.evidence).toMatchObject({ provider: 's3', bucket: 'new-talents-private-evidence', encryption: 'AES256' });
    expect(() => parseBackendEnvironment({ ...production, REGISTRATION_EVIDENCE_S3_ENCRYPTION: undefined })).toThrow('Invalid configuration: REGISTRATION_EVIDENCE_S3_ENCRYPTION');
    expect(() => parseBackendEnvironment({ ...valid, NODE_ENV: 'production' })).toThrow('Invalid configuration: REGISTRATION_EVIDENCE_PROVIDER');
  });

  it('rejects roots that are relative, look public, or target a broad filesystem location', () => {
    for (const root of ['relative/evidence', 'C:/project/public/evidence', 'C:/project/static/evidence', '/', 'C:/']) {
      expect(() => parseBackendEnvironment({ ...valid, REGISTRATION_EVIDENCE_PRIVATE_ROOT: root })).toThrow('Invalid configuration: REGISTRATION_EVIDENCE_PRIVATE_ROOT');
    }
  });
});
