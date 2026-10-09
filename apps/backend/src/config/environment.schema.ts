import { z } from 'zod';
import { isAbsolute, parse as parsePath } from 'node:path';

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

function parsePositiveInteger(name: string, value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
  const raw = required(name, value);
  if (!/^\d+$/.test(raw)) throw new Error(`Invalid configuration: ${name}`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw new Error(`Invalid configuration: ${name}`);
  return parsed;
}

const approvedEvidenceMimeTypes = Object.freeze(['application/pdf', 'image/jpeg', 'image/png'] as const);

function parseEvidenceMimeTypes(value: unknown): readonly string[] {
  const mimeTypes = required('REGISTRATION_EVIDENCE_ALLOWED_MIME_TYPES', value).split(',').map((item) => item.trim()).filter(Boolean);
  const supplied = new Set(mimeTypes);
  if (supplied.size !== approvedEvidenceMimeTypes.length || approvedEvidenceMimeTypes.some((mime) => !supplied.has(mime))) {
    throw new Error('Invalid configuration: REGISTRATION_EVIDENCE_ALLOWED_MIME_TYPES');
  }
  return Object.freeze([...approvedEvidenceMimeTypes]);
}

function parsePrivateRoot(value: unknown): string {
  const root = required('REGISTRATION_EVIDENCE_PRIVATE_ROOT', value).replaceAll('\\', '/');
  const filesystemRoot = parsePath(root).root.replaceAll('\\', '/');
  if (!isAbsolute(root) || root === filesystemRoot || /(^|\/)(public|static|assets)(\/|$)/i.test(root)) {
    throw new Error('Invalid configuration: REGISTRATION_EVIDENCE_PRIVATE_ROOT');
  }
  return root;
}

function parseRegistrationConfiguration(environment: Record<string, unknown>, nodeEnv: z.infer<typeof nodeEnvironmentSchema>) {
  const provider = required('REGISTRATION_EVIDENCE_PROVIDER', environment.REGISTRATION_EVIDENCE_PROVIDER);
  if (provider !== 'local' && provider !== 's3') throw new Error('Invalid configuration: REGISTRATION_EVIDENCE_PROVIDER');
  if (nodeEnv === 'production' && provider !== 's3') throw new Error('Invalid configuration: REGISTRATION_EVIDENCE_PROVIDER');

  const evidence = provider === 'local'
    ? Object.freeze({
        provider: 'local' as const,
        privateRoot: parsePrivateRoot(environment.REGISTRATION_EVIDENCE_PRIVATE_ROOT),
        bucket: null,
        region: null,
        encryption: null,
        allowedMimeTypes: parseEvidenceMimeTypes(environment.REGISTRATION_EVIDENCE_ALLOWED_MIME_TYPES),
        maxItemBytes: parseExactPositiveInteger('REGISTRATION_EVIDENCE_MAX_ITEM_BYTES', environment.REGISTRATION_EVIDENCE_MAX_ITEM_BYTES, 10_485_760),
        maxRequestBytes: parseExactPositiveInteger('REGISTRATION_EVIDENCE_MAX_REQUEST_BYTES', environment.REGISTRATION_EVIDENCE_MAX_REQUEST_BYTES, 41_943_040),
      })
    : Object.freeze({
        provider: 's3' as const,
        privateRoot: null,
        bucket: required('REGISTRATION_EVIDENCE_S3_BUCKET', environment.REGISTRATION_EVIDENCE_S3_BUCKET),
        region: required('REGISTRATION_EVIDENCE_S3_REGION', environment.REGISTRATION_EVIDENCE_S3_REGION),
        encryption: (() => {
          const encryption = required('REGISTRATION_EVIDENCE_S3_ENCRYPTION', environment.REGISTRATION_EVIDENCE_S3_ENCRYPTION);
          if (encryption !== 'AES256' && encryption !== 'aws:kms') throw new Error('Invalid configuration: REGISTRATION_EVIDENCE_S3_ENCRYPTION');
          return encryption as 'AES256' | 'aws:kms';
        })(),
        allowedMimeTypes: parseEvidenceMimeTypes(environment.REGISTRATION_EVIDENCE_ALLOWED_MIME_TYPES),
        maxItemBytes: parseExactPositiveInteger('REGISTRATION_EVIDENCE_MAX_ITEM_BYTES', environment.REGISTRATION_EVIDENCE_MAX_ITEM_BYTES, 10_485_760),
        maxRequestBytes: parseExactPositiveInteger('REGISTRATION_EVIDENCE_MAX_REQUEST_BYTES', environment.REGISTRATION_EVIDENCE_MAX_REQUEST_BYTES, 41_943_040),
      });

  return Object.freeze({
    evidence,
    scanner: Object.freeze({
      host: required('REGISTRATION_SCANNER_HOST', environment.REGISTRATION_SCANNER_HOST),
      port: parsePositiveInteger('REGISTRATION_SCANNER_PORT', environment.REGISTRATION_SCANNER_PORT, 65_535),
      timeoutMs: parsePositiveInteger('REGISTRATION_SCANNER_TIMEOUT_MS', environment.REGISTRATION_SCANNER_TIMEOUT_MS, 60_000),
    }),
    pendingSessionTtlSeconds: parseExactPositiveInteger('REGISTRATION_PENDING_SESSION_TTL_SECONDS', environment.REGISTRATION_PENDING_SESSION_TTL_SECONDS, 86_400),
    deletion: Object.freeze({
      batchSize: parsePositiveInteger('REGISTRATION_DELETION_BATCH_SIZE', environment.REGISTRATION_DELETION_BATCH_SIZE, 100),
      leaseSeconds: parsePositiveInteger('REGISTRATION_DELETION_LEASE_SECONDS', environment.REGISTRATION_DELETION_LEASE_SECONDS, 3_600),
      backoffSeconds: parsePositiveInteger('REGISTRATION_DELETION_BACKOFF_SECONDS', environment.REGISTRATION_DELETION_BACKOFF_SECONDS, 3_600),
      maxAttempts: parseExactPositiveInteger('REGISTRATION_DELETION_MAX_ATTEMPTS', environment.REGISTRATION_DELETION_MAX_ATTEMPTS, 5),
      orphanGraceSeconds: parsePositiveInteger('REGISTRATION_ORPHAN_GRACE_SECONDS', environment.REGISTRATION_ORPHAN_GRACE_SECONDS),
    }),
  });
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
  registration: Readonly<{
    evidence: Readonly<{
      provider: 'local' | 's3'; privateRoot: string | null; bucket: string | null; region: string | null;
      encryption: 'AES256' | 'aws:kms' | null; allowedMimeTypes: readonly string[]; maxItemBytes: number; maxRequestBytes: number;
    }>;
    scanner: Readonly<{ host: string; port: number; timeoutMs: number }>;
    pendingSessionTtlSeconds: number;
    deletion: Readonly<{ batchSize: number; leaseSeconds: number; backoffSeconds: number; maxAttempts: number; orphanGraceSeconds: number }>;
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
  const registration = parseRegistrationConfiguration(environment, parsedNodeEnvironment.data);
  return Object.freeze({
    nodeEnv: parsedNodeEnvironment.data,
    port: parsePort(environment.PORT),
    databaseUrl: parseDatabaseUrl(environment.DATABASE_URL),
    allowedOrigins: parseAllowedOrigins(environment.ALLOWED_ORIGINS),
    authentication,
    passport,
    registration,
  });
}
