import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient } from '../../src/generated/prisma/client.js';
import { FirstMatchRepository } from '../../src/first-match/persistence/first-match.repository.js';
import { AllowanceTransactionRunner } from '../../src/passport-match-allowance/persistence/allowance-transaction.runner.js';
import { createFirstMatchFixture, insertSyntheticFirstMatch } from '../first-match-test-helpers.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const repository = new FirstMatchRepository(new AllowanceTransactionRunner(prisma as never, async () => undefined));

async function rejectedCode(run: () => Promise<unknown>, code: string) {
  await expect(run()).rejects.toMatchObject({ code });
}

async function insertIntent(client: PoolClient, passportId: string, matchId: string, key: string, actorId: string) {
  return client.query(`INSERT INTO "FirstMatchIntent"
    (id, "passportId", "matchId", "idempotencyKey", action, "intentDigest", "actorIdentityId", outcome, "resultVersion")
    VALUES (gen_random_uuid(), $1, $2, $3, 'SCHEDULE', $4, $5, 'APPLIED', 1)`,
  [passportId, matchId, key, 'a'.repeat(64), actorId]);
}

describe('Feature 009 foundation on isolated PostgreSQL', () => {
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature009_test_[a-f0-9]{12}$/);
    await prisma.$queryRaw`SELECT 1`;
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('migrates the composite relationship, current-match index and intent uniqueness', async () => {
    const client = await pool.connect();
    try {
      const fixture = await createFirstMatchFixture(client, { withCustody: true });
      const other = await createFirstMatchFixture(client, { withCustody: true });
      expect((await client.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'FirstMatch'
        AND indexname = 'FirstMatch_one_current_per_passport'`)).rowCount).toBe(1);
      await rejectedCode(() => insertSyntheticFirstMatch(client, fixture, {
        date: '2026-02-27', playerId: other.playerId,
      }), '23503');
      const first = await insertSyntheticFirstMatch(client, fixture, { date: '2026-02-27' });
      await rejectedCode(() => insertSyntheticFirstMatch(client, fixture, { date: '2026-02-28' }), '23505');
      const key = randomUUID();
      await insertIntent(client, fixture.passportId, first, key, fixture.ownerId);
      await rejectedCode(() => insertIntent(client, fixture.passportId, first, key, fixture.ownerId), '23505');
      await rejectedCode(() => insertIntent(client, other.passportId, first, randomUUID(), fixture.ownerId), '23503');
    } finally { client.release(); }
  });

  it('enforces exclusive unit/state pairs, immutable scheduler and monotonic version', async () => {
    const client = await pool.connect();
    try {
      const fixture = await createFirstMatchFixture(client);
      const id = await insertSyntheticFirstMatch(client, fixture, { date: '2026-02-27' });
      await rejectedCode(() => client.query(`UPDATE "FirstMatch" SET "unitState" = 'USED', version = 2 WHERE id = $1`, [id]), '23514');
      await rejectedCode(() => client.query(`UPDATE "FirstMatch" SET "scheduledByIdentityId" = $2, version = 2 WHERE id = $1`,
        [id, fixture.analystId]), '55000');
      await rejectedCode(() => client.query(`UPDATE "FirstMatch" SET "matchTime" = '11:00' WHERE id = $1`, [id]), '23514');
      await client.query(`UPDATE "FirstMatch" SET state = 'CANCELED', "unitState" = 'RELEASED',
        "canceledByIdentityId" = $2, "canceledAt" = now(), version = 2 WHERE id = $1`, [id, fixture.ownerId]);
      await rejectedCode(() => client.query(`UPDATE "FirstMatch" SET version = 3 WHERE id = $1`, [id]), '55000');
      const loadId = randomUUID();
      await insertSyntheticFirstMatch(client, fixture, { date: '2026-02-28', state: 'LOADED', loadId });
      await rejectedCode(() => insertSyntheticFirstMatch(client, fixture, { date: '2026-03-01' }), '23505');
      const other = await createFirstMatchFixture(client, { withCustody: true });
      await rejectedCode(() => insertSyntheticFirstMatch(client, other, {
        date: '2026-02-28', state: 'LOADED', loadId,
      }), '23505');
    } finally { client.release(); }
  });

  it('counts RESERVED and USED once, RELEASED zero, across Colombia date-only boundaries', async () => {
    const client = await pool.connect();
    try {
      const reserved = await createFirstMatchFixture(client, { activatedOn: '2026-01-31', limit: 2 });
      const used = await createFirstMatchFixture(client, { activatedOn: '2026-01-31', limit: 2, withCustody: true });
      const reservedId = await insertSyntheticFirstMatch(client, reserved, { date: '2026-02-27' });
      await insertSyntheticFirstMatch(client, used, { date: '2026-02-28', state: 'LOADED' });
      const before = await repository.executeLocked(reserved.passportId, async (tx) => {
        const source = await repository.loadAllowanceSource(tx, reserved.passportId);
        return repository.countPeriod(tx, source, '2026-02-27');
      });
      expect(before).toMatchObject({ period: { start: '2026-01-31', endExclusive: '2026-02-28' }, reserved: 1, used: 0, available: 1 });
      const after = await repository.executeLocked(used.passportId, async (tx) => {
        const source = await repository.loadAllowanceSource(tx, used.passportId);
        return repository.countPeriod(tx, source, '2026-02-28');
      });
      expect(after).toMatchObject({ period: { start: '2026-02-28', endExclusive: '2026-03-31' }, reserved: 0, used: 1, available: 1 });
      await client.query(`UPDATE "FirstMatch" SET state = 'CANCELED', "unitState" = 'RELEASED',
        "canceledByIdentityId" = $2, "canceledAt" = now(), version = 2 WHERE id = $1`, [reservedId, reserved.ownerId]);
      const released = await repository.executeLocked(reserved.passportId, async (tx) => {
        const source = await repository.loadAllowanceSource(tx, reserved.passportId);
        return repository.countPeriod(tx, source, '2026-02-27');
      });
      expect(released).toMatchObject({ reserved: 0, used: 0, available: 2 });
      await repository.executeLocked(reserved.passportId, async (tx) => {
        expect(await repository.countPeriod(tx, null, '2026-02-27')).toBeNull();
      });
    } finally { client.release(); }
  });

  it('re-buckets an unchanged USED date under a proposed cadence without moving the match', async () => {
    const client = await pool.connect();
    try {
      const fixture = await createFirstMatchFixture(client, { activatedOn: '2026-01-31', withCustody: true });
      const id = await insertSyntheticFirstMatch(client, fixture, { date: '2026-03-31', state: 'LOADED' });
      const count = await repository.executeLocked(fixture.passportId, async (tx) => {
        const existing = await repository.loadAllowanceSource(tx, fixture.passportId);
        expect(existing).not.toBeNull();
        return repository.countPeriod(tx, {
          ...existing!, revisions: [...existing!.revisions, {
            sequence: 2, effectiveOn: '2026-02-28', cadence: 'QUARTERLY', matchLimit: 1,
          }],
        }, '2026-03-31');
      });
      expect(count).toMatchObject({ period: { start: '2026-02-28', endExclusive: '2026-05-28' }, used: 1, available: 0 });
      expect((await client.query<{ matchDate: Date }>('SELECT "matchDate" FROM "FirstMatch" WHERE id = $1', [id])).rows[0]!.matchDate.toISOString().slice(0, 10)).toBe('2026-03-31');
    } finally { client.release(); }
  });
});
