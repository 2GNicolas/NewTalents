import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

import { AdministratorBootstrapService } from '../../src/authentication/administrator-bootstrap.service.js';
import { AdministratorRecoveryService } from '../../src/authentication/administrator-recovery.service.js';
import { AuthenticationTransactionService } from '../../src/authentication/authentication-transaction.service.js';
import { CredentialService } from '../../src/authentication/credential.service.js';
import { parseBackendEnvironment } from '../../src/config/environment.schema.js';
import { PrismaService } from '../../src/database/prisma.service.js';

describe('Administrator bootstrap and recovery persistence', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaService(parseBackendEnvironment(process.env));
  const transactions = new AuthenticationTransactionService(prisma);
  const events = { record: async () => undefined } as never;
  const bootstrap = new AdministratorBootstrapService(transactions, new CredentialService(), events);
  const recovery = new AdministratorRecoveryService(transactions, new CredentialService(), events);
  const identities: string[] = [];
  let baselineHasHistory = false;
  let baselineHasActiveAdministrator = false;
  let bootstrapIdentityId: string | undefined;

  async function remove(identityId: string): Promise<void> {
    await pool.query('DELETE FROM "AuthenticationSession" WHERE "identityId" = $1', [identityId]);
    await pool.query('DELETE FROM "AuthenticationCredential" WHERE "identityId" = $1', [identityId]);
    await pool.query('DELETE FROM "RoleAssignment" WHERE "identityId" = $1 OR "assignedByIdentityId" = $1', [identityId]);
    await pool.query('DELETE FROM "Identity" WHERE id = $1', [identityId]);
  }

  beforeAll(async () => {
    const administrators = await pool.query<{ history: number; active: number }>(`
      SELECT
        count(*)::int AS history,
        count(*) FILTER (WHERE ra.status = 'ACTIVE' AND i.status = 'ACTIVE')::int AS active
      FROM "RoleAssignment" ra
      JOIN "Identity" i ON i.id = ra."identityId"
      WHERE ra.role = 'ADMINISTRATOR'
    `);
    baselineHasHistory = administrators.rows[0]!.history > 0;
    baselineHasActiveAdministrator = administrators.rows[0]!.active > 0;
  });

  afterAll(async () => {
    for (const identityId of identities.reverse()) await remove(identityId);
    await prisma.$disconnect();
    await pool.end();
  });

  it('initializes exactly the approved persistent state once and refuses a historical repeat', async () => {
    const suffix = randomUUID();
    const result = await bootstrap.initialize({ confirmation: true, email: `bootstrap-${suffix}@example.test`, password: 'a-valid-operator-password' });
    if (baselineHasHistory) {
      expect(result).toEqual({ outcome: 'refused' });
      return;
    }
    expect(result.outcome).toBe('initialized');
    if (result.outcome !== 'initialized') return;
    bootstrapIdentityId = result.identityId;
    identities.push(result.identityId);
    expect(await prisma.authenticationCredential.count({ where: { identityId: result.identityId } })).toBe(1);
    expect(await prisma.roleAssignment.count({ where: { identityId: result.identityId, role: 'ADMINISTRATOR', status: 'ACTIVE' } })).toBe(1);
    expect(await prisma.authenticationSession.count({ where: { identityId: result.identityId } })).toBe(0);
    await expect(bootstrap.initialize({ confirmation: true, email: `duplicate-${suffix}@example.test`, password: 'a-valid-operator-password' })).resolves.toEqual({ outcome: 'refused' });
  });

  it('does not reactivate historical Administrators during recovery and contains concurrent recovery', async () => {
    const suffix = randomUUID();
    if (baselineHasActiveAdministrator) {
      await expect(recovery.recover({ confirmation: true, email: `recovery-refused-${suffix}@example.test`, password: 'a-valid-operator-password' })).resolves.toEqual({ outcome: 'refused' });
      return;
    }
    if (bootstrapIdentityId) {
      await remove(bootstrapIdentityId);
      identities.splice(identities.indexOf(bootstrapIdentityId), 1);
      bootstrapIdentityId = undefined;
    }
    const historic = await pool.query<{ id: string }>("INSERT INTO \"Identity\" (status, \"updatedAt\", \"deactivatedAt\") VALUES ('INACTIVE', now(), now()) RETURNING id");
    const historicId = historic.rows[0]!.id;
    identities.push(historicId);
    await pool.query("INSERT INTO \"RoleAssignment\" (\"identityId\", role, status, \"assignedByIdentityId\") VALUES ($1, 'ADMINISTRATOR', 'ACTIVE', $1)", [historicId]);
    const [first, second] = await Promise.all([
      recovery.recover({ confirmation: true, email: `recovery-one-${suffix}@example.test`, password: 'a-valid-operator-password' }),
      recovery.recover({ confirmation: true, email: `recovery-two-${suffix}@example.test`, password: 'a-valid-operator-password' }),
    ]);
    const successes = [first, second].filter((result): result is Extract<typeof result, { outcome: 'recovered' }> => result.outcome === 'recovered');
    expect(successes).toHaveLength(1);
    identities.push(successes[0]!.identityId);
    expect(await prisma.identity.findUnique({ where: { id: historicId }, select: { status: true } })).toEqual({ status: 'INACTIVE' });
    expect(await prisma.authenticationSession.count({ where: { identityId: successes[0]!.identityId } })).toBe(0);
  });
});
