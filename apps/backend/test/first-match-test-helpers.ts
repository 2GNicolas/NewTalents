import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

export type FirstMatchFixture = Readonly<{
  ownerId: string;
  analystId: string;
  playerId: string;
  passportId: string;
  allowanceId: string;
}>;

/** Use inside a test-owned transaction and ROLLBACK it after each focused check. */
export async function createFirstMatchFixture(
  client: PoolClient,
  options: Readonly<{ withCustody?: boolean; activatedOn?: string; cadence?: 'MONTHLY' | 'QUARTERLY'; limit?: number }> = {},
): Promise<FirstMatchFixture> {
  const ownerId = randomUUID();
  const analystId = randomUUID();
  const playerId = randomUUID();
  const passportId = randomUUID();
  const allowanceId = randomUUID();
  await client.query('INSERT INTO "Identity" (id, "updatedAt") VALUES ($1, now()), ($2, now())', [ownerId, analystId]);
  await client.query(`INSERT INTO "RoleAssignment" (id, "identityId", role, "assignedByIdentityId")
    VALUES (gen_random_uuid(), $1, 'USER', $1), (gen_random_uuid(), $2, 'ANALYST', $1)`, [ownerId, analystId]);
  await client.query('INSERT INTO "Player" (id, "updatedAt") VALUES ($1, now())', [playerId]);
  await client.query(`INSERT INTO "PlayerPassport" (id, "playerId", state, "originKind", position, "ageCategory", city,
    country, "dominantFoot", "createdByIdentityId", "updatedAt")
    VALUES ($1, $2, 'ACTIVE', 'PARTICULAR', 'Defensa', 'Sub-17', 'Bogota', 'Colombia', 'RIGHT', $3, now())`,
    [passportId, playerId, ownerId]);
  await client.query(`INSERT INTO "PassportResponsibility" (id, "passportId", "identityId", kind)
    VALUES (gen_random_uuid(), $1, $2, 'SELF')`, [passportId, ownerId]);
  if (options.withCustody) {
    await client.query(`INSERT INTO "AnalystOperationalProfile"
      ("identityId", "displayLabel", "normalizedLabel", "updatedAt")
      VALUES ($1, 'Analista sintetico', 'analista sintetico', now())`, [analystId]);
    await client.query(`INSERT INTO "PassportCustody" (id, "passportId", "currentAnalystIdentityId", "assignedAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, now(), now())`, [passportId, analystId]);
  }
  await client.query(`INSERT INTO "PassportMatchAllowance" (id, "passportId", "activatedOn", "updatedAt")
    VALUES ($1, $2, $3::date, now())`, [allowanceId, passportId, options.activatedOn ?? '2026-01-31']);
  await client.query(`INSERT INTO "PassportMatchAllowanceRevision"
    (id, "allowanceId", sequence, "idempotencyKey", "expectedVersion", cadence, "matchLimit", "effectiveOn", "confirmedByIdentityId")
    VALUES (gen_random_uuid(), $1, 1, $2, 0, $3, $4, $5::date, $6)`,
    [allowanceId, randomUUID(), options.cadence ?? 'MONTHLY', options.limit ?? 4, options.activatedOn ?? '2026-01-31', ownerId]);
  return { ownerId, analystId, playerId, passportId, allowanceId };
}

export async function insertSyntheticFirstMatch(
  client: PoolClient,
  fixture: FirstMatchFixture,
  options: Readonly<{ date: string; state?: 'WAITING' | 'CANCELED' | 'LOADED'; playerId?: string; passportId?: string; loadId?: string }>,
): Promise<string> {
  const id = randomUUID();
  const state = options.state ?? 'WAITING';
  const unitState = { WAITING: 'RESERVED', CANCELED: 'RELEASED', LOADED: 'USED' }[state];
  await client.query(`INSERT INTO "FirstMatch"
    (id, "passportId", "playerId", "matchDate", "matchTime", opponent, competition, venue,
     "scheduledByIdentityId", state, "unitState", "updatedAt", "loadedByAnalystIdentityId", "loadId", "loadedAt",
     "canceledByIdentityId", "canceledAt")
    VALUES ($1, $2, $3, $4::date, '10:00', 'Rival sintetico', 'Liga sintetica', 'Cancha sintetica',
      $5, $6, $7, now(), $8, $9, $10, $11, $12)`,
    [id, options.passportId ?? fixture.passportId, options.playerId ?? fixture.playerId, options.date,
      fixture.ownerId, state, unitState,
      state === 'LOADED' ? fixture.analystId : null, state === 'LOADED' ? options.loadId ?? randomUUID() : null,
      state === 'LOADED' ? new Date() : null, state === 'CANCELED' ? fixture.ownerId : null,
      state === 'CANCELED' ? new Date() : null]);
  return id;
}

export const FIRST_MATCH_BOUNDARY_DATES = ['2026-02-27', '2026-02-28', '2026-03-30', '2026-03-31'] as const;
