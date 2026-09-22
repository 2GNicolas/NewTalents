import { z } from 'zod';

import { parsePassportKey } from '../player-passport/player-private-identity/passport-keys.js';

const placeholders = new Set(['__REQUIRED__', 'CHANGE_ME']);

function required(name: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || placeholders.has(value.trim())) {
    throw new Error(`Invalid configuration: ${name}`);
  }
  return value.trim();
}

function parsePort(value: unknown): number {
  const raw = required('PORT', value);
  if (!/^\d+$/.test(raw)) throw new Error('Invalid configuration: PORT');
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('Invalid configuration: PORT');
  return port;
}

function parseDatabaseUrl(value: unknown): string {
  const raw = required('DATABASE_URL', value);
  try {
    const url = new URL(raw);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.username || !url.password || !url.pathname || url.pathname === '/') {
      throw new Error();
    }
    return raw;
  } catch {
    throw new Error('Invalid configuration: DATABASE_URL');
  }
}

function parseExactPositiveInteger(name: string, value: unknown, expected: number): number {
  const raw = required(name, value);
  if (!/^\d+$/.test(raw) || Number(raw) !== expected) throw new Error(`Invalid configuration: ${name}`);
  return expected;
}

function parseSigningSecret(value: unknown): string {
  const secret = required('JWT_SIGNING_SECRET', value);
  if (secret.length < 32) throw new Error('Invalid configuration: JWT_SIGNING_SECRET');
  return secret;
}

function parseTrustedProxy(value: unknown): boolean {
  const raw = required('AUTH_TRUSTED_PROXY', value).toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error('Invalid configuration: AUTH_TRUSTED_PROXY');
}

export function parseAllowedOrigins(value: unknown): readonly string[] {
  const raw = required('ALLOWED_ORIGINS', value);
  const origins = raw.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (origins.length === 0 || origins.includes('*')) throw new Error('Invalid configuration: ALLOWED_ORIGINS');
  try {
    for (const origin of origins) {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.username || url.password) throw new Error();
    }
  } catch {
    throw new Error('Invalid configuration: ALLOWED_ORIGINS');
  }
  return Object.freeze(origins);
}

const nodeEnvironmentSchema = z.enum(['development', 'test', 'production']);

export type BackendRuntimeConfiguration = Readonly<{
  nodeEnv: z.infer<typeof nodeEnvironmentSchema>;
  port: number;
  databaseUrl: string;
  allowedOrigins: readonly string[];
  authentication: Readonly<{
    issuer: string;
    audience: string;
    signingSecret: string;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
    temporaryCredentialTtlSeconds: number;
    attemptLimit: number;
    attemptWindowSeconds: number;
    trustedProxy: boolean;
    sessionRetentionDays: number;
    attemptRetentionHours: number;
  }>;
  passport: Readonly<{
    documentHmacKey: string;
    nameDobHmacKey: string;
    privateEncryptionKey: string;
  }>;
}>;

export function parseBackendEnvironment(environment: Record<string, unknown>): BackendRuntimeConfiguration {
  const rawNodeEnvironment = required('NODE_ENV', environment.NODE_ENV);
  const parsedNodeEnvironment = nodeEnvironmentSchema.safeParse(rawNodeEnvironment);
  if (!parsedNodeEnvironment.success) throw new Error('Invalid configuration: NODE_ENV');
  const authentication = Object.freeze({
    issuer: required('JWT_ISSUER', environment.JWT_ISSUER),
    audience: required('JWT_AUDIENCE', environment.JWT_AUDIENCE),
    signingSecret: parseSigningSecret(environment.JWT_SIGNING_SECRET),
    accessTokenTtlSeconds: parseExactPositiveInteger('AUTH_ACCESS_TOKEN_TTL_SECONDS', environment.AUTH_ACCESS_TOKEN_TTL_SECONDS, 900),
    refreshTokenTtlSeconds: parseExactPositiveInteger('AUTH_REFRESH_TOKEN_TTL_SECONDS', environment.AUTH_REFRESH_TOKEN_TTL_SECONDS, 2_592_000),
    temporaryCredentialTtlSeconds: parseExactPositiveInteger('AUTH_TEMPORARY_CREDENTIAL_TTL_SECONDS', environment.AUTH_TEMPORARY_CREDENTIAL_TTL_SECONDS, 86_400),
    attemptLimit: parseExactPositiveInteger('AUTH_ATTEMPT_LIMIT', environment.AUTH_ATTEMPT_LIMIT, 5),
    attemptWindowSeconds: parseExactPositiveInteger('AUTH_ATTEMPT_WINDOW_SECONDS', environment.AUTH_ATTEMPT_WINDOW_SECONDS, 900),
    trustedProxy: parseTrustedProxy(environment.AUTH_TRUSTED_PROXY),
    sessionRetentionDays: parseExactPositiveInteger('AUTH_SESSION_RETENTION_DAYS', environment.AUTH_SESSION_RETENTION_DAYS, 90),
    attemptRetentionHours: parseExactPositiveInteger('AUTH_ATTEMPT_RETENTION_HOURS', environment.AUTH_ATTEMPT_RETENTION_HOURS, 24),
  });
  const passport = Object.freeze({
    documentHmacKey: parsePassportKey('PASSPORT_DOCUMENT_HMAC_KEY', environment.PASSPORT_DOCUMENT_HMAC_KEY),
    nameDobHmacKey: parsePassportKey('PASSPORT_NAME_DOB_HMAC_KEY', environment.PASSPORT_NAME_DOB_HMAC_KEY),
    privateEncryptionKey: parsePassportKey('PASSPORT_PRIVATE_ENCRYPTION_KEY', environment.PASSPORT_PRIVATE_ENCRYPTION_KEY),
  });
  return Object.freeze({
    nodeEnv: parsedNodeEnvironment.data,
    port: parsePort(environment.PORT),
    databaseUrl: parseDatabaseUrl(environment.DATABASE_URL),
    allowedOrigins: parseAllowedOrigins(environment.ALLOWED_ORIGINS),
    authentication,
    passport,
  });
}
