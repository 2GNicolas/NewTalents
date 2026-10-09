import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

  async function remove(identityId: string): Promise<void> {
    await pool.query('DELETE FROM "AuthenticationSession" WHERE "identityId" = $1', [identityId]);
    await pool.query('DELETE FROM "AuthenticationCredential" WHERE "identityId" = $1', [identityId]);
    await pool.query('DELETE FROM "RoleAssignment" WHERE "identityId" = $1 OR "assignedByIdentityId" = $1', [identityId]);
    await pool.query('DELETE FROM "Identity" WHERE id = $1', [identityId]);
  }

  beforeAll(async () => {
    const administrators = await pool.query('SELECT count(*)::int AS count FROM "RoleAssignment" WHERE role = \'ADMINISTRATOR\'');
    if (administrators.rows[0]!.count !== 0) throw new Error('Phase 6 integration requires an isolated database without Administrator history');
  });

  afterAll(async () => {
    for (const identityId of identities.reverse()) await remove(identityId);
    await prisma.$disconnect();
    await pool.end();
  });

  it('initializes exactly the approved persistent state once and refuses a historical repeat', async () => {
    const result = await bootstrap.initialize({ confirmation: true, email: 'bootstrap-admin@example.test', password: 'a-valid-operator-password' });
    expect(result.outcome).toBe('initialized');
    if (result.outcome !== 'initialized') return;
    identities.push(result.identityId);
    expect(await prisma.authenticationCredential.count({ where: { identityId: result.identityId } })).toBe(1);
    expect(await prisma.roleAssignment.count({ where: { identityId: result.identityId, role: 'ADMINISTRATOR', status: 'ACTIVE' } })).toBe(1);
    expect(await prisma.authenticationSession.count({ where: { identityId: result.identityId } })).toBe(0);
    await expect(bootstrap.initialize({ confirmation: true, email: 'duplicate-admin@example.test', password: 'a-valid-operator-password' })).resolves.toEqual({ outcome: 'refused' });
  });

  it('does not reactivate historical Administrators during recovery and contains concurrent recovery', async () => {
    const bootstrapId = identities.pop();
    if (!bootstrapId) throw new Error('bootstrap fixture missing');
    await remove(bootstrapId);
    const historic = await pool.query<{ id: string }>("INSERT INTO \"Identity\" (status, \"updatedAt\", \"deactivatedAt\") VALUES ('INACTIVE', now(), now()) RETURNING id");
    const historicId = historic.rows[0]!.id;
    identities.push(historicId);
    await pool.query("INSERT INTO \"RoleAssignment\" (\"identityId\", role, status, \"assignedByIdentityId\") VALUES ($1, 'ADMINISTRATOR', 'ACTIVE', $1)", [historicId]);
    const [first, second] = await Promise.all([
      recovery.recover({ confirmation: true, email: 'recovery-one@example.test', password: 'a-valid-operator-password' }),
      recovery.recover({ confirmation: true, email: 'recovery-two@example.test', password: 'a-valid-operator-password' }),
    ]);
    const successes = [first, second].filter((result): result is Extract<typeof result, { outcome: 'recovered' }> => result.outcome === 'recovered');
    expect(successes).toHaveLength(1);
    identities.push(successes[0]!.identityId);
    expect(await prisma.identity.findUnique({ where: { id: historicId }, select: { status: true } })).toEqual({ status: 'INACTIVE' });
    expect(await prisma.authenticationSession.count({ where: { identityId: successes[0]!.identityId } })).toBe(0);
  });
});
