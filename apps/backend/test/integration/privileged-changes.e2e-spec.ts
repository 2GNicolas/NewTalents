import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import type { BackendRuntimeConfiguration } from '../../src/config/environment.schema.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { AuthorizationService } from '../../src/authorization/authorization.service.js';
import { PrivilegedChangesService } from '../../src/privileged-changes/privileged-changes.service.js';

describe('Feature 002 privileged changes', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL }); const ids: string[] = []; const academies: string[] = [];
  const prisma = new PrismaService({ databaseUrl: process.env.DATABASE_URL! } as BackendRuntimeConfiguration);
  const identity = async () => { const row = await pool.query<{id:string}>("INSERT INTO \"Identity\" (status, \"updatedAt\") VALUES ('ACTIVE', CURRENT_TIMESTAMP) RETURNING id"); ids.push(row.rows[0]!.id); return row.rows[0]!.id; };
  afterAll(async () => { await pool.query('DELETE FROM "AuthorizationChangeRecord" WHERE "actorIdentityId" = ANY($1::uuid[]) OR "targetIdentityId" = ANY($1::uuid[])', [ids]); await pool.query('DELETE FROM "RoleAssignment" WHERE "identityId" = ANY($1::uuid[]) OR "assignedByIdentityId" = ANY($1::uuid[])', [ids]); await pool.query('DELETE FROM "AcademyMembership" WHERE "identityId" = ANY($1::uuid[])', [ids]); await pool.query('DELETE FROM "Identity" WHERE id = ANY($1::uuid[])', [ids]); await pool.query('DELETE FROM "Academy" WHERE id = ANY($1::uuid[])', [academies]); await prisma.$disconnect(); await pool.end(); });
  it('commits an Administrator role change and its immutable safe trace together', async () => {
    const admin = await identity(); const target = await identity();
    const service = new PrivilegedChangesService(prisma, new AuthorizationService());
    const actor = { version: '1' as const, permission: 'ignored', resource: { classification: 'protected' as const }, subject: { kind: 'authenticated' as const, identityId: admin, status: 'ACTIVE' as const, roles: [{ role: 'ADMINISTRATOR' as const, active: true }] } };
    await expect(service.assignRole(actor, target, 'ANALYST')).resolves.toEqual({ outcome: 'applied' });
    expect((await pool.query('SELECT id FROM "RoleAssignment" WHERE "identityId"=$1', [target])).rowCount).toBe(1);
    expect((await pool.query('SELECT id, outcome FROM "AuthorizationChangeRecord" WHERE "targetIdentityId"=$1', [target])).rows[0]).toMatchObject({ outcome: 'APPLIED' });
  });
  it('records applied role revocation and membership assignment, change, and revocation atomically', async () => {
    const admin = await identity(); const target = await identity();
    const academyA = (await pool.query<{id:string}>('INSERT INTO "Academy" DEFAULT VALUES RETURNING id')).rows[0]!.id;
    const academyB = (await pool.query<{id:string}>('INSERT INTO "Academy" DEFAULT VALUES RETURNING id')).rows[0]!.id;
    academies.push(academyA, academyB);
    const service = new PrivilegedChangesService(prisma, new AuthorizationService());
    const actor = { version: '1' as const, permission: 'ignored', resource: { classification: 'protected' as const }, subject: { kind: 'authenticated' as const, identityId: admin, status: 'ACTIVE' as const, roles: [{ role: 'ADMINISTRATOR' as const, active: true }] } };
    await service.assignRole(actor, target, 'TUTOR');
    const roleId = (await pool.query<{id:string}>('SELECT id FROM "RoleAssignment" WHERE "identityId"=$1 AND status=\'ACTIVE\'', [target])).rows[0]!.id;
    await expect(service.revokeRole(actor, roleId, target)).resolves.toEqual({ outcome: 'applied' });
    await expect(service.assignMembership(actor, target, academyA)).resolves.toEqual({ outcome: 'applied' });
    await expect(service.changeMembership(actor, target, academyB)).resolves.toEqual({ outcome: 'applied' });
    const membershipId = (await pool.query<{id:string}>('SELECT id FROM "AcademyMembership" WHERE "identityId"=$1 AND status=\'ACTIVE\'', [target])).rows[0]!.id;
    await expect(service.revokeMembership(actor, membershipId, target)).resolves.toEqual({ outcome: 'applied' });
    expect((await pool.query('SELECT outcome, operation, "policyVersion" FROM "AuthorizationChangeRecord" WHERE "targetIdentityId"=$1', [target])).rows).toHaveLength(5);
  });
  it('denies an Analyst without effective mutation while retaining a safe denied audit', async () => {
    const analyst = await identity(); const target = await identity(); const service = new PrivilegedChangesService(prisma, new AuthorizationService());
    const actor = { version: '1' as const, permission: 'ignored', resource: { classification: 'protected' as const }, subject: { kind: 'authenticated' as const, identityId: analyst, status: 'ACTIVE' as const, roles: [{ role: 'ANALYST' as const, active: true }] } };
    await expect(service.assignRole(actor, target, 'TUTOR')).resolves.toEqual({ outcome: 'denied' });
    expect((await pool.query('SELECT id FROM "RoleAssignment" WHERE "identityId"=$1', [target])).rowCount).toBe(0);
    expect((await pool.query('SELECT outcome FROM "AuthorizationChangeRecord" WHERE "targetIdentityId"=$1', [target])).rows[0]).toMatchObject({ outcome: 'DENIED' });
  });
});
