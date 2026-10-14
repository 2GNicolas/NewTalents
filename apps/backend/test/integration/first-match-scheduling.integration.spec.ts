import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient } from '../../src/generated/prisma/client.js';
import { FirstMatchAccess } from '../../src/first-match/application/first-match-access.js';
import { FirstMatchCommand } from '../../src/first-match/application/first-match-command.js';
import { FirstMatchQuery } from '../../src/first-match/application/first-match-query.js';
import { FirstMatchRepository } from '../../src/first-match/persistence/first-match.repository.js';
import { AllowanceTransactionRunner } from '../../src/passport-match-allowance/persistence/allowance-transaction.runner.js';
import { createFirstMatchFixture, insertSyntheticFirstMatch } from '../first-match-test-helpers.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const repository = new FirstMatchRepository(new AllowanceTransactionRunner(prisma as never, async () => undefined));
const access = new FirstMatchAccess();
const command = new FirstMatchCommand(repository, access);
const query = new FirstMatchQuery(repository, access);

const form: { expectedVersion: 0; matchDate: string; matchTime: string; opponent: string; competition: string; venue: string } = {
  expectedVersion: 0, matchDate: '2026-02-27', matchTime: '10:00',
  opponent: 'Rival sintetico', competition: 'Liga sintetica', venue: 'Cancha sintetica',
};
const schedule = (passportId: string, actorIdentityId: string, overrides: Partial<typeof form & { idempotencyKey: string }> = {}) =>
  command.schedule({ passportId, actorIdentityId, idempotencyKey: randomUUID(), ...form, ...overrides });

describe('Feature 009 authorized first-match scheduling on isolated PostgreSQL', () => {
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature009_test_[a-f0-9]{12}$/);
    await prisma.$queryRaw`SELECT 1`;
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('schedules without Analyst custody, persists one RESERVED unit and replays the same intent', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client, { limit: 2 });
      const key = randomUUID();
      const input = { passportId: f.passportId, actorIdentityId: f.ownerId, idempotencyKey: key, ...form };
      const first = await command.schedule(input);
      expect(first.outcome).toBe('applied');
      if (first.outcome !== 'applied') throw new Error('Expected applied schedule');
      expect(await command.schedule(input)).toMatchObject({ outcome: 'idempotent', matchId: first.matchId });
      expect(await command.schedule({ ...input, opponent: 'Otro rival' })).toMatchObject({ outcome: 'conflict' });
      expect(await schedule(f.passportId, f.ownerId)).toMatchObject({ outcome: 'conflict' });
      expect(await prisma.firstMatch.count({ where: { passportId: f.passportId } })).toBe(1);
      expect(await prisma.firstMatchIntent.count({ where: { passportId: f.passportId } })).toBe(1);
      const current = await prisma.firstMatch.findFirstOrThrow({ where: { passportId: f.passportId } });
      expect(current).toMatchObject({ playerId: f.playerId, scheduledByIdentityId: f.ownerId,
        state: 'WAITING', unitState: 'RESERVED', version: 1 });
      const flow = await query.get({ passportId: f.passportId, actorIdentityId: f.ownerId });
      expect(flow).toMatchObject({ outcome: 'ok', flow: { state: 'WAITING', match: { id: first.matchId } } });
      expect(JSON.stringify(flow)).not.toMatch(/scheduledByIdentityId|loadedByAnalystIdentityId|playerId|evidence/);
      expect(await query.preview({ passportId: f.passportId, actorIdentityId: f.ownerId, matchDate: form.matchDate }))
        .toMatchObject({ outcome: 'ok', availability: { reserved: 1, used: 0, available: 1 } });
    } finally { client.release(); }
  });

  it('denies absent or revoked responsibility and inactive passports without creating a match', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client);
      expect(await schedule(f.passportId, f.analystId)).toMatchObject({ outcome: 'not-found' });
      expect(await query.get({ passportId: f.passportId, actorIdentityId: f.analystId })).toMatchObject({ outcome: 'not-found' });
      await client.query('DELETE FROM "PassportResponsibility" WHERE "passportId" = $1', [f.passportId]);
      expect(await schedule(f.passportId, f.ownerId)).toMatchObject({ outcome: 'not-found' });
      await client.query(`INSERT INTO "PassportResponsibility" (id, "passportId", "identityId", kind)
        VALUES (gen_random_uuid(), $1, $2, 'SELF')`, [f.passportId, f.ownerId]);
      await client.query(`UPDATE "PlayerPassport" SET state = 'DRAFT', "updatedAt" = now() WHERE id = $1`, [f.passportId]);
      expect(await schedule(f.passportId, f.ownerId)).toMatchObject({ outcome: 'ineligible' });
      expect(await prisma.firstMatch.count({ where: { passportId: f.passportId } })).toBe(0);
    } finally { client.release(); }
  });

  it('admits a current academy member for the responsible academy, then revokes access when membership ends', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client);
      const academyId = randomUUID();
      const academyUserId = randomUUID();
      await client.query('INSERT INTO "Academy" (id) VALUES ($1)', [academyId]);
      await client.query('INSERT INTO "Identity" (id, "updatedAt") VALUES ($1, now())', [academyUserId]);
      await client.query(`INSERT INTO "RoleAssignment" (id, "identityId", role, "assignedByIdentityId")
        VALUES (gen_random_uuid(), $1, 'ACADEMY_USER', $1)`, [academyUserId]);
      await client.query(`INSERT INTO "AcademyMembership" (id, "identityId", "academyId", status, "assignedByIdentityId")
        VALUES (gen_random_uuid(), $1, $2, 'ACTIVE', $1)`, [academyUserId, academyId]);
      await client.query(`UPDATE "PlayerPassport" SET "originKind" = 'ACADEMY', "originAcademyId" = $2, "updatedAt" = now() WHERE id = $1`, [f.passportId, academyId]);
      await client.query(`INSERT INTO "PassportResponsibility" (id, "passportId", "academyId", kind)
        VALUES (gen_random_uuid(), $1, $2, 'ACADEMY')`, [f.passportId, academyId]);
      expect(await query.get({ passportId: f.passportId, actorIdentityId: academyUserId })).toMatchObject({ outcome: 'ok' });
      await client.query(`UPDATE "AcademyMembership" SET status = 'ENDED' WHERE "identityId" = $1`, [academyUserId]);
      expect(await schedule(f.passportId, academyUserId)).toMatchObject({ outcome: 'not-found' });
    } finally { client.release(); }
  });

  it('distinguishes unconfigured and full periods, counts USED, and follows the 31st-day boundary', async () => {
    const client = await pool.connect();
    try {
      const missing = await createFirstMatchFixture(client);
      // An allowance with no applicable rule is represented by a date before activation.
      expect(await schedule(missing.passportId, missing.ownerId, { matchDate: '2026-01-30' }))
        .toMatchObject({ outcome: 'no-allowance' });
      const f = await createFirstMatchFixture(client, { limit: 1, withCustody: true });
      const preview = await query.preview({ passportId: f.passportId, actorIdentityId: f.ownerId, matchDate: '2026-02-28' });
      expect(preview).toMatchObject({ outcome: 'ok', availability: { periodStart: '2026-02-28', periodEndExclusive: '2026-03-31' } });
      await insertSyntheticFirstMatch(client, f, { date: '2026-02-28', state: 'LOADED' });
      expect(await schedule(f.passportId, f.ownerId, { matchDate: '2026-02-28' })).toMatchObject({ outcome: 'conflict' });
      expect(await query.preview({ passportId: f.passportId, actorIdentityId: f.ownerId, matchDate: '2026-02-28' }))
        .toMatchObject({ outcome: 'ok', availability: { reserved: 0, used: 1, available: 0 } });
      const empty = await createFirstMatchFixture(client, { limit: 1 });
      await insertSyntheticFirstMatch(client, empty, { date: '2026-02-27', state: 'CANCELED' });
      expect(await schedule(empty.passportId, empty.ownerId, { matchDate: '2026-02-27' })).toMatchObject({ outcome: 'applied' });
    } finally { client.release(); }
  });

  it('serializes concurrent last-slot requests and rolls back invalid or over-capacity attempts', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client, { limit: 1 });
      const attempts = await Promise.all([schedule(f.passportId, f.ownerId), schedule(f.passportId, f.ownerId)]);
      expect(attempts.filter((item) => item.outcome === 'applied')).toHaveLength(1);
      expect(attempts.filter((item) => item.outcome === 'conflict')).toHaveLength(1);
      expect(await prisma.firstMatch.count({ where: { passportId: f.passportId } })).toBe(1);
      expect(await prisma.firstMatchIntent.count({ where: { passportId: f.passportId } })).toBe(1);
      const other = await createFirstMatchFixture(client, { limit: 1 });
      expect(await schedule(other.passportId, other.ownerId, { matchDate: 'bad-date' })).toMatchObject({ outcome: 'invalid' });
      expect(await prisma.firstMatch.count({ where: { passportId: other.passportId } })).toBe(0);
    } finally { client.release(); }
  });
});
