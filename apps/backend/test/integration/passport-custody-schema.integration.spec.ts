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

describe('Feature 007 additive passport custody schema', () => {
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const requestIds: string[] = [];
  const identityIds: string[] = [];

  beforeAll(async () => {
    await pool.query('SELECT 1');
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    await cleanupPersonalFixtures(prisma, requestIds, identityIds);
    await prisma.$disconnect();
    await pool.end();
  });

  it('enforces one progress/profile/custody, coherent nullable state, unique events, and immutable history', async () => {
    const client = await pool.connect();
    const prior = await legacyCounts(client);
    try {
      await client.query('BEGIN');
      const administratorId = await insertIdentity(client);
      const analystId = await insertIdentity(client);
      const ownerId = await insertIdentity(client);
      const playerId = await insertPlayer(client);
      const passportId = await insertPassport(client, playerId, ownerId);
      const requestId = await insertRequest(client, ownerId);

      await client.query(
        `INSERT INTO "RegistrationAdminReviewProgress"
          ("requestId", stage, "observedRequestVersion", "startedByIdentityId", "lastUpdatedByIdentityId", "updatedAt")
         VALUES ($1, 'OPENED', 0, $2, $2, now())`,
        [requestId, administratorId],
      );
      await expectConstraint(client, 'duplicate_progress', '23505', () => client.query(
        `INSERT INTO "RegistrationAdminReviewProgress"
          ("requestId", stage, "observedRequestVersion", "startedByIdentityId", "lastUpdatedByIdentityId", "updatedAt")
         VALUES ($1, 'REVIEWED', 0, $2, $2, now())`,
        [requestId, administratorId],
      ));

      await client.query(
        `INSERT INTO "AnalystOperationalProfile"
          ("identityId", "displayLabel", "normalizedLabel", "updatedAt")
         VALUES ($1, 'Analista Sintético', 'analista sintetico', now())`,
        [analystId],
      );
      await expectConstraint(client, 'duplicate_profile', '23505', () => client.query(
        `INSERT INTO "AnalystOperationalProfile"
          ("identityId", "displayLabel", "normalizedLabel", "updatedAt")
         VALUES ($1, 'Otro rótulo', 'otro rotulo', now())`,
        [analystId],
      ));

      await client.query(
        `INSERT INTO "PassportCustody"
          (id, "passportId", "currentAnalystIdentityId", version, "assignedAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, NULL, 0, NULL, now())`,
        [passportId],
      );
      await expectConstraint(client, 'duplicate_custody', '23505', () => client.query(
        `INSERT INTO "PassportCustody"
          (id, "passportId", version, "updatedAt")
         VALUES (gen_random_uuid(), $1, 0, now())`,
        [passportId],
      ));
      await expectConstraint(client, 'incoherent_custody', '23514', () => client.query(
        `UPDATE "PassportCustody"
         SET "currentAnalystIdentityId" = $2, "assignedAt" = NULL
         WHERE "passportId" = $1`,
        [passportId, analystId],
      ));

      const idempotencyKey = randomUUID();
      const event = await client.query<{ id: string }>(
        `INSERT INTO "PassportCustodyEvent"
          (id, "passportId", sequence, action, "administratorIdentityId", "previousAnalystIdentityId",
           "nextAnalystIdentityId", "safeReason", "expectedVersion", "resultingVersion", "idempotencyKey")
         VALUES (gen_random_uuid(), $1, 1, 'ASSIGNED', $2, NULL, $3, NULL, 0, 1, $4)
         RETURNING id`,
        [passportId, administratorId, analystId, idempotencyKey],
      );
      await expectConstraint(client, 'duplicate_idempotency', '23505', () => client.query(
        `INSERT INTO "PassportCustodyEvent"
          (id, "passportId", sequence, action, "administratorIdentityId", "previousAnalystIdentityId",
           "nextAnalystIdentityId", "safeReason", "expectedVersion", "resultingVersion", "idempotencyKey")
         VALUES (gen_random_uuid(), $1, 2, 'ASSIGNED', $2, NULL, $3, NULL, 1, 2, $4)`,
        [passportId, administratorId, analystId, idempotencyKey],
      ));
      await expectConstraint(client, 'duplicate_sequence', '23505', () => client.query(
        `INSERT INTO "PassportCustodyEvent"
          (id, "passportId", sequence, action, "administratorIdentityId", "previousAnalystIdentityId",
           "nextAnalystIdentityId", "safeReason", "expectedVersion", "resultingVersion", "idempotencyKey")
         VALUES (gen_random_uuid(), $1, 1, 'ASSIGNED', $2, NULL, $3, NULL, 0, 1, gen_random_uuid())`,
        [passportId, administratorId, analystId],
      ));
      await expectConstraint(client, 'invalid_action_shape', '23514', () => client.query(
        `INSERT INTO "PassportCustodyEvent"
          (id, "passportId", sequence, action, "administratorIdentityId", "previousAnalystIdentityId",
           "nextAnalystIdentityId", "safeReason", "expectedVersion", "resultingVersion", "idempotencyKey")
         VALUES (gen_random_uuid(), $1, 2, 'REMOVED', $2, NULL, NULL, 'Retiro inválido', 1, 2, gen_random_uuid())`,
        [passportId, administratorId],
      ));
      await expectConstraint(client, 'immutable_event', '55000', () => client.query(
        `UPDATE "PassportCustodyEvent" SET "safeReason" = 'mutated' WHERE id = $1`,
        [event.rows[0]!.id],
      ));
      await expectConstraint(client, 'restrict_passport', '23001', () => client.query(
        `DELETE FROM "PlayerPassport" WHERE id = $1`,
        [passportId],
      ));
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }

    expect(await legacyCounts(pool)).toEqual(prior);
  });

  it('keeps Feature 006 personal approval additive and creates no custody row automatically', async () => {
    const fixture = await createSubmittedPersonalRequest(prisma, {
      type: 'PERSONAL_ADULT',
      playerDocument: `F007-${randomUUID()}`,
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
      operationInstant: new Date('2026-09-30T15:00:00.000Z'),
    });

    expect(result).toMatchObject({
      outcome: 'approved',
      passport: { state: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT' },
    });
    if (!isRecord(result) || !isRecord(result.passport) || typeof result.passport.id !== 'string') {
      throw new Error('Feature 006 approval did not return a passport reference');
    }
    expect(await prisma.passportCustody.count({
      where: { passportId: result.passport.id },
    })).toBe(0);
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

async function insertRequest(client: PoolClient, ownerId: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO "RegistrationRequest" (id, type, status, "ownerIdentityId", version, "updatedAt")
     VALUES (gen_random_uuid(), 'PERSONAL_ADULT', 'SUBMITTED', $1, 0, now()) RETURNING id`,
    [ownerId],
  );
  return result.rows[0]!.id;
}

async function legacyCounts(database: Queryable): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const table of ['Identity', 'Player', 'PlayerPassport', 'RegistrationRequest']) {
    const count = await database.query<{ count: string }>(`SELECT count(*) FROM "${table}"`);
    result[table] = Number(count.rows[0]!.count);
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
