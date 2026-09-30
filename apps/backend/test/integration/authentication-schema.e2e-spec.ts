import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createApplication } from '../../src/main.js';

describe('Feature 003 authentication persistence schema', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let app: INestApplication;
  const identityIds: string[] = [];
  const temporaryCredentialIds: string[] = [];
  const sessionIds: string[] = [];

  beforeAll(async () => {
    app = await createApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    if (sessionIds.length) await pool.query('DELETE FROM "RefreshTokenHistory" WHERE "sessionId" = ANY($1::uuid[])', [sessionIds]);
    if (sessionIds.length) await pool.query('DELETE FROM "AuthenticationSecurityEvent" WHERE "sessionId" = ANY($1::uuid[])', [sessionIds]);
    if (sessionIds.length) await pool.query('DELETE FROM "AuthenticationSession" WHERE id = ANY($1::uuid[])', [sessionIds]);
    if (temporaryCredentialIds.length) await pool.query('DELETE FROM "TemporaryCredential" WHERE id = ANY($1::uuid[])', [temporaryCredentialIds]);
    if (identityIds.length) {
      await pool.query('DELETE FROM "AuthenticationCredential" WHERE "identityId" = ANY($1::uuid[])', [identityIds]);
      await pool.query('DELETE FROM "AuthenticationAttempt" WHERE "identityId" = ANY($1::uuid[])', [identityIds]);
      await pool.query('DELETE FROM "AuthenticationSecurityEvent" WHERE "identityId" = ANY($1::uuid[]) OR "actorIdentityId" = ANY($1::uuid[])', [identityIds]);
      await pool.query('DELETE FROM "RoleAssignment" WHERE "identityId" = ANY($1::uuid[]) OR "assignedByIdentityId" = ANY($1::uuid[])', [identityIds]);
      await pool.query('DELETE FROM "Identity" WHERE id = ANY($1::uuid[])', [identityIds]);
    }
    await app.close();
    await pool.end();
  });

  it('enforces protected credential, session, temporary credential, refresh, attempt, and immutable event constraints', async () => {
    const first = await pool.query<{ id: string }>("INSERT INTO \"Identity\" (status, \"updatedAt\") VALUES ('ACTIVE', CURRENT_TIMESTAMP) RETURNING id");
    const second = await pool.query<{ id: string }>("INSERT INTO \"Identity\" (status, \"updatedAt\") VALUES ('ACTIVE', CURRENT_TIMESTAMP) RETURNING id");
    identityIds.push(first.rows[0]!.id, second.rows[0]!.id);

    await pool.query('INSERT INTO "AuthenticationCredential" ("identityId", "normalizedEmail", "passwordHash", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP)', [first.rows[0]!.id, `first-${first.rows[0]!.id}@example.test`, 'phc']);
    await expect(pool.query('INSERT INTO "AuthenticationCredential" ("identityId", "normalizedEmail", "passwordHash", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP)', [first.rows[0]!.id, `duplicate-${first.rows[0]!.id}@example.test`, 'phc'])).rejects.toMatchObject({ code: '23505' });
    await expect(pool.query('INSERT INTO "AuthenticationCredential" ("identityId", "normalizedEmail", "passwordHash", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP)', [second.rows[0]!.id, `first-${first.rows[0]!.id}@example.test`, 'phc'])).rejects.toMatchObject({ code: '23505' });

    const temporary = await pool.query<{ id: string }>('INSERT INTO "TemporaryCredential" ("identityId", "normalizedEmail", "secretHash", "expiresAt") VALUES ($1, $2, $3, now() + interval \'24 hours\') RETURNING id', [first.rows[0]!.id, `temporary-${first.rows[0]!.id}@example.test`, 'phc']);
    temporaryCredentialIds.push(temporary.rows[0]!.id);
    await expect(pool.query('INSERT INTO "TemporaryCredential" ("identityId", "normalizedEmail", "secretHash", "expiresAt") VALUES ($1, $2, $3, now() + interval \'24 hours\')', [first.rows[0]!.id, `another-${first.rows[0]!.id}@example.test`, 'another-phc'])).rejects.toMatchObject({ code: '23505' });
    await pool.query("UPDATE \"TemporaryCredential\" SET status = 'INVALIDATED', \"invalidatedAt\" = now() WHERE id = $1", [temporary.rows[0]!.id]);

    const session = await pool.query<{ id: string }>('INSERT INTO "AuthenticationSession" ("identityId", "familyId", "expiresAt") VALUES ($1, gen_random_uuid(), now() + interval \'30 days\') RETURNING id', [first.rows[0]!.id]);
    sessionIds.push(session.rows[0]!.id);
    await pool.query('INSERT INTO "RefreshTokenHistory" ("sessionId", digest, "expiresAt") VALUES ($1, $2, now() + interval \'30 days\')', [session.rows[0]!.id, `digest-${session.rows[0]!.id}`]);
    await expect(pool.query('INSERT INTO "RefreshTokenHistory" ("sessionId", digest, "expiresAt") VALUES ($1, $2, now() + interval \'30 days\')', [session.rows[0]!.id, `digest-${session.rows[0]!.id}`])).rejects.toMatchObject({ code: '23505' });

    await pool.query('INSERT INTO "AuthenticationAttempt" ("identityId", "normalizedIdentityKeyDigest", "sourceAddressKeyDigest", "windowEndsAt") VALUES ($1, $2, $3, now() + interval \'15 minutes\')', [first.rows[0]!.id, 'identity-digest', 'source-digest']);
    const eventClient = await pool.connect();
    try {
      await eventClient.query('BEGIN');
      const event = await eventClient.query<{ id: string }>('INSERT INTO "AuthenticationSecurityEvent" (type, outcome, details) VALUES (\'LOGIN_FAILED\', \'DENIED\', \'{}\') RETURNING id');
      await eventClient.query('SAVEPOINT immutable_update');
      await expect(eventClient.query('UPDATE "AuthenticationSecurityEvent" SET outcome = \'APPLIED\' WHERE id = $1', [event.rows[0]!.id])).rejects.toMatchObject({ code: '55000' });
      await eventClient.query('ROLLBACK TO SAVEPOINT immutable_update');
      await eventClient.query('SAVEPOINT immutable_delete');
      await expect(eventClient.query('DELETE FROM "AuthenticationSecurityEvent" WHERE id = $1', [event.rows[0]!.id])).rejects.toMatchObject({ code: '55000' });
      await eventClient.query('ROLLBACK');
    } finally {
      eventClient.release();
    }

    const administratorBaseline = await pool.query<{ history: number; active: number }>(`
      SELECT
        count(*)::int AS history,
        count(*) FILTER (WHERE ra.status = 'ACTIVE' AND i.status = 'ACTIVE')::int AS active
      FROM "RoleAssignment" ra
      JOIN "Identity" i ON i.id = ra."identityId"
      WHERE ra.role = 'ADMINISTRATOR'
    `);
    const baseline = administratorBaseline.rows[0]!;
    const initialPredicates = await pool.query<{ never: boolean; noactive: boolean }>('SELECT "authentication_has_never_had_administrator_assignment"() AS never, "authentication_has_no_active_eligible_administrator"() AS noactive');
    expect(initialPredicates.rows[0]).toEqual({ never: baseline.history === 0, noactive: baseline.active === 0 });
    await pool.query("INSERT INTO \"RoleAssignment\" (\"identityId\", role, status, \"assignedByIdentityId\") VALUES ($1, 'ADMINISTRATOR', 'ACTIVE', $1)", [first.rows[0]!.id]);
    const activeAdministratorPredicates = await pool.query<{ never: boolean; noactive: boolean }>('SELECT "authentication_has_never_had_administrator_assignment"() AS never, "authentication_has_no_active_eligible_administrator"() AS noactive');
    expect(activeAdministratorPredicates.rows[0]).toEqual({ never: false, noactive: false });
    await pool.query("UPDATE \"RoleAssignment\" SET status = 'REVOKED', \"revokedAt\" = now() WHERE \"identityId\" = $1 AND role = 'ADMINISTRATOR'", [first.rows[0]!.id]);
    const historicalAdministratorPredicates = await pool.query<{ never: boolean; noactive: boolean }>('SELECT "authentication_has_never_had_administrator_assignment"() AS never, "authentication_has_no_active_eligible_administrator"() AS noactive');
    expect(historicalAdministratorPredicates.rows[0]).toEqual({ never: false, noactive: baseline.active === 0 });

    const indexes = await pool.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('TemporaryCredential', 'RefreshTokenHistory', 'AuthenticationSession', 'AuthenticationAttempt', 'AuthenticationSecurityEvent')");
    expect(indexes.rows.map((row) => row.indexname)).toContain('temporary_credentials_one_issued_identity');
    expect(indexes.rows.map((row) => row.indexname)).toContain('refresh_token_history_digest_key');
    await request(app.getHttpServer()).get('/health/live').expect(200, { status: 'ok' });
    await request(app.getHttpServer()).get('/health/ready').expect(200, { status: 'ready' });
  });
});
