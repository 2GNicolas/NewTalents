import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthorizationService } from '../../src/authorization/authorization.service.js';
import { CredentialService } from '../../src/authentication/credential.service.js';
import { TemporaryCredentialService } from '../../src/authentication/temporary-credential.service.js';
import { AuthenticationTransactionService } from '../../src/authentication/authentication-transaction.service.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { parseBackendEnvironment } from '../../src/config/environment.schema.js';

describe('Feature 003 credential lifecycle', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let actorId: string;
  let targetId: string;
  const prisma = new PrismaService(parseBackendEnvironment(process.env));

  beforeAll(async () => {
    const actor = await pool.query<{ id: string }>("INSERT INTO \"Identity\" (status, \"updatedAt\") VALUES ('ACTIVE', now()) RETURNING id");
    const target = await pool.query<{ id: string }>("INSERT INTO \"Identity\" (status, \"updatedAt\") VALUES ('ACTIVE', now()) RETURNING id");
    actorId = actor.rows[0]!.id;
    targetId = target.rows[0]!.id;
    await pool.query("INSERT INTO \"RoleAssignment\" (\"identityId\", role, status, \"assignedByIdentityId\") VALUES ($1, 'ADMINISTRATOR', 'ACTIVE', $1)", [actorId]);
    await pool.query("INSERT INTO \"RoleAssignment\" (\"identityId\", role, status, \"assignedByIdentityId\") VALUES ($1, 'ANALYST', 'ACTIVE', $1)", [targetId]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM "AuthenticationSession" WHERE "identityId" IN ($1, $2)', [actorId, targetId]);
    await pool.query('DELETE FROM "TemporaryCredential" WHERE "identityId" IN ($1, $2)', [actorId, targetId]);
    await pool.query('DELETE FROM "AuthenticationCredential" WHERE "identityId" IN ($1, $2)', [actorId, targetId]);
    await pool.query('DELETE FROM "RoleAssignment" WHERE "identityId" IN ($1, $2) OR "assignedByIdentityId" IN ($1, $2)', [actorId, targetId]);
    await pool.query('DELETE FROM "Identity" WHERE id IN ($1, $2)', [actorId, targetId]);
    await prisma.$disconnect();
    await pool.end();
  });

  it('allows only current Administrator-authorized existing eligible identity provisioning', async () => {
    const service = new TemporaryCredentialService(prisma, new AuthorizationService(), new CredentialService(), new AuthenticationTransactionService(prisma), { record: async () => undefined } as never);
    const result = await service.provision({ actorIdentityId: actorId, identityId: targetId, normalizedEmail: `target-${targetId}@example.test` });
    expect(result.outcome).toBe('provisioned');
    if (result.outcome === 'provisioned') expect(result.temporaryCredential).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
