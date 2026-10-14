import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ quiet: true });
const require = createRequire(import.meta.url);
const original = process.env.DATABASE_URL;
if (!original) throw new Error('DATABASE_URL is required');
const source = new URL(original);
if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) {
  throw new Error('Review-return migration checks require local PostgreSQL');
}
const databaseName = `newtalents_review_return_test_${randomBytes(6).toString('hex')}`;
if (!/^newtalents_review_return_test_[a-f0-9]{12}$/.test(databaseName) || source.pathname === `/${databaseName}`) {
  throw new Error('Unsafe isolated database name');
}
const adminUrl = new URL(original);
adminUrl.pathname = '/postgres';
const testUrl = new URL(original);
testUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
let created = false;

function run(packageName, relativeCli, args) {
  const directory = dirname(require.resolve(`${packageName}/package.json`));
  const result = spawnSync(process.execPath, [join(directory, relativeCli), ...args], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: testUrl.toString() }, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${packageName} exited ${result.status}`);
}

try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  console.log(`Created isolated ${databaseName}`);
  run('prisma', 'build/index.js', ['migrate', 'deploy']);
  for (const suite of [
    'test/integration/passport-review-return-migration.integration.spec.ts',
    'test/contract/passport-lifecycle.contract-spec.ts',
    'test/integration/passport-lifecycle.e2e-spec.ts',
  ]) {
    run('vitest', 'vitest.mjs', ['run', suite, '--maxWorkers=1']);
  }
} finally {
  if (created) {
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    console.log(`Removed isolated ${databaseName}`);
  }
  await admin.end().catch(() => undefined);
}
