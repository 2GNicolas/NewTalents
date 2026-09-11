import { z } from 'zod';

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
}>;

export function parseBackendEnvironment(environment: Record<string, unknown>): BackendRuntimeConfiguration {
  const rawNodeEnvironment = required('NODE_ENV', environment.NODE_ENV);
  const parsedNodeEnvironment = nodeEnvironmentSchema.safeParse(rawNodeEnvironment);
  if (!parsedNodeEnvironment.success) throw new Error('Invalid configuration: NODE_ENV');
  return Object.freeze({
    nodeEnv: parsedNodeEnvironment.data,
    port: parsePort(environment.PORT),
    databaseUrl: parseDatabaseUrl(environment.DATABASE_URL),
    allowedOrigins: parseAllowedOrigins(environment.ALLOWED_ORIGINS),
  });
}
