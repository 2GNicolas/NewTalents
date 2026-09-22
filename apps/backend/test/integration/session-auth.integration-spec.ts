import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

import { AuthenticationTransactionService } from '../../src/authentication/authentication-transaction.service.js';
import { RefreshTokenService } from '../../src/authentication/refresh-token.service.js';
import { SessionService } from '../../src/authentication/session.service.js';
import { TokenService } from '../../src/authentication/token.service.js';
import { parseBackendEnvironment } from '../../src/config/environment.schema.js';
import { PrismaService } from '../../src/database/prisma.service.js';

describe('Feature 003 USER session preservation', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaService(parseBackendEnvironment(process.env));
  const transactions = new AuthenticationTransactionService(prisma);
  const events = { record: async () => undefined } as never;
  const sessions = new SessionService(prisma, transactions, events);
  const refreshes = new RefreshTokenService(prisma, transactions, new TokenService(parseBackendEnvironment(process.env)), events);
  let identityId = '';
  const sessionIds: string[] = [];

  beforeAll(async () => {
    const identity = await pool.query<{ id: string }>(
      `INSERT INTO "Identity" (status, "updatedAt") VALUES ('ACTIVE', now()) RETURNING id`,
    );
    identityId = identity.rows[0]!.id;
    await pool.query(
      `INSERT INTO "RoleAssignment" ("identityId", role, status, "assignedByIdentityId") VALUES ($1, 'USER', 'ACTIVE', $1)`,
      [identityId],
    );
  });

  afterAll(async () => {
    if (sessionIds.length) await pool.query(`DELETE FROM "RefreshTokenHistory" WHERE "sessionId" = ANY($1::uuid[])`, [sessionIds]);
    if (sessionIds.length) await pool.query(`DELETE FROM "AuthenticationSession" WHERE id = ANY($1::uuid[])`, [sessionIds]);
    if (identityId) {
      await pool.query(`DELETE FROM "RoleAssignment" WHERE "identityId" = $1`, [identityId]);
      await pool.query(`DELETE FROM "Identity" WHERE id = $1`, [identityId]);
    }
    await prisma.$disconnect();
    await pool.end();
  });

  it('keeps USER on the existing create, validate, renew and revoke path without provisioning authority', async () => {
    const sessionId = await sessions.create(identityId);
    expect(sessionId).not.toBeNull();
    sessionIds.push(sessionId!);
    await expect(sessions.validate(identityId, sessionId)).resolves.toBe(true);

    const refreshToken = await refreshes.issue(sessionId!);
    const rotation = await refreshes.rotate(refreshToken);
    expect(rotation.outcome).toBe('rotated');
    await expect(refreshes.rotate(refreshToken)).resolves.toEqual({ outcome: 'denied' });

    const authorityRows = await pool.query<{ count: string }>(
      `SELECT
        (SELECT count(*) FROM "PassportResponsibility" WHERE "identityId" = $1) +
        (SELECT count(*) FROM "HistoricalTutorReconciliationAudit" WHERE "actorIdentityId" = $1) AS count`,
      [identityId],
    );
    expect(authorityRows.rows[0]?.count).toBe('0');
  });
});
