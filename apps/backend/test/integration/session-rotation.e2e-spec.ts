import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { SessionService } from '../../src/authentication/session.service.js';
import { RefreshTokenService } from '../../src/authentication/refresh-token.service.js';
import { TokenService } from '../../src/authentication/token.service.js';
import { AuthenticationTransactionService } from '../../src/authentication/authentication-transaction.service.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { parseBackendEnvironment } from '../../src/config/environment.schema.js';

describe('Feature 003 session rotation', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaService(parseBackendEnvironment(process.env));
  const transactions = new AuthenticationTransactionService(prisma);
  const events = { record: async () => undefined } as never;
  const tokens = new TokenService(parseBackendEnvironment(process.env));
  const sessions = new SessionService(prisma, transactions, events);
  const refreshes = new RefreshTokenService(prisma, transactions, tokens, events);
  let identityId: string;
  const sessionIds: string[] = [];

  beforeAll(async () => {
    const identity = await pool.query<{ id: string }>("INSERT INTO \"Identity\" (status, \"updatedAt\") VALUES ('ACTIVE', now()) RETURNING id");
    identityId = identity.rows[0]!.id;
    await pool.query("INSERT INTO \"RoleAssignment\" (\"identityId\", role, status, \"assignedByIdentityId\") VALUES ($1, 'ANALYST', 'ACTIVE', $1)", [identityId]);
  });
  afterAll(async () => {
    if (sessionIds.length) await pool.query('DELETE FROM "RefreshTokenHistory" WHERE "sessionId" = ANY($1::uuid[])', [sessionIds]);
    if (sessionIds.length) await pool.query('DELETE FROM "AuthenticationSession" WHERE id = ANY($1::uuid[])', [sessionIds]);
    await pool.query('DELETE FROM "RoleAssignment" WHERE "identityId" = $1', [identityId]);
    await pool.query('DELETE FROM "Identity" WHERE id = $1', [identityId]);
    await prisma.$disconnect(); await pool.end();
  });

  it('creates independent persistent session families and rotates each refresh token once', async () => {
    const first = await sessions.create(identityId); const second = await sessions.create(identityId);
    expect(first).not.toBeNull(); expect(second).not.toBeNull(); expect(first).not.toBe(second);
    sessionIds.push(first!, second!);
    expect(await sessions.validate(identityId, first)).toBe(true);
    const raw = await refreshes.issue(first!);
    const rotation = await refreshes.rotate(raw);
    expect(rotation.outcome).toBe('rotated');
    if (rotation.outcome === 'rotated') {
      expect(typeof rotation.accessToken).toBe('string');
      expect(rotation.accessToken.length).toBeGreaterThan(80);
      expect(rotation.expiresIn).toBe(900);
      expect(typeof rotation.refreshToken).toBe('string');
      expect(rotation.access).toEqual({ classification: 'product', capabilities: [] });
    }
    await expect(refreshes.rotate(raw)).resolves.toEqual({ outcome: 'denied' });
    expect(await sessions.validate(identityId, first)).toBe(false);
    expect(await sessions.validate(identityId, second)).toBe(true);
    await expect(sessions.logoutCurrent(identityId, second)).resolves.toBe(true);
    expect(await sessions.validate(identityId, second)).toBe(false);
  });
});
