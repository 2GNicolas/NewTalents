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
  throw new Error('Feature 009 checks require local PostgreSQL');
}
const databaseName = `newtalents_feature009_test_${randomBytes(6).toString('hex')}`;
if (!/^newtalents_feature009_test_[a-f0-9]{12}$/.test(databaseName) || source.pathname === `/${databaseName}`) {
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
  // These checks are intentionally sequential, never parallel against PostgreSQL.
  const suites = [
    'test/integration/first-match-foundation.integration.spec.ts',
    'test/integration/first-match-scheduling.integration.spec.ts',
    'test/integration/first-match-correction.integration.spec.ts',
    'test/integration/admin-passport-allowance-first-match.integration.spec.ts',
    'test/integration/first-match-load.integration.spec.ts',
    'test/integration/first-match-concurrency.integration.spec.ts',
    'test/contract/first-match-privacy.contract.spec.ts',
  ];
  const selected = process.argv[2];
  if (selected && !suites.includes(selected) && !['--all-contracts', '--all-integration'].includes(selected))
    throw new Error('Unknown isolated test selection');
  if (selected === '--all-contracts') {
    run('vitest', 'vitest.mjs', ['run', 'test/contract', '--maxWorkers=1']);
  } else if (selected === '--all-integration') {
    run('vitest', 'vitest.mjs', ['run', 'test/integration', '--exclude', 'test/integration/postgresql-persistence.e2e-spec.ts', '--maxWorkers=1']);
  } else {
    for (const suite of suites) {
      if (!selected || selected === suite) run('vitest', 'vitest.mjs', ['run', suite, '--maxWorkers=1']);
    }
  }
} finally {
  if (created) {
    try {
      await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    } catch {
      // A failing suite may reset this connection; reconnect to remove only its exact temporary database.
      const cleanup = new pg.Client({ connectionString: adminUrl.toString() });
      await cleanup.connect();
      try {
        const exists = await cleanup.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
        if (exists.rowCount) await cleanup.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      } finally { await cleanup.end(); }
    }
    console.log(`Removed isolated ${databaseName}`);
  }
  await admin.end().catch(() => undefined);
}
