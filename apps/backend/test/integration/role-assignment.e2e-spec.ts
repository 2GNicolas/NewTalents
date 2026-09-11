import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { BackendRuntimeConfiguration } from '../../src/config/environment.schema.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { RoleAssignmentService } from '../../src/identity/role-assignment.service.js';

describe('Feature 002 role-assignment persistence', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaService({ databaseUrl: process.env.DATABASE_URL! } as BackendRuntimeConfiguration);
  const createdIdentityIds: string[] = [];

  beforeEach(async () => {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO \"Identity\" (status, \"updatedAt\") VALUES ('ACTIVE', CURRENT_TIMESTAMP) RETURNING id",
    );
    createdIdentityIds.push(result.rows[0]!.id);
  });

  afterAll(async () => {
    if (createdIdentityIds.length > 0) {
      await pool.query('DELETE FROM "RoleAssignment" WHERE "identityId" = ANY($1::uuid[]) OR "assignedByIdentityId" = ANY($1::uuid[])', [createdIdentityIds]);
      await pool.query('DELETE FROM "Identity" WHERE id = ANY($1::uuid[])', [createdIdentityIds]);
    }
    await prisma.$disconnect();
    await pool.end();
  });

  it('retains role history and only returns effective active roles', async () => {
    const identityId = createdIdentityIds.at(-1)!;
    const service = new RoleAssignmentService(prisma);

    await expect(service.assign(identityId, 'TUTOR', identityId)).resolves.toMatchObject({ outcome: 'assigned' });
    await expect(service.assign(identityId, 'ACADEMY_USER', identityId)).resolves.toMatchObject({ outcome: 'assigned' });
    await expect(service.assign(identityId, 'TUTOR', identityId)).resolves.toEqual({ outcome: 'duplicate-active-role' });

    const activeBeforeRevoke = await service.findActiveRoles(identityId);
    expect(activeBeforeRevoke).toEqual(expect.arrayContaining(['TUTOR', 'ACADEMY_USER']));

    const tutor = await pool.query<{ id: string; assignedAt: Date; status: string }>(
      'SELECT id, "assignedAt", status FROM "RoleAssignment" WHERE "identityId" = $1 AND role = \'TUTOR\'',
      [identityId],
    );
    expect(tutor.rows[0]!.assignedAt).toBeInstanceOf(Date);
    await expect(service.revoke(tutor.rows[0]!.id)).resolves.toEqual({ outcome: 'revoked' });
    await expect(service.findActiveRoles(identityId)).resolves.toEqual(['ACADEMY_USER']);

    const historical = await pool.query<{ status: string; revokedAt: Date | null }>(
      'SELECT status, "revokedAt" FROM "RoleAssignment" WHERE id = $1',
      [tutor.rows[0]!.id],
    );
    expect(historical.rows[0]).toMatchObject({ status: 'REVOKED', revokedAt: expect.any(Date) });
    await expect(service.assign(identityId, 'TUTOR', identityId)).resolves.toMatchObject({ outcome: 'assigned' });
  });

  it('keeps roles for an inactive identity from becoming effective and safely handles unknown identities', async () => {
    const identityId = createdIdentityIds.at(-1)!;
    const service = new RoleAssignmentService(prisma);

    await service.assign(identityId, 'ANALYST', identityId);
    await pool.query('UPDATE "Identity" SET status = \'INACTIVE\', "deactivatedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1', [identityId]);

    await expect(service.findActiveRoles(identityId)).resolves.toEqual([]);
    await expect(service.assign('00000000-0000-0000-0000-000000000000', 'TUTOR', identityId)).resolves.toEqual({ outcome: 'unknown-identity' });
  });
});
