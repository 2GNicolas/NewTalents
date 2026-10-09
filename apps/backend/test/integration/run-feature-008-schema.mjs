import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ quiet: true });
const require = createRequire(import.meta.url);

const original = process.env.DATABASE_URL;
if (!original) throw new Error('DATABASE_URL is required for the isolated Feature 008 test');

const baseUrl = new URL(original);
if (!['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname)) {
  throw new Error('Feature 008 isolated test requires a local PostgreSQL server');
}
const adminUrl = new URL(original);
adminUrl.pathname = '/postgres';
const databaseName = `newtalents_feature008_test_${randomBytes(6).toString('hex')}`;
if (!/^newtalents_feature008_test_[a-f0-9]{12}$/.test(databaseName)
    || baseUrl.pathname === `/${databaseName}`) {
  throw new Error('Unsafe isolated database name');
}

const testUrl = new URL(original);
testUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
let created = false;

function run(packageName, relativeCli, args) {
  const packageDirectory = dirname(require.resolve(`${packageName}/package.json`));
  const result = spawnSync(process.execPath, [join(packageDirectory, relativeCli), ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${packageName} failed with status ${result.status}`);
}

function checkFeatureDrift() {
  const prismaCli = join(dirname(require.resolve('prisma/package.json')), 'build/index.js');
  const result = spawnSync(process.execPath, [
    prismaCli, 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma',
  ], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    encoding: 'utf8',
  });
  if (result.error || result.status !== 0 || /PassportMatchAllowance/.test(result.stdout)) {
    throw new Error('Feature 008 migration differs from the Prisma schema');
  }
  console.log('Feature 008 migration and Prisma schema agree (pre-existing unrelated drift ignored)');
}

try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  console.log(`Created isolated database ${databaseName}`);

  run('prisma', 'build/index.js', ['migrate', 'deploy']);
  checkFeatureDrift();
  for (const test of [
    'test/integration/passport-match-allowance-schema.integration.spec.ts',
    'test/integration/admin-passport-allowance-create.integration.spec.ts',
    'test/integration/admin-passport-allowance-update.integration.spec.ts',
    'test/integration/admin-passport-allowance-periods.integration.spec.ts',
  ]) {
    run('vitest', 'vitest.mjs', ['run', test]);
  }
} finally {
  if (created) {
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    console.log(`Removed isolated database ${databaseName}`);
  }
  await admin.end();
}
