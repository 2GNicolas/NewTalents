import { describe, expect, it } from 'vitest';

import { parseBackendEnvironment } from './environment.schema.js';

const valid = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://tester:password@localhost:5433/new_talents_test',
  ALLOWED_ORIGINS: 'http://localhost:8081,https://example.test',
};

describe('parseBackendEnvironment', () => {
  it('returns an immutable typed configuration', () => {
    const configuration = parseBackendEnvironment(valid);
    expect(configuration).toEqual({
      nodeEnv: 'test',
      port: 3000,
      databaseUrl: valid.DATABASE_URL,
      allowedOrigins: ['http://localhost:8081', 'https://example.test'],
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
});
