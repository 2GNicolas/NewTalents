import { resolve } from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: resolve(import.meta.dirname, '../apps/backend/.env'), quiet: true });
const source = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) throw new Error('Local PostgreSQL required');
source.pathname = '/postgres';
const admin = new pg.Client({ connectionString: source.toString() });
try {
  await admin.connect();
  const names = (await admin.query('SELECT datname FROM pg_database WHERE datname LIKE $1 OR datname LIKE $2',
    ['newtalents_feature009_visual_%', 'newtalents_feature009_test_%'])).rows.map((row) => String(row.datname));
  for (const name of names) {
    if (!/^newtalents_feature009_(visual|test)_[a-f0-9]{12}$/.test(name)) throw new Error('Unexpected database name');
  }
  if (process.argv[2] === '--list') process.stdout.write(`${JSON.stringify(names)}\n`);
  else if (process.argv[2] === '--drop' && names.includes(process.argv[3])) {
    await admin.query(`DROP DATABASE "${process.argv[3]}" WITH (FORCE)`);
    process.stdout.write(`Removed ${process.argv[3]}\n`);
  } else throw new Error('Use --list or --drop with an exact listed database');
} finally { await admin.end(); }
