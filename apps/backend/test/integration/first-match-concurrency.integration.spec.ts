import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthorizationService } from '../../src/authorization/authorization.service.js';
import { ConfirmedLoadService } from '../../src/first-match/application/confirmed-load.service.js';
import { FirstMatchAccess } from '../../src/first-match/application/first-match-access.js';
import { FirstMatchCommand } from '../../src/first-match/application/first-match-command.js';
import { FirstMatchRepository } from '../../src/first-match/persistence/first-match.repository.js';
import { PrismaClient, Prisma } from '../../src/generated/prisma/client.js';
import { AdministratorAllowanceAuthorization } from '../../src/passport-match-allowance/application/administrator-allowance-authorization.js';
import { AllowanceCommand } from '../../src/passport-match-allowance/application/allowance-command.js';
import { AllowanceTransactionRunner } from '../../src/passport-match-allowance/persistence/allowance-transaction.runner.js';
import { createFirstMatchFixture } from '../first-match-test-helpers.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const runner = new AllowanceTransactionRunner(prisma as never, async () => undefined);
const repository = new FirstMatchRepository(runner);
const booking = new FirstMatchCommand(repository, new FirstMatchAccess());
const load = new ConfirmedLoadService(repository);
const allowance = new AllowanceCommand(runner,
  new AdministratorAllowanceAuthorization(prisma as never, new AuthorizationService()),
  () => new Date('2026-02-10T16:00:00.000Z'));
const fields = { matchDate: '2026-02-28', matchTime: '10:00', opponent: 'Rival', competition: 'Liga', venue: 'Cancha' };
const schedule = (passportId: string, actorIdentityId: string, idempotencyKey = randomUUID()) =>
  booking.schedule({ passportId, actorIdentityId, expectedVersion: 0, idempotencyKey, ...fields });

describe('Feature 009 cross-command races on isolated PostgreSQL', () => {
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature009_test_[a-f0-9]{12}$/);
    await prisma.$executeRawUnsafe('CREATE TABLE "Feature009RaceConfirmedLoad" (match_id uuid NOT NULL, load_id uuid NOT NULL UNIQUE)');
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('serializes the last slot, same-key replay and stale distinct intentions without duplicate rows', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client, { limit: 1 });
      const key = randomUUID();
      const otherKey = randomUUID();
      const results = await Promise.all([schedule(f.passportId, f.ownerId, key),
        schedule(f.passportId, f.ownerId, otherKey)]);
      expect(results.filter((result) => result.outcome === 'applied')).toHaveLength(1);
      expect(results.filter((result) => result.outcome === 'conflict')).toHaveLength(1);
      expect(await prisma.firstMatch.count({ where: { passportId: f.passportId, unitState: 'RESERVED' } })).toBe(1);
      expect(await prisma.firstMatchIntent.count({ where: { passportId: f.passportId } })).toBe(1);
      const replayKey = results[0]?.outcome === 'applied' ? key : otherKey;
      expect(await schedule(f.passportId, f.ownerId, replayKey)).toMatchObject({ outcome: 'idempotent' });
      expect(await schedule(f.passportId, f.ownerId, randomUUID())).toMatchObject({ outcome: 'conflict' });
      expect(await prisma.firstMatchIntent.count({ where: { passportId: f.passportId } })).toBe(1);
    } finally { client.release(); }
  });

  it('isolates distinct passports rather than sharing one usage lock', async () => {
    const client = await pool.connect();
    try {
      const a = await createFirstMatchFixture(client, { limit: 1 });
      const b = await createFirstMatchFixture(client, { limit: 1 });
      const results = await Promise.all([schedule(a.passportId, a.ownerId), schedule(b.passportId, b.ownerId)]);
      expect(results.map((result) => result.outcome)).toEqual(['applied', 'applied']);
      expect(await prisma.firstMatch.count({ where: { passportId: { in: [a.passportId, b.passportId] }, unitState: 'RESERVED' } })).toBe(2);
    } finally { client.release(); }
  });

  it('serializes booking against a positive-limit allowance revision without partial version or unit writes', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client, { limit: 2 });
      await client.query(`INSERT INTO "RoleAssignment" (id, "identityId", role, "assignedByIdentityId")
        VALUES (gen_random_uuid(), $1, 'ADMINISTRATOR', $1)`, [f.ownerId]);
      const [booked, revised] = await Promise.all([
        schedule(f.passportId, f.ownerId),
        allowance.confirm({ passportId: f.passportId, administratorIdentityId: f.ownerId,
          expectedVersion: 1, idempotencyKey: randomUUID(), cadence: 'QUARTERLY', matchLimit: 1 }),
      ]);
      expect(booked.outcome).toBe('applied');
      expect(revised.outcome).toBe('applied');
      expect(await prisma.passportMatchAllowance.findUniqueOrThrow({ where: { passportId: f.passportId } }))
        .toMatchObject({ version: 2 });
      expect(await prisma.passportMatchAllowanceRevision.count({ where: { allowanceId: f.allowanceId } })).toBe(2);
      expect(await prisma.firstMatch.count({ where: { passportId: f.passportId, unitState: 'RESERVED' } })).toBe(1);
      expect(await repository.executeLocked(f.passportId, async (tx) =>
        repository.countPeriod(tx, await repository.loadAllowanceSource(tx, f.passportId), fields.matchDate)))
        .toMatchObject({ matchLimit: 1, reserved: 1, used: 0, available: 0 });
    } finally { client.release(); }
  });

  it('gives load, reschedule and cancellation a single winner; USED is never moved or released', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client, { withCustody: true, limit: 1 });
      const booked = await schedule(f.passportId, f.ownerId);
      if (!('matchId' in booked)) throw new Error('booking failed');
      const matchId = booked.matchId;
      const loadId = randomUUID();
      const operations = await Promise.allSettled([
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw(Prisma.sql`INSERT INTO "Feature009RaceConfirmedLoad" (match_id, load_id)
            VALUES (${matchId}::uuid, ${loadId}::uuid)`);
          return load.confirmFirstMatchDataLoad(tx, { passportId: f.passportId, matchId,
            analystIdentityId: f.analystId, loadId, expectedVersion: 1, confirmedAt: new Date() },
          async (sameTx, proof) => {
            const rows = await sameTx.$queryRaw<{ match_id: string; load_id: string }[]>(Prisma.sql`
              SELECT match_id, load_id FROM "Feature009RaceConfirmedLoad"
              WHERE match_id = ${proof.matchId}::uuid AND load_id = ${proof.loadId}::uuid`);
            return rows[0] ? { matchId: rows[0].match_id, loadId: rows[0].load_id } : null;
          });
        }, { isolationLevel: 'Serializable' }),
        booking.reschedule({ passportId: f.passportId, matchId, actorIdentityId: f.ownerId,
          expectedVersion: 1, idempotencyKey: randomUUID(), ...fields, matchDate: '2026-03-31' }),
        booking.cancel({ passportId: f.passportId, matchId, actorIdentityId: f.ownerId,
          expectedVersion: 1, idempotencyKey: randomUUID() }),
      ]);
      expect(operations.filter((result) => result.status === 'fulfilled' && result.value.outcome === 'applied')).toHaveLength(1);
      const current = await prisma.firstMatch.findUniqueOrThrow({ where: { id: matchId } });
      expect(current.version).toBe(2);
      expect([['LOADED', 'USED'], ['WAITING', 'RESERVED'], ['CANCELED', 'RELEASED']])
        .toContainEqual([current.state, current.unitState]);
      expect(await prisma.firstMatchIntent.count({ where: { matchId } })).toBe(2);
      if (current.state === 'LOADED') {
        expect(await booking.cancel({ passportId: f.passportId, matchId, actorIdentityId: f.ownerId,
          expectedVersion: 1, idempotencyKey: randomUUID() })).toMatchObject({ outcome: 'conflict' });
        expect(await booking.reschedule({ passportId: f.passportId, matchId, actorIdentityId: f.ownerId,
          expectedVersion: 1, idempotencyKey: randomUUID(), ...fields })).toMatchObject({ outcome: 'conflict' });
      }
      const counted = await repository.executeLocked(f.passportId, async (tx) =>
        repository.countPeriod(tx, await repository.loadAllowanceSource(tx, f.passportId),
          current.matchDate.toISOString().slice(0, 10)));
      expect((counted?.reserved ?? 0) + (counted?.used ?? 0)).toBe(current.state === 'CANCELED' ? 0 : 1);
    } finally { client.release(); }
  });
});
