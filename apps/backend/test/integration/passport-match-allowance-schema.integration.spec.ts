import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PassportTransactionRunner } from '../../src/player-passport/passport-lifecycle/transaction-runner.js';
import { PersonalAdultApprovalOrchestrator } from '../../src/registration-requests/outcomes/personal-adult-approval.orchestrator.js';
import { RegistrationAgePolicy } from '../../src/registration-requests/personal/registration-age-policy.js';
import {
  cleanupPersonalFixtures,
  createSubmittedPersonalRequest,
  TEST_PASSPORT_KEYS,
} from './registration-personal-test-fixture.js';

const connectionString = process.env.DATABASE_URL!;

describe('Feature 008 additive match allowance schema', () => {
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const requestIds: string[] = [];
  const identityIds: string[] = [];

  beforeAll(async () => {
    const result = await pool.query<{ current_database: string }>('SELECT current_database()');
    expect(result.rows[0]!.current_database).toMatch(/^newtalents_feature008_test_[a-z0-9]+$/);
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    await cleanupPersonalFixtures(prisma, requestIds, identityIds);
    await prisma.$disconnect();
    await pool.end();
  });

  it('enforces one passport aggregate, valid snapshots and immutable history without rewriting legacy rows', async () => {
    const client = await pool.connect();
    const prior = await legacyCounts(client);
    try {
      await client.query('BEGIN');
      const actorId = await insertIdentity(client);
      const playerId = await insertPlayer(client);
      const passportId = await insertPassport(client, playerId, actorId);

      expect((await client.query<{ count: string }>(
        'SELECT count(*) FROM "PassportMatchAllowance" WHERE "passportId" = $1',
        [passportId],
      )).rows[0]!.count).toBe('0');

      const allowanceId = (await client.query<{ id: string; version: number }>(
        `INSERT INTO "PassportMatchAllowance" (id, "passportId", "activatedOn", "updatedAt")
         VALUES (gen_random_uuid(), $1, DATE '2026-10-09', now()) RETURNING id, version`,
        [passportId],
      )).rows[0]!;
      expect(allowanceId.version).toBe(1);

      await expectConstraint(client, 'duplicate_passport', '23505', () => client.query(
        `INSERT INTO "PassportMatchAllowance" (id, "passportId", "activatedOn", "updatedAt")
         VALUES (gen_random_uuid(), $1, DATE '2026-10-09', now())`,
        [passportId],
      ));
      await expectConstraint(client, 'missing_passport_fk', '23503', () => client.query(
        `INSERT INTO "PassportMatchAllowance" (id, "passportId", "activatedOn", "updatedAt")
         VALUES (gen_random_uuid(), gen_random_uuid(), DATE '2026-10-09', now())`,
      ));
      await expectConstraint(client, 'version_zero', '23514', () => client.query(
        `UPDATE "PassportMatchAllowance" SET version = 0 WHERE id = $1`,
        [allowanceId.id],
      ));
      await expectConstraint(client, 'activation_immutable', '55000', () => client.query(
        `UPDATE "PassportMatchAllowance" SET "activatedOn" = DATE '2026-10-10' WHERE id = $1`,
        [allowanceId.id],
      ));

      const key = randomUUID();
      const revisionId = (await client.query<{ id: string }>(
        `INSERT INTO "PassportMatchAllowanceRevision"
           (id, "allowanceId", sequence, "idempotencyKey", "expectedVersion", cadence,
            "matchLimit", "effectiveOn", "confirmedByIdentityId")
         VALUES (gen_random_uuid(), $1, 1, $2, 0, 'MONTHLY', 4, DATE '2026-10-09', $3)
         RETURNING id`,
        [allowanceId.id, key, actorId],
      )).rows[0]!.id;

      await expectConstraint(client, 'missing_actor_fk', '23503', () => client.query(
        `INSERT INTO "PassportMatchAllowanceRevision"
           (id, "allowanceId", sequence, "idempotencyKey", "expectedVersion", cadence,
            "matchLimit", "effectiveOn", "previousCadence", "previousMatchLimit",
            "previousEffectiveOn", "confirmedByIdentityId")
         VALUES (gen_random_uuid(), $1, 2, gen_random_uuid(), 1, 'MONTHLY', 5, DATE '2026-11-09',
           'MONTHLY', 4, DATE '2026-10-09', gen_random_uuid())`,
        [allowanceId.id],
      ));

      await expectConstraint(client, 'duplicate_sequence', '23505', () => client.query(
        `INSERT INTO "PassportMatchAllowanceRevision"
           (id, "allowanceId", sequence, "idempotencyKey", "expectedVersion", cadence,
            "matchLimit", "effectiveOn", "confirmedByIdentityId")
         VALUES (gen_random_uuid(), $1, 1, gen_random_uuid(), 0, 'MONTHLY', 4, DATE '2026-10-09', $2)`,
        [allowanceId.id, actorId],
      ));
      await expectConstraint(client, 'duplicate_idempotency', '23505', () => client.query(
        `INSERT INTO "PassportMatchAllowanceRevision"
           (id, "allowanceId", sequence, "idempotencyKey", "expectedVersion", cadence,
            "matchLimit", "effectiveOn", "previousCadence", "previousMatchLimit",
            "previousEffectiveOn", "confirmedByIdentityId")
         VALUES (gen_random_uuid(), $1, 2, $2, 1, 'QUARTERLY', 4, DATE '2026-11-09',
           'MONTHLY', 4, DATE '2026-10-09', $3)`,
        [allowanceId.id, key, actorId],
      ));
      for (const invalidLimit of ['0', '9007199254740992']) {
        await expectConstraint(client, `invalid_limit_${invalidLimit === '0' ? 'zero' : 'overflow'}`, '23514', () => client.query(
          `INSERT INTO "PassportMatchAllowanceRevision"
             (id, "allowanceId", sequence, "idempotencyKey", "expectedVersion", cadence,
              "matchLimit", "effectiveOn", "confirmedByIdentityId")
           VALUES (gen_random_uuid(), $1, 1, gen_random_uuid(), 0, 'MONTHLY', $2, DATE '2026-10-09', $3)`,
          [allowanceId.id, invalidLimit, actorId],
        ));
      }
      await expectConstraint(client, 'missing_previous_snapshot', '23514', () => client.query(
        `INSERT INTO "PassportMatchAllowanceRevision"
           (id, "allowanceId", sequence, "idempotencyKey", "expectedVersion", cadence,
            "matchLimit", "effectiveOn", "confirmedByIdentityId")
         VALUES (gen_random_uuid(), $1, 2, gen_random_uuid(), 1, 'QUARTERLY', 4, DATE '2026-11-09', $2)`,
        [allowanceId.id, actorId],
      ));
      await expectConstraint(client, 'immutable_revision_update', '55000', () => client.query(
        `UPDATE "PassportMatchAllowanceRevision" SET "matchLimit" = 5 WHERE id = $1`,
        [revisionId],
      ));
      await expectConstraint(client, 'immutable_revision_delete', '55000', () => client.query(
        `DELETE FROM "PassportMatchAllowanceRevision" WHERE id = $1`,
        [revisionId],
      ));
      await expectConstraint(client, 'restrict_passport', '23001', () => client.query(
        `DELETE FROM "PlayerPassport" WHERE id = $1`,
        [passportId],
      ));
      await expectConstraint(client, 'restrict_actor', '23001', () => client.query(
        `DELETE FROM "Identity" WHERE id = $1`,
        [actorId],
      ));
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    expect(await legacyCounts(pool)).toEqual(prior);
  });

  it('does not create an allowance during existing Feature 006 approval or later custody insertion', async () => {
    const fixture = await createSubmittedPersonalRequest(prisma, {
      type: 'PERSONAL_ADULT',
      playerDocument: `F008-${randomUUID()}`,
      playerBirthDate: '1990-01-15',
    });
    requestIds.push(fixture.requestId);
    identityIds.push(fixture.ownerIdentityId);

    const runner = new PassportTransactionRunner(prisma as never, async () => undefined);
    const orchestrator = new PersonalAdultApprovalOrchestrator(
      runner,
      new RegistrationAgePolicy(),
      TEST_PASSPORT_KEYS,
    );
    const result = await orchestrator.approve({
      requestId: fixture.requestId,
      expectedVersion: 0,
      actorIdentityId: fixture.ownerIdentityId,
      idempotencyKey: randomUUID(),
      operationInstant: new Date('2026-10-09T15:00:00.000Z'),
    });
    expect(result).toMatchObject({ outcome: 'approved', passport: { state: 'ACTIVE' } });
    if (!isRecord(result) || !isRecord(result.passport) || typeof result.passport.id !== 'string') {
      throw new Error('Approval did not return a passport reference');
    }
    const passportId = result.passport.id;
    expect(await prisma.passportMatchAllowance.count({ where: { passportId } })).toBe(0);

    await pool.query(
      `INSERT INTO "PassportCustody" (id, "passportId", version, "updatedAt")
       VALUES (gen_random_uuid(), $1, 0, now())`,
      [passportId],
    );
    expect(await prisma.passportMatchAllowance.count({ where: { passportId } })).toBe(0);
    await pool.query('DELETE FROM "PassportCustody" WHERE "passportId" = $1', [passportId]);
  });
});

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

async function expectConstraint(
  client: PoolClient,
  savepoint: string,
  code: string,
  operation: () => Promise<unknown>,
): Promise<void> {
  await client.query(`SAVEPOINT ${savepoint}`);
  let failure: unknown;
  try {
    await operation();
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({ code });
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
}

async function insertIdentity(client: PoolClient): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO "Identity" (id, status, "updatedAt") VALUES (gen_random_uuid(), 'ACTIVE', now()) RETURNING id`,
  );
  return result.rows[0]!.id;
}

async function insertPlayer(client: PoolClient): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO "Player" (id, "updatedAt") VALUES (gen_random_uuid(), now()) RETURNING id`,
  );
  return result.rows[0]!.id;
}

async function insertPassport(client: PoolClient, playerId: string, creatorId: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO "PlayerPassport"
      (id, "playerId", state, "enrichmentStatus", "originKind", position, "ageCategory", city, country,
       "dominantFoot", "createdByIdentityId", version, "updatedAt")
     VALUES (gen_random_uuid(), $1, 'ACTIVE', 'AWAITING_ANALYST_ENRICHMENT', 'PARTICULAR', '', '', '', '',
       'UNDECLARED', $2, 0, now()) RETURNING id`,
    [playerId, creatorId],
  );
  return result.rows[0]!.id;
}

async function legacyCounts(database: Queryable): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const table of ['Identity', 'Player', 'PlayerPassport', 'RegistrationRequest', 'PassportCustody']) {
    const count = await database.query<{ count: string }>(`SELECT count(*) FROM "${table}"`);
    result[table] = Number(count.rows[0]!.count);
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
