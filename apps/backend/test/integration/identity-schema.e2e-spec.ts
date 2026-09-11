import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';

import { createApplication } from '../../src/main.js';

describe('Feature 002 identity persistence schema', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let app: INestApplication;
  let identityId: string;
  let secondIdentityId: string;
  let academyUserIdentityId: string;
  let academyId: string;

  beforeAll(async () => {
    app = await createApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    if (identityId || secondIdentityId || academyUserIdentityId) {
      await pool.query(
        'DELETE FROM "AuthorizationChangeRecord" WHERE "actorIdentityId" = ANY($1::uuid[]) OR "targetIdentityId" = ANY($1::uuid[])',
        [[identityId, secondIdentityId, academyUserIdentityId].filter(Boolean)],
      );
      await pool.query(
        'DELETE FROM "AcademyMembership" WHERE "identityId" = ANY($1::uuid[])',
        [[identityId, secondIdentityId, academyUserIdentityId].filter(Boolean)],
      );
      await pool.query(
        'DELETE FROM "RoleAssignment" WHERE "identityId" = ANY($1::uuid[]) OR "assignedByIdentityId" = ANY($1::uuid[])',
        [[identityId, secondIdentityId, academyUserIdentityId].filter(Boolean)],
      );
    }
    if (identityId) await pool.query('DELETE FROM "Identity" WHERE id = $1', [identityId]);
    if (secondIdentityId) await pool.query('DELETE FROM "Identity" WHERE id = $1', [secondIdentityId]);
    if (academyUserIdentityId) await pool.query('DELETE FROM "Identity" WHERE id = $1', [academyUserIdentityId]);
    if (academyId) await pool.query('DELETE FROM "Academy" WHERE id = $1', [academyId]);
    await app.close();
    await pool.end();
  });

  it('persists identity, role, academy membership history, constraints, and trace fields', async () => {
    const identity = await pool.query<{ id: string }>("INSERT INTO \"Identity\" (status, \"updatedAt\") VALUES ('ACTIVE', CURRENT_TIMESTAMP) RETURNING id");
    identityId = identity.rows[0]!.id;
    const academy = await pool.query<{ id: string }>('INSERT INTO "Academy" DEFAULT VALUES RETURNING id');
    academyId = academy.rows[0]!.id;
    const second = await pool.query<{ id: string }>("INSERT INTO \"Identity\" (status, \"updatedAt\") VALUES ('ACTIVE', CURRENT_TIMESTAMP) RETURNING id");
    secondIdentityId = second.rows[0]!.id;
    const academyUser = await pool.query<{ id: string }>("INSERT INTO \"Identity\" (status, \"updatedAt\") VALUES ('ACTIVE', CURRENT_TIMESTAMP) RETURNING id");
    academyUserIdentityId = academyUser.rows[0]!.id;

    await pool.query("INSERT INTO \"RoleAssignment\" (\"identityId\", role, status, \"assignedByIdentityId\") VALUES ($1, 'TUTOR', 'ACTIVE', $1)", [identityId]);
    await pool.query("INSERT INTO \"RoleAssignment\" (\"identityId\", role, status, \"assignedByIdentityId\") VALUES ($1, 'ACADEMY_USER', 'ACTIVE', $1)", [identityId]);
    await expect(pool.query("INSERT INTO \"RoleAssignment\" (\"identityId\", role, status, \"assignedByIdentityId\") VALUES ($1, 'TUTOR', 'ACTIVE', $1)", [identityId])).rejects.toMatchObject({ code: '23505' });
    await expect(pool.query("INSERT INTO \"RoleAssignment\" (\"identityId\", role, status, \"assignedByIdentityId\") VALUES ('00000000-0000-0000-0000-000000000000', 'ANALYST', 'ACTIVE', $1)", [identityId])).rejects.toMatchObject({ code: '23503' });

    const membership = await pool.query<{ id: string }>("INSERT INTO \"AcademyMembership\" (\"identityId\", \"academyId\", status, \"assignedByIdentityId\") VALUES ($1, $2, 'ACTIVE', $1) RETURNING id", [identityId, academyId]);
    await expect(pool.query("INSERT INTO \"AcademyMembership\" (\"identityId\", \"academyId\", status, \"assignedByIdentityId\") VALUES ($1, $2, 'ACTIVE', $1)", [identityId, academyId])).rejects.toMatchObject({ code: '23505' });
    await pool.query("UPDATE \"AcademyMembership\" SET status = 'ENDED', \"endedAt\" = now() WHERE id = $1", [membership.rows[0]!.id]);
    await pool.query("INSERT INTO \"AcademyMembership\" (\"identityId\", \"academyId\", status, \"assignedByIdentityId\") VALUES ($1, $2, 'ACTIVE', $1)", [identityId, academyId]);
    await pool.query("INSERT INTO \"AcademyMembership\" (\"identityId\", \"academyId\", status, \"assignedByIdentityId\") VALUES ($1, $2, 'ACTIVE', $1)", [academyUserIdentityId, academyId]);
    await pool.query("INSERT INTO \"AuthorizationChangeRecord\" (\"actorIdentityId\", \"targetIdentityId\", operation, \"priorState\", \"resultingState\", outcome, \"reasonCategory\", \"policyVersion\") VALUES ($1, $2, 'MEMBERSHIP_ASSIGNED', '{}', '{}', 'APPLIED', 'NONE', '1')", [identityId, secondIdentityId]);

    const indexes = await pool.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('AcademyMembership', 'RoleAssignment')");
    expect(indexes.rows.map((row) => row.indexname)).toContain('academy_memberships_one_active_identity');
    expect(indexes.rows.map((row) => row.indexname)).toContain('role_assignments_one_active_role');
    await request(app.getHttpServer()).get('/health/live').expect(200, { status: 'ok' });
    await request(app.getHttpServer()).get('/health/ready').expect(200, { status: 'ready' });
  });
});
