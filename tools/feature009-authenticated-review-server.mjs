import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import argon2 from 'argon2';
import dotenv from 'dotenv';
import pg from 'pg';

const root = resolve(import.meta.dirname, '..');
const backend = resolve(root, 'apps/backend');
const frontend = resolve(root, 'apps/frontend');
dotenv.config({ path: resolve(backend, '.env'), quiet: true });
const source = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) throw new Error('Local PostgreSQL required');
const dbName = `newtalents_feature009_visual_${randomBytes(6).toString('hex')}`;
const adminUrl = new URL(source);
adminUrl.pathname = '/postgres';
const testUrl = new URL(source);
testUrl.pathname = `/${dbName}`;
const require = createRequire(import.meta.url);
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const ownerId = randomUUID();
const playerId = randomUUID();
const passportId = randomUUID();
const allowanceId = randomUUID();
const email = 'feature009.visual@example.test';
const password = 'Synthetic-Feature009-Review!';
const children = [];
let created = false;

async function awaitUrl(url, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { if ((await fetch(url)).ok) return; } catch { /* process not ready */ }
    await delay(400);
  }
  throw new Error(`Runtime not ready: ${url}`);
}

function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  child.on('error', (error) => process.stderr.write(`${error.message}\n`));
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on('data', (chunk) => {
      const line = String(chunk);
      if (/error|failed|exception/i.test(line)) process.stderr.write(line.slice(0, 500));
    });
  }
  return child;
}

try {
  for (const url of ['http://localhost:3000/health/live', 'http://localhost:8081']) {
    try { await awaitUrl(url, 600); throw new Error(`Port already in use: ${url}`); }
    catch (error) { if (String(error).includes('Port already in use')) throw error; }
  }
  await admin.connect();
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  const prismaCli = resolve(require.resolve('prisma/package.json'), '../build/index.js');
  const migrated = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: backend, env: { ...process.env, DATABASE_URL: testUrl.toString() }, stdio: 'ignore', windowsHide: true,
  });
  if (migrated.status !== 0) throw new Error(`Isolated migration failed: ${migrated.status}`);
  const db = new pg.Client({ connectionString: testUrl.toString() });
  try {
    await db.connect();
    const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19 * 1024, timeCost: 2, parallelism: 1 });
    await db.query('INSERT INTO "Identity" (id, "updatedAt") VALUES ($1, now())', [ownerId]);
    await db.query('INSERT INTO "RoleAssignment" (id, "identityId", role, "assignedByIdentityId") VALUES (gen_random_uuid(), $1, \'USER\', $1)', [ownerId]);
    await db.query('INSERT INTO "AuthenticationCredential" (id, "identityId", "normalizedEmail", "passwordHash", "activatedAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, now(), now())', [ownerId, email, hash]);
    await db.query('INSERT INTO "Player" (id, "updatedAt") VALUES ($1, now())', [playerId]);
    await db.query(`INSERT INTO "PlayerPassport" (id, "playerId", state, "originKind", position, "ageCategory", city,
      country, "dominantFoot", "createdByIdentityId", "updatedAt")
      VALUES ($1, $2, 'ACTIVE', 'PARTICULAR', 'Defensa', 'Sub-17', 'Bogota', 'Colombia', 'RIGHT', $3, now())`, [passportId, playerId, ownerId]);
    await db.query('INSERT INTO "PassportResponsibility" (id, "passportId", "identityId", kind) VALUES (gen_random_uuid(), $1, $2, \'SELF\')', [passportId, ownerId]);
    await db.query('INSERT INTO "PassportMatchAllowance" (id, "passportId", "activatedOn", "updatedAt") VALUES ($1, $2, $3::date, now())', [allowanceId, passportId, '2026-10-09']);
    await db.query(`INSERT INTO "PassportMatchAllowanceRevision"
      (id, "allowanceId", sequence, "idempotencyKey", "expectedVersion", cadence, "matchLimit", "effectiveOn", "confirmedByIdentityId")
      VALUES (gen_random_uuid(), $1, 1, $2, 0, 'QUARTERLY', 4, '2026-10-09'::date, $3)`, [allowanceId, randomUUID(), ownerId]);
  } finally { await db.end(); }
  start(process.execPath, [resolve(backend, 'dist/main.js')], backend,
    { ...process.env, DATABASE_URL: testUrl.toString(), PORT: '3000', NODE_ENV: 'development' });
  await awaitUrl('http://localhost:3000/health/live');
  start(process.execPath, [require.resolve('expo/bin/cli', { paths: [frontend] }), 'start', '--web', '--port', '8081'], frontend,
    { ...process.env, EXPO_PUBLIC_API_BASE_URL: 'http://localhost:3000', CI: '1' });
  await awaitUrl('http://localhost:8081');
  process.stdout.write(`READY ${passportId}\n`);
  await new Promise((finish) => { process.stdin.resume(); process.stdin.once('data', finish); });
} finally {
  for (const child of children) {
    child.kill();
    child.stdout?.destroy();
    child.stderr?.destroy();
  }
  await delay(1500);
  if (created) {
    await admin.query(`DROP DATABASE "${dbName}" WITH (FORCE)`);
    process.stdout.write(`REMOVED ${dbName}\n`);
  }
  await admin.end();
}
process.exit(0);
