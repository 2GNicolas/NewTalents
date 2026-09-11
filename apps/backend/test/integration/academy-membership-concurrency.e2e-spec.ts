import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { BackendRuntimeConfiguration } from '../../src/config/environment.schema.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { AcademyMembershipService } from '../../src/academy-membership/academy-membership.service.js';
import { MembershipTransitionService } from '../../src/academy-membership/membership-transition.service.js';

describe('Feature 002 academy membership transitions', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaService({ databaseUrl: process.env.DATABASE_URL! } as BackendRuntimeConfiguration);
  const identities: string[] = []; const academies: string[] = [];
  let identityId: string; let firstAcademyId: string; let secondAcademyId: string;

  beforeEach(async () => {
    identityId = (await pool.query<{ id: string }>("INSERT INTO \"Identity\" (status, \"updatedAt\") VALUES ('ACTIVE', CURRENT_TIMESTAMP) RETURNING id")).rows[0]!.id;
    firstAcademyId = (await pool.query<{ id: string }>('INSERT INTO "Academy" DEFAULT VALUES RETURNING id')).rows[0]!.id;
    secondAcademyId = (await pool.query<{ id: string }>('INSERT INTO "Academy" DEFAULT VALUES RETURNING id')).rows[0]!.id;
    identities.push(identityId); academies.push(firstAcademyId, secondAcademyId);
  });
  afterAll(async () => {
    await pool.query('DELETE FROM "AcademyMembership" WHERE "identityId" = ANY($1::uuid[])', [identities]);
    await pool.query('DELETE FROM "Identity" WHERE id = ANY($1::uuid[])', [identities]);
    await pool.query('DELETE FROM "Academy" WHERE id = ANY($1::uuid[])', [academies]);
    await prisma.$disconnect(); await pool.end();
  });

  it('preserves history across an atomic transition and rolls back an invalid target', async () => {
    const membership = new AcademyMembershipService(prisma); const transition = new MembershipTransitionService(prisma);
    await expect(membership.create(identityId, firstAcademyId, identityId)).resolves.toMatchObject({ outcome: 'created' });
    await expect(transition.transition(identityId, secondAcademyId, identityId)).resolves.toEqual({ outcome: 'transitioned' });
    await expect(membership.current(identityId)).resolves.toMatchObject({ academyId: secondAcademyId, status: 'ACTIVE' });
    await expect(transition.transition(identityId, '00000000-0000-0000-0000-000000000000', identityId)).resolves.toEqual({ outcome: 'unknown-academy' });
    await expect(membership.current(identityId)).resolves.toMatchObject({ academyId: secondAcademyId });
    const history = await membership.history(identityId); expect(history.filter((row) => row.status === 'ENDED')).toHaveLength(1);
  });

  it('uses separate sessions concurrently and leaves at most one active membership', async () => {
    const left = new Pool({ connectionString: process.env.DATABASE_URL }); const right = new Pool({ connectionString: process.env.DATABASE_URL });
    const attempts = await Promise.allSettled([
      left.query("INSERT INTO \"AcademyMembership\" (\"identityId\", \"academyId\", status, \"assignedByIdentityId\") VALUES ($1, $2, 'ACTIVE', $1)", [identityId, firstAcademyId]),
      right.query("INSERT INTO \"AcademyMembership\" (\"identityId\", \"academyId\", status, \"assignedByIdentityId\") VALUES ($1, $2, 'ACTIVE', $1)", [identityId, secondAcademyId]),
    ]);
    await left.end(); await right.end();
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    const active = await pool.query('SELECT id FROM "AcademyMembership" WHERE "identityId" = $1 AND status = \'ACTIVE\'', [identityId]);
    expect(active.rowCount).toBe(1);
  });
});
