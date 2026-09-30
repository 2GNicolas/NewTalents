import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Feature 006 additive registration request schema', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('enforces one matching typed detail, uniqueness, immutable events, and one final execution per version', async () => {
    const client = await pool.connect();
    const prior = await counts(client);
    try {
      await client.query('BEGIN');
      const identity = await client.query<{ id: string }>(
        `INSERT INTO "Identity" (id, status, "updatedAt") VALUES (gen_random_uuid(), 'ACTIVE', now()) RETURNING id`,
      );
      const identityId = identity.rows[0]!.id;
      const request = await client.query<{ id: string }>(
        `INSERT INTO "RegistrationRequest" (id, type, "ownerIdentityId", "updatedAt") VALUES (gen_random_uuid(), 'PERSONAL_ADULT', $1, now()) RETURNING id`,
        [identityId],
      );
      const requestId = request.rows[0]!.id;
      const applicant = await insertApplicant(client, requestId, identityId, 'applicant-fingerprint');
      const player = await insertPlayer(client, requestId, 'player-fingerprint');
      await client.query(
        `INSERT INTO "PersonalAdultRequestDetail" (id, "requestId", "applicantId", "playerId", "actingForSelf") VALUES (gen_random_uuid(), $1, $2, $3, TRUE)`,
        [requestId, applicant, player],
      );
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');

      await client.query('SAVEPOINT duplicate_fingerprint');
      await expect(insertApplicant(client, requestId, null, 'applicant-fingerprint')).rejects.toMatchObject({ code: '23505' });
      await client.query('ROLLBACK TO SAVEPOINT duplicate_fingerprint');

      await client.query('SAVEPOINT wrong_detail');
      await client.query('SET CONSTRAINTS ALL DEFERRED');
      const wrongRequest = await client.query<{ id: string }>(
        `INSERT INTO "RegistrationRequest" (id, type, "ownerIdentityId", "updatedAt") VALUES (gen_random_uuid(), 'FORMAL_ACADEMY', $1, now()) RETURNING id`,
        [identityId],
      );
      const wrongRequestId = wrongRequest.rows[0]!.id;
      const wrongApplicant = await insertApplicant(client, wrongRequestId, identityId, 'wrong-applicant');
      const wrongPlayer = await insertPlayer(client, wrongRequestId, 'wrong-player');
      await client.query(
        `INSERT INTO "PersonalAdultRequestDetail" (id, "requestId", "applicantId", "playerId", "actingForSelf") VALUES (gen_random_uuid(), $1, $2, $3, TRUE)`,
        [wrongRequestId, wrongApplicant, wrongPlayer],
      );
      await expect(client.query('SET CONSTRAINTS ALL IMMEDIATE')).rejects.toMatchObject({ code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT wrong_detail');
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');

      await client.query(
        `INSERT INTO "RegistrationApprovalExecution" (id, "requestId", "requestVersion", "idempotencyKey", "updatedAt") VALUES (gen_random_uuid(), $1, 0, gen_random_uuid(), now())`,
        [requestId],
      );
      await expect(client.query(
        `INSERT INTO "RegistrationApprovalExecution" (id, "requestId", "requestVersion", "idempotencyKey", "updatedAt") VALUES (gen_random_uuid(), $1, 0, gen_random_uuid(), now())`,
        [requestId],
      )).rejects.toMatchObject({ code: '23505' });
      await client.query('ROLLBACK TO SAVEPOINT duplicate_fingerprint').catch(() => undefined);

      await client.query('SAVEPOINT final_decision');
      await client.query(
        `INSERT INTO "RegistrationReviewDecision" (id, "requestId", "requestVersion", kind, "administratorIdentityId", "idempotencyKey") VALUES (gen_random_uuid(), $1, 0, 'APPROVED', $2, gen_random_uuid())`,
        [requestId, identityId],
      );
      await expect(client.query(
        `INSERT INTO "RegistrationReviewDecision" (id, "requestId", "requestVersion", kind, "administratorIdentityId", "idempotencyKey") VALUES (gen_random_uuid(), $1, 0, 'REJECTED', $2, gen_random_uuid())`,
        [requestId, identityId],
      )).rejects.toMatchObject({ code: '23505' });
      await client.query('ROLLBACK TO SAVEPOINT final_decision');

      await client.query('SAVEPOINT immutable_event');
      const event = await client.query<{ id: string }>(
        `INSERT INTO "RegistrationRequestEvent" (id, "requestId", sequence, "requestVersion", "actorIdentityId", action, "priorStatus", "resultingStatus", outcome) VALUES (gen_random_uuid(), $1, 1, 1, $2, 'SUBMITTED', 'DRAFT', 'SUBMITTED', 'APPLIED') RETURNING id`,
        [requestId, identityId],
      );
      await expect(client.query(`UPDATE "RegistrationRequestEvent" SET action = 'CHANGED' WHERE id = $1`, [event.rows[0]!.id])).rejects.toMatchObject({ code: '55000' });
      await client.query('ROLLBACK TO SAVEPOINT immutable_event');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    expect(await counts(pool)).toEqual(prior);
  });

  it('stores evidence metadata without document payload columns', async () => {
    const columns = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RegistrationEvidenceItem'`,
    );
    const names = columns.rows.map((row) => row.column_name);
    expect(names).toEqual(expect.arrayContaining(['objectKey', 'declaredMime', 'detectedMime', 'sizeBytes', 'contentDigest', 'status']));
    expect(names.some((name) => ['bytes', 'base64', 'publicurl', 'password', 'content'].includes(name.toLowerCase()))).toBe(false);
  });
});

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

async function counts(database: Queryable): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const table of ['Identity', 'Player', 'PlayerPassport', 'RegistrationRequest']) {
    const count = await database.query<{ count: string }>(`SELECT count(*) FROM "${table}"`);
    result[table] = Number(count.rows[0]!.count);
  }
  return result;
}

async function insertApplicant(client: PoolClient, requestId: string, identityId: string | null, fingerprint: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO "RegistrationRequestApplicant" (id, "requestId", "identityId", "encryptedLegalName", "encryptedDateOfBirth", "encryptedDocumentType", "encryptedDocumentNumber", "documentFingerprint", "nameDobFingerprint", "derivedAdult", "updatedAt") VALUES (gen_random_uuid(), $1, $2, 'enc-name', 'enc-dob', 'enc-type', 'enc-number', $3, $4, TRUE, now()) RETURNING id`,
    [requestId, identityId, fingerprint, `${fingerprint}-name-dob`],
  );
  return result.rows[0]!.id;
}

async function insertPlayer(client: PoolClient, requestId: string, fingerprint: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO "RegistrationRequestPlayer" (id, "requestId", "encryptedLegalName", "encryptedDateOfBirth", "encryptedDocumentType", "encryptedDocumentNumber", "documentFingerprint", "nameDobFingerprint", "encryptedCountry", "encryptedCity", "derivedAdult", "updatedAt") VALUES (gen_random_uuid(), $1, 'enc-name', 'enc-dob', 'enc-type', 'enc-number', $2, $3, 'enc-country', 'enc-city', TRUE, now()) RETURNING id`,
    [requestId, fingerprint, `${fingerprint}-name-dob`],
  );
  return result.rows[0]!.id;
}
