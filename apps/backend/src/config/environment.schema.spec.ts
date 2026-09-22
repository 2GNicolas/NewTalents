import { describe, expect, it } from 'vitest';

import { parseBackendEnvironment } from './environment.schema.js';
import { safeStartupDiagnostic } from './safe-diagnostic.js';

const valid = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://tester:password@localhost:5433/new_talents_test',
  ALLOWED_ORIGINS: 'http://localhost:8081,https://example.test',
  JWT_ISSUER: 'new-talents.test',
  JWT_AUDIENCE: 'new-talents-client',
  JWT_SIGNING_SECRET: 'test-signing-secret-that-is-long-enough-to-be-safe',
  AUTH_ACCESS_TOKEN_TTL_SECONDS: '900',
  AUTH_REFRESH_TOKEN_TTL_SECONDS: '2592000',
  AUTH_TEMPORARY_CREDENTIAL_TTL_SECONDS: '86400',
  AUTH_ATTEMPT_LIMIT: '5',
  AUTH_ATTEMPT_WINDOW_SECONDS: '900',
  AUTH_TRUSTED_PROXY: 'false',
  AUTH_SESSION_RETENTION_DAYS: '90',
  AUTH_ATTEMPT_RETENTION_HOURS: '24',
  PASSPORT_DOCUMENT_HMAC_KEY: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
  PASSPORT_NAME_DOB_HMAC_KEY: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=',
  PASSPORT_PRIVATE_ENCRYPTION_KEY: 'AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM=',
};

describe('parseBackendEnvironment', () => {
  it('returns an immutable typed configuration', () => {
    const configuration = parseBackendEnvironment(valid);
    expect(configuration).toEqual({
      nodeEnv: 'test',
      port: 3000,
      databaseUrl: valid.DATABASE_URL,
      allowedOrigins: ['http://localhost:8081', 'https://example.test'],
      authentication: {
        issuer: valid.JWT_ISSUER,
        audience: valid.JWT_AUDIENCE,
        signingSecret: valid.JWT_SIGNING_SECRET,
        accessTokenTtlSeconds: 900,
        refreshTokenTtlSeconds: 2_592_000,
        temporaryCredentialTtlSeconds: 86_400,
        attemptLimit: 5,
        attemptWindowSeconds: 900,
        trustedProxy: false,
        sessionRetentionDays: 90,
        attemptRetentionHours: 24,
      },
      passport: {
        documentHmacKey: valid.PASSPORT_DOCUMENT_HMAC_KEY,
        nameDobHmacKey: valid.PASSPORT_NAME_DOB_HMAC_KEY,
        privateEncryptionKey: valid.PASSPORT_PRIVATE_ENCRYPTION_KEY,
      },
    });
    expect(Object.isFrozen(configuration)).toBe(true);
    expect(Object.isFrozen(configuration.allowedOrigins)).toBe(true);
  });

  it.each(['development', 'test', 'production'])('accepts NODE_ENV=%s', (nodeEnv) => {
    expect(parseBackendEnvironment({ ...valid, NODE_ENV: nodeEnv }).nodeEnv).toBe(nodeEnv);
  });

  it.each([
    ['NODE_ENV', undefined], ['NODE_ENV', ''], ['NODE_ENV', 'staging'],
    ['PORT', undefined], ['PORT', ''], ['PORT', '0'], ['PORT', '65536'], ['PORT', '3.5'],
    ['DATABASE_URL', undefined], ['DATABASE_URL', ''], ['DATABASE_URL', '__REQUIRED__'],
    ['DATABASE_URL', 'https://user:pass@example.test/db'],
    ['DATABASE_URL', 'postgresql://localhost/db'], ['DATABASE_URL', 'postgresql://u:p@localhost'],
    ['ALLOWED_ORIGINS', undefined], ['ALLOWED_ORIGINS', ''], ['ALLOWED_ORIGINS', '*'],
    ['ALLOWED_ORIGINS', 'localhost:8081'], ['ALLOWED_ORIGINS', '__REQUIRED__'],
  ])('rejects invalid %s without echoing its value', (name, value) => {
    const environment: Record<string, string | undefined> = { ...valid, [name]: value };
    let message = '';
    try { parseBackendEnvironment(environment); } catch (error) { message = (error as Error).message; }
    expect(message).toContain(name);
    if (value && !['0', '65536', '3.5', '*'].includes(value)) expect(message).not.toContain(value);
  });

  it.each([
    ['JWT_ISSUER', undefined], ['JWT_ISSUER', '__REQUIRED__'],
    ['JWT_AUDIENCE', undefined], ['JWT_AUDIENCE', 'CHANGE_ME'],
    ['JWT_SIGNING_SECRET', undefined], ['JWT_SIGNING_SECRET', 'short'],
    ['AUTH_ACCESS_TOKEN_TTL_SECONDS', '901'],
    ['AUTH_REFRESH_TOKEN_TTL_SECONDS', '2592001'],
    ['AUTH_TEMPORARY_CREDENTIAL_TTL_SECONDS', '86401'],
    ['AUTH_ATTEMPT_LIMIT', '6'], ['AUTH_ATTEMPT_WINDOW_SECONDS', '901'],
    ['AUTH_TRUSTED_PROXY', 'sometimes'],
    ['AUTH_SESSION_RETENTION_DAYS', '91'], ['AUTH_ATTEMPT_RETENTION_HOURS', '25'],
  ])('fails closed for invalid authentication setting %s', (name, value) => {
    expect(() => parseBackendEnvironment({ ...valid, [name]: value })).toThrow(`Invalid configuration: ${name}`);
  });

  it.each([
    ['PASSPORT_DOCUMENT_HMAC_KEY', undefined],
    ['PASSPORT_DOCUMENT_HMAC_KEY', ''],
    ['PASSPORT_DOCUMENT_HMAC_KEY', '__REQUIRED__'],
    ['PASSPORT_DOCUMENT_HMAC_KEY', 'CHANGE_ME'],
    ['PASSPORT_DOCUMENT_HMAC_KEY', 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE'],
    ['PASSPORT_DOCUMENT_HMAC_KEY', 'not-a-valid-base64-key!'],
    ['PASSPORT_NAME_DOB_HMAC_KEY', undefined],
    ['PASSPORT_NAME_DOB_HMAC_KEY', '__REQUIRED__'],
    ['PASSPORT_NAME_DOB_HMAC_KEY', 'not-a-valid-base64-key!'],
    ['PASSPORT_PRIVATE_ENCRYPTION_KEY', undefined],
    ['PASSPORT_PRIVATE_ENCRYPTION_KEY', 'CHANGE_ME'],
    ['PASSPORT_PRIVATE_ENCRYPTION_KEY', 'not-a-valid-base64-key!'],
  ])('fails closed for invalid passport key %s', (name, value) => {
    expect(() => parseBackendEnvironment({ ...valid, [name]: value })).toThrow(`Invalid configuration: ${name}`);
  });

  it('uses a generic safe diagnostic and never echoes secret values', () => {
    const secret = 'do-not-expose-this-signing-secret';
    const diagnostic = safeStartupDiagnostic(new Error(`Invalid configuration: JWT_SIGNING_SECRET (${secret})`));
    expect(diagnostic).toContain('JWT_SIGNING_SECRET');
    expect(diagnostic).not.toContain(secret);
    expect(safeStartupDiagnostic(new Error(secret))).toBe('Backend startup failed');
  });
});
