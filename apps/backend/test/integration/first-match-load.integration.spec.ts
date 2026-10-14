import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient, Prisma } from '../../src/generated/prisma/client.js';
import { ConfirmedLoadService } from '../../src/first-match/application/confirmed-load.service.js';
import { FirstMatchAccess } from '../../src/first-match/application/first-match-access.js';
import { FirstMatchCommand } from '../../src/first-match/application/first-match-command.js';
import { FirstMatchQuery } from '../../src/first-match/application/first-match-query.js';
import { FirstMatchRepository, type FirstMatchTransaction } from '../../src/first-match/persistence/first-match.repository.js';
import { AllowanceTransactionRunner } from '../../src/passport-match-allowance/persistence/allowance-transaction.runner.js';
import { createFirstMatchFixture } from '../first-match-test-helpers.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const repository = new FirstMatchRepository(new AllowanceTransactionRunner(prisma as never, async () => undefined));
const service = new ConfirmedLoadService(repository);
const command = new FirstMatchCommand(repository, new FirstMatchAccess());
const query = new FirstMatchQuery(repository, new FirstMatchAccess());
const fields = { matchDate: '2026-02-27', matchTime: '10:00', opponent: 'Rival', competition: 'Liga', venue: 'Cancha' };

async function book(passportId: string, ownerId: string) {
  const result = await command.schedule({ passportId, actorIdentityId: ownerId, expectedVersion: 0,
    idempotencyKey: randomUUID(), ...fields });
  if (!('matchId' in result)) throw new Error(`schedule failed: ${result.outcome}`);
  return result.matchId;
}

async function confirmed(transaction: FirstMatchTransaction, { matchId, loadId }: { matchId: string; loadId: string }) {
  const rows = await transaction.$queryRaw<{ match_id: string; load_id: string }[]>(Prisma.sql`
    SELECT match_id, load_id FROM "Feature009TestConfirmedLoad"
    WHERE match_id = ${matchId}::uuid AND load_id = ${loadId}::uuid`);
  return rows[0] ? { matchId: rows[0].match_id, loadId: rows[0].load_id } : null;
}

describe('Feature 009 confirmed-load boundary on isolated PostgreSQL', () => {
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature009_test_[a-f0-9]{12}$/);
    await prisma.$executeRawUnsafe('CREATE TABLE "Feature009TestConfirmedLoad" (match_id uuid NOT NULL, load_id uuid NOT NULL UNIQUE)');
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('commits durable confirmation and RESERVED → USED together, replays once, and rolls both back', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client, { withCustody: true, limit: 1 });
      const matchId = await book(f.passportId, f.ownerId);
      const loadId = randomUUID();
      const input = { passportId: f.passportId, matchId, analystIdentityId: f.analystId, loadId,
        expectedVersion: 1, confirmedAt: new Date() };
      await expect(prisma.$transaction(async (tx) => service.confirmFirstMatchDataLoad(tx, input, confirmed),
        { isolationLevel: 'Serializable' })).rejects.toMatchObject({ outcome: 'unconfirmed' });
      await expect(prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`INSERT INTO "Feature009TestConfirmedLoad" (match_id, load_id)
          VALUES (${matchId}::uuid, ${loadId}::uuid)`);
        expect(await service.confirmFirstMatchDataLoad(tx, input, confirmed)).toMatchObject({ outcome: 'applied' });
        throw new Error('roll back both');
      }, { isolationLevel: 'Serializable' })).rejects.toThrow('roll back both');
      expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: matchId } })).toMatchObject({ state: 'WAITING', unitState: 'RESERVED' });
      expect(await prisma.$queryRaw(Prisma.sql`SELECT * FROM "Feature009TestConfirmedLoad" WHERE load_id = ${loadId}::uuid`)).toEqual([]);
      expect(await prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`INSERT INTO "Feature009TestConfirmedLoad" (match_id, load_id)
          VALUES (${matchId}::uuid, ${loadId}::uuid)`);
        return service.confirmFirstMatchDataLoad(tx, input, confirmed);
      }, { isolationLevel: 'Serializable' })).toMatchObject({ outcome: 'applied' });
      expect(await prisma.$transaction((tx) => service.confirmFirstMatchDataLoad(tx, input, confirmed),
        { isolationLevel: 'Serializable' })).toMatchObject({ outcome: 'idempotent' });
      await expect(prisma.$transaction((tx) => service.confirmFirstMatchDataLoad(tx, { ...input, loadId: randomUUID() }, confirmed),
        { isolationLevel: 'Serializable' })).rejects.toMatchObject({ outcome: 'conflict' });
      expect(await query.preview({ passportId: f.passportId, actorIdentityId: f.ownerId, matchDate: fields.matchDate }))
        .toMatchObject({ availability: { reserved: 0, used: 1, available: 0 } });
      expect(await prisma.firstMatchIntent.count({ where: { matchId, action: 'LOAD_CONFIRMED' } })).toBe(1);
      expect((await prisma.firstMatch.findUniqueOrThrow({ where: { id: matchId } })).matchDate)
        .toEqual(new Date('2026-02-27T00:00:00.000Z'));
    } finally { client.release(); }
  });

  it('denies revoked custody, role, inactive identity, foreign match and stale version', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client, { withCustody: true });
      const matchId = await book(f.passportId, f.ownerId);
      const loadId = randomUUID();
      const input = { passportId: f.passportId, matchId, analystIdentityId: f.analystId, loadId,
        expectedVersion: 1, confirmedAt: new Date() };
      const attempt = () => prisma.$transaction((tx) => service.confirmFirstMatchDataLoad(tx, input, confirmed),
        { isolationLevel: 'Serializable' });
      await expect(attempt()).rejects.toMatchObject({ outcome: 'unconfirmed' });
      await prisma.$executeRaw(Prisma.sql`INSERT INTO "Feature009TestConfirmedLoad" (match_id, load_id)
        VALUES (${matchId}::uuid, ${loadId}::uuid)`);
      await expect(prisma.$transaction((tx) => service.confirmFirstMatchDataLoad(tx, { ...input, expectedVersion: 2 }, confirmed),
        { isolationLevel: 'Serializable' })).rejects.toMatchObject({ outcome: 'conflict' });
      await expect(prisma.$transaction((tx) => service.confirmFirstMatchDataLoad(tx, { ...input, matchId: randomUUID() }, confirmed),
        { isolationLevel: 'Serializable' })).rejects.toMatchObject({ outcome: 'not-found' });
      await prisma.passportCustody.update({ where: { passportId: f.passportId },
        data: { currentAnalystIdentityId: null, assignedAt: null } });
      await expect(attempt()).rejects.toMatchObject({ outcome: 'unauthorized' });
      await prisma.passportCustody.update({ where: { passportId: f.passportId },
        data: { currentAnalystIdentityId: f.analystId, assignedAt: new Date() } });
      await prisma.roleAssignment.updateMany({ where: { identityId: f.analystId, role: 'ANALYST' }, data: { status: 'REVOKED', revokedAt: new Date() } });
      await expect(attempt()).rejects.toMatchObject({ outcome: 'unauthorized' });
      await prisma.roleAssignment.updateMany({ where: { identityId: f.analystId, role: 'ANALYST' }, data: { status: 'ACTIVE', revokedAt: null } });
      await prisma.identity.update({ where: { id: f.analystId }, data: { status: 'INACTIVE', deactivatedAt: new Date() } });
      await expect(attempt()).rejects.toMatchObject({ outcome: 'unauthorized' });
      expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: matchId } })).toMatchObject({ state: 'WAITING', unitState: 'RESERVED' });
    } finally { client.release(); }
  });

  it('serializes load against cancellation and rescheduling with one valid winner', async () => {
    const client = await pool.connect();
    try {
      for (const correction of ['cancel', 'reschedule'] as const) {
        const f = await createFirstMatchFixture(client, { withCustody: true, limit: 1 });
        const matchId = await book(f.passportId, f.ownerId);
        const loadId = randomUUID();
        const input = { passportId: f.passportId, matchId, analystIdentityId: f.analystId, loadId,
          expectedVersion: 1, confirmedAt: new Date() };
        const loaded = prisma.$transaction(async (tx) => {
          await tx.$executeRaw(Prisma.sql`INSERT INTO "Feature009TestConfirmedLoad" (match_id, load_id)
            VALUES (${matchId}::uuid, ${loadId}::uuid)`);
          return service.confirmFirstMatchDataLoad(tx, input, confirmed);
        }, { isolationLevel: 'Serializable' });
        const corrected = correction === 'cancel'
          ? command.cancel({ passportId: f.passportId, matchId, actorIdentityId: f.ownerId,
            expectedVersion: 1, idempotencyKey: randomUUID() })
          : command.reschedule({ passportId: f.passportId, matchId, actorIdentityId: f.ownerId,
            expectedVersion: 1, idempotencyKey: randomUUID(), ...fields, matchDate: '2026-02-28' });
        const outcomes = await Promise.allSettled([loaded, corrected]);
        const match = await prisma.firstMatch.findUniqueOrThrow({ where: { id: matchId } });
        expect([['LOADED', 'USED'], ['CANCELED', 'RELEASED'], ['WAITING', 'RESERVED']])
          .toContainEqual([match.state, match.unitState]);
        expect(match.version).toBe(2);
        expect(outcomes.filter((result) => result.status === 'fulfilled' && result.value.outcome === 'applied')).toHaveLength(1);
        if (match.state === 'LOADED') {
          expect(await command.cancel({ passportId: f.passportId, matchId, actorIdentityId: f.ownerId,
            expectedVersion: 1, idempotencyKey: randomUUID() })).toMatchObject({ outcome: 'conflict' });
        }
      }
    } finally { client.release(); }
  });

  it('uses the new match-date period after a committed reschedule and never loads a canceled match', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client, { withCustody: true, limit: 1 });
      const matchId = await book(f.passportId, f.ownerId);
      expect(await command.reschedule({ passportId: f.passportId, matchId, actorIdentityId: f.ownerId,
        expectedVersion: 1, idempotencyKey: randomUUID(), ...fields, matchDate: '2026-02-28' }))
        .toMatchObject({ outcome: 'applied' });
      const loadId = randomUUID();
      const input = { passportId: f.passportId, matchId, analystIdentityId: f.analystId, loadId,
        expectedVersion: 2, confirmedAt: new Date() };
      expect(await prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`INSERT INTO "Feature009TestConfirmedLoad" (match_id, load_id)
          VALUES (${matchId}::uuid, ${loadId}::uuid)`);
        return service.confirmFirstMatchDataLoad(tx, input, confirmed);
      }, { isolationLevel: 'Serializable' })).toMatchObject({ outcome: 'applied' });
      expect(await query.preview({ passportId: f.passportId, actorIdentityId: f.ownerId, matchDate: '2026-02-27' }))
        .toMatchObject({ availability: { reserved: 0, used: 0 } });
      expect(await query.preview({ passportId: f.passportId, actorIdentityId: f.ownerId, matchDate: '2026-02-28' }))
        .toMatchObject({ availability: { reserved: 0, used: 1, available: 0 } });

      const canceled = await createFirstMatchFixture(client, { withCustody: true });
      const canceledId = await book(canceled.passportId, canceled.ownerId);
      expect(await command.cancel({ passportId: canceled.passportId, matchId: canceledId,
        actorIdentityId: canceled.ownerId, expectedVersion: 1, idempotencyKey: randomUUID() }))
        .toMatchObject({ outcome: 'applied' });
      const canceledLoadId = randomUUID();
      await expect(prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`INSERT INTO "Feature009TestConfirmedLoad" (match_id, load_id)
          VALUES (${canceledId}::uuid, ${canceledLoadId}::uuid)`);
        return service.confirmFirstMatchDataLoad(tx, { passportId: canceled.passportId, matchId: canceledId,
          analystIdentityId: canceled.analystId, loadId: canceledLoadId, expectedVersion: 1,
          confirmedAt: new Date() }, confirmed);
      }, { isolationLevel: 'Serializable' })).rejects.toMatchObject({ outcome: 'conflict' });
      expect(await prisma.$queryRaw(Prisma.sql`SELECT * FROM "Feature009TestConfirmedLoad"
        WHERE load_id = ${canceledLoadId}::uuid`)).toEqual([]);
      expect(await query.preview({ passportId: canceled.passportId, actorIdentityId: canceled.ownerId,
        matchDate: fields.matchDate })).toMatchObject({ availability: { reserved: 0, used: 0 } });
    } finally { client.release(); }
  });
});
