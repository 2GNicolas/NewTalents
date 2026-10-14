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
const fields = { matchDate: '2026-02-27', matchTime: '10:00', opponent: 'Rival', competition: 'Liga', venue: 'Cancha' };

describe('Feature 009 correction on isolated PostgreSQL', () => {
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature009_test_[a-f0-9]{12}$/);
    await prisma.$queryRaw`SELECT 1`;
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('moves the same reserved unit across periods and replays exactly once', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client, { limit: 1 });
      const booked = await command.schedule({ passportId: f.passportId, actorIdentityId: f.ownerId,
        expectedVersion: 0, idempotencyKey: randomUUID(), ...fields });
      expect(booked.outcome).toBe('applied');
      if (!('matchId' in booked)) throw new Error('schedule failed');
      const edit = { passportId: f.passportId, matchId: booked.matchId, actorIdentityId: f.ownerId,
        expectedVersion: 1, idempotencyKey: randomUUID(), ...fields, matchDate: '2026-02-28', opponent: 'Nuevo rival' };
      expect(await command.reschedule(edit)).toMatchObject({ outcome: 'applied', matchId: booked.matchId });
      expect(await command.reschedule(edit)).toMatchObject({ outcome: 'idempotent', matchId: booked.matchId });
      expect(await command.reschedule({ ...edit, opponent: 'Distinto' })).toMatchObject({ outcome: 'conflict' });
      expect(await command.reschedule({ ...edit, idempotencyKey: randomUUID() })).toMatchObject({ outcome: 'conflict' });
      expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: booked.matchId } })).toMatchObject({
        id: booked.matchId, version: 2, state: 'WAITING', unitState: 'RESERVED', opponent: 'Nuevo rival',
        matchDate: new Date('2026-02-28T00:00:00.000Z'),
      });
      expect(await prisma.firstMatchIntent.count({ where: { passportId: f.passportId } })).toBe(2);
      expect(await query.preview({ passportId: f.passportId, actorIdentityId: f.ownerId, matchDate: '2026-02-27' }))
        .toMatchObject({ availability: { reserved: 0, available: 1 } });
      expect(await query.preview({ passportId: f.passportId, actorIdentityId: f.ownerId, matchDate: '2026-02-28' }))
        .toMatchObject({ availability: { reserved: 1, available: 0 } });
      expect(await prisma.firstMatch.count({ where: { passportId: f.passportId } })).toBe(1);
    } finally { client.release(); }
  });

  it('allows a same-period move at full capacity, but preserves all fields on invalid or unconfigured destination', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client, { limit: 1 });
      const booked = await command.schedule({ passportId: f.passportId, actorIdentityId: f.ownerId,
        expectedVersion: 0, idempotencyKey: randomUUID(), ...fields });
      if (!('matchId' in booked)) throw new Error('schedule failed');
      const base = { passportId: f.passportId, matchId: booked.matchId, actorIdentityId: f.ownerId,
        expectedVersion: 1, idempotencyKey: randomUUID(), ...fields };
      expect(await command.reschedule({ ...base, matchDate: '2026-02-20' })).toMatchObject({ outcome: 'applied' });
      const current = await prisma.firstMatch.findUniqueOrThrow({ where: { id: booked.matchId } });
      expect(await command.reschedule({ ...base, expectedVersion: 2, idempotencyKey: randomUUID(),
        matchDate: '2026-01-30' })).toMatchObject({ outcome: 'no-allowance' });
      expect(await command.reschedule({ ...base, expectedVersion: 2, idempotencyKey: randomUUID(),
        matchDate: 'bad-date' })).toMatchObject({ outcome: 'invalid' });
      expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: booked.matchId } })).toEqual(current);
      expect(await prisma.firstMatchIntent.count({ where: { passportId: f.passportId } })).toBe(2);
      // A distinct booked unit in a different passport does not consume this passport's limit.
      const other = await createFirstMatchFixture(client, { limit: 1 });
      await insertSyntheticFirstMatch(client, other, { date: '2026-02-28', state: 'LOADED' });
      expect(await command.reschedule({ ...base, expectedVersion: 2, idempotencyKey: randomUUID(),
        matchDate: '2026-02-28' })).toMatchObject({ outcome: 'applied' });
      expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: booked.matchId } })).toMatchObject({
        version: 3, state: 'WAITING', unitState: 'RESERVED', matchDate: new Date('2026-02-28T00:00:00.000Z'),
      });
    } finally { client.release(); }
  });

  it('cancels before load once, restores invitation and retains auditable history', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client);
      const booked = await command.schedule({ passportId: f.passportId, actorIdentityId: f.ownerId,
        expectedVersion: 0, idempotencyKey: randomUUID(), ...fields });
      if (!('matchId' in booked)) throw new Error('schedule failed');
      const cancel = { passportId: f.passportId, matchId: booked.matchId, actorIdentityId: f.ownerId,
        expectedVersion: 1, idempotencyKey: randomUUID() };
      expect(await command.cancel(cancel)).toMatchObject({ outcome: 'applied' });
      expect(await command.cancel(cancel)).toMatchObject({ outcome: 'idempotent' });
      expect(await command.cancel({ ...cancel, idempotencyKey: randomUUID() })).toMatchObject({ outcome: 'conflict' });
      expect(await command.cancel({ ...cancel, idempotencyKey: cancel.idempotencyKey, expectedVersion: 2 }))
        .toMatchObject({ outcome: 'conflict' });
      expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: booked.matchId } })).toMatchObject({
        state: 'CANCELED', unitState: 'RELEASED', version: 2, canceledByIdentityId: f.ownerId,
      });
      expect(await query.get({ passportId: f.passportId, actorIdentityId: f.ownerId }))
        .toMatchObject({ flow: { state: 'INVITATION' } });
      expect(await query.preview({ passportId: f.passportId, actorIdentityId: f.ownerId, matchDate: fields.matchDate }))
        .toMatchObject({ availability: { reserved: 0, used: 0 } });
      expect(await prisma.firstMatchIntent.count({ where: { passportId: f.passportId } })).toBe(2);
      expect(await command.schedule({ passportId: f.passportId, actorIdentityId: f.ownerId,
        expectedVersion: 0, idempotencyKey: randomUUID(), ...fields })).toMatchObject({ outcome: 'applied' });
    } finally { client.release(); }
  });

  it('denies correction without live responsibility and after USED, without altering consumption', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client, { withCustody: true });
      const loadedId = await insertSyntheticFirstMatch(client, f, { date: fields.matchDate, state: 'LOADED' });
      const base = { passportId: f.passportId, matchId: loadedId, actorIdentityId: f.ownerId,
        expectedVersion: 1, idempotencyKey: randomUUID() };
      expect(await command.cancel(base)).toMatchObject({ outcome: 'conflict' });
      expect(await command.reschedule({ ...base, ...fields })).toMatchObject({ outcome: 'conflict' });
      expect(await command.cancel({ ...base, actorIdentityId: f.analystId })).toMatchObject({ outcome: 'not-found' });
      expect(await command.cancel({ ...base, matchId: randomUUID() })).toMatchObject({ outcome: 'not-found' });
      expect(await query.preview({ passportId: f.passportId, actorIdentityId: f.ownerId, matchDate: fields.matchDate }))
        .toMatchObject({ availability: { reserved: 0, used: 1 } });
      expect(await prisma.firstMatchIntent.count({ where: { passportId: f.passportId } })).toBe(0);
    } finally { client.release(); }
  });

  it('serializes simultaneous cancel and reschedule with one coherent winner', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client, { limit: 1 });
      const booked = await command.schedule({ passportId: f.passportId, actorIdentityId: f.ownerId,
        expectedVersion: 0, idempotencyKey: randomUUID(), ...fields });
      if (!('matchId' in booked)) throw new Error('schedule failed');
      const base = { passportId: f.passportId, matchId: booked.matchId, actorIdentityId: f.ownerId,
        expectedVersion: 1 };
      const results = await Promise.all([
        command.cancel({ ...base, idempotencyKey: randomUUID() }),
        command.reschedule({ ...base, idempotencyKey: randomUUID(), ...fields, matchDate: '2026-02-28' }),
      ]);
      expect(results.filter((result) => result.outcome === 'applied')).toHaveLength(1);
      expect(results.filter((result) => result.outcome === 'conflict')).toHaveLength(1);
      const match = await prisma.firstMatch.findUniqueOrThrow({ where: { id: booked.matchId } });
      expect(match.version).toBe(2);
      expect([['CANCELED', 'RELEASED'], ['WAITING', 'RESERVED']]).toContainEqual([match.state, match.unitState]);
      expect(await prisma.firstMatchIntent.count({ where: { passportId: f.passportId } })).toBe(2);
    } finally { client.release(); }
  });
});
