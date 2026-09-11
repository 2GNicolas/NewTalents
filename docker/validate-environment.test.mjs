import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  validateEnvironmentFile,
  validatePostgresEnvironmentText,
} from './validate-environment.mjs';

const validEnvironment = `
POSTGRES_DB=new_talents
POSTGRES_USER=new_talents
POSTGRES_PASSWORD=local_only_password
POSTGRES_HOST_PORT=5433
`;

test('accepts explicit local PostgreSQL settings', () => {
  assert.deepEqual(validatePostgresEnvironmentText(validEnvironment), []);
});

test('rejects a missing environment file without exposing values', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'new-talents-env-'));
  try {
    const errors = await validateEnvironmentFile(join(directory, '.env'));
    assert.deepEqual(errors, ['Local PostgreSQL environment file is missing.']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

for (const field of ['POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_HOST_PORT']) {
  for (const invalidValue of ['', '__REQUIRED__', 'CHANGE_ME']) {
    test(`rejects ${field} when its value is not configured`, () => {
      const candidate = validEnvironment.replace(
        new RegExp(`^${field}=.*$`, 'm'),
        `${field}=${invalidValue}`,
      );
      const errors = validatePostgresEnvironmentText(candidate);
      assert.equal(errors.some((error) => error.includes(field)), true);
      assert.equal(errors.some((error) => error.includes('local_only_password')), false);
    });
  }
}

test('rejects absent required fields', () => {
  const errors = validatePostgresEnvironmentText('POSTGRES_DB=new_talents');
  assert.equal(errors.length, 3);
});

for (const port of ['abc', '1.5', '0', '65536', '-1']) {
  test(`rejects malformed or out-of-range port ${port}`, () => {
    const candidate = validEnvironment.replace('POSTGRES_HOST_PORT=5433', `POSTGRES_HOST_PORT=${port}`);
    assert.equal(validatePostgresEnvironmentText(candidate).length, 1);
  });
}
