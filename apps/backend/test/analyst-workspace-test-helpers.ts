import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { createFirstMatchFixture, insertSyntheticFirstMatch } from './first-match-test-helpers.js';

export type SyntheticPassportKind = 'ADULT_SELF' | 'PERSONAL_MINOR' | 'ACADEMY_ADULT' | 'ACADEMY_MINOR';

/** All values are synthetic. Call in an isolated database or a test-owned transaction. */
export async function createSyntheticAnalyst(client: PoolClient, ownerId: string, options: { inactive?: boolean; revoked?: boolean } = {}) {
  const id = randomUUID();
  await client.query('INSERT INTO "Identity" (id, status, "updatedAt") VALUES ($1, $2, now())', [id, options.inactive ? 'INACTIVE' : 'ACTIVE']);
  await client.query(`INSERT INTO "RoleAssignment" (id, "identityId", role, status, "assignedByIdentityId")
    VALUES (gen_random_uuid(), $1, 'ANALYST', $2, $3)`, [id, options.revoked ? 'REVOKED' : 'ACTIVE', ownerId]);
  await client.query(`INSERT INTO "AnalystOperationalProfile" ("identityId", "displayLabel", "normalizedLabel", "updatedAt")
    VALUES ($1, 'Analista de prueba', 'analista de prueba', now())`, [id]);
  return id;
}

export async function createSyntheticPassport(client: PoolClient, input: {
  ownerId: string; analystId?: string; kind: SyntheticPassportKind; state?: 'ACTIVE' | 'APPROVED'; academyAdditionalAccount?: boolean;
}) {
  const passportId = randomUUID();
  const playerId = randomUUID();
  const academyId = input.kind.startsWith('ACADEMY') ? randomUUID() : null;
  const responsibleId = randomUUID();
  await client.query('INSERT INTO "Identity" (id, "updatedAt") VALUES ($1, now())', [responsibleId]);
  await client.query(`INSERT INTO "RoleAssignment" (id, "identityId", role, "assignedByIdentityId")
    VALUES (gen_random_uuid(), $1, $2, $3)`, [responsibleId, academyId ? 'ACADEMY_USER' : 'USER', input.ownerId]);
  if (academyId) {
    await client.query('INSERT INTO "Academy" (id, "displayName") VALUES ($1, $2)', [academyId, 'Academia sintetica']);
    await client.query(`INSERT INTO "AcademyMembership" (id, "identityId", "academyId", "assignedByIdentityId")
      VALUES (gen_random_uuid(), $1, $2, $3)`, [responsibleId, academyId, input.ownerId]);
    if (input.academyAdditionalAccount) {
      const extraId = randomUUID();
      await client.query('INSERT INTO "Identity" (id, "updatedAt") VALUES ($1, now())', [extraId]);
      await client.query(`INSERT INTO "AcademyMembership" (id, "identityId", "academyId", "assignedByIdentityId")
        VALUES (gen_random_uuid(), $1, $2, $3)`, [extraId, academyId, input.ownerId]);
    }
  }
  await client.query('INSERT INTO "Player" (id, "updatedAt") VALUES ($1, now())', [playerId]);
  await client.query(`INSERT INTO "PlayerPassport" (id, "playerId", state, "originKind", position, "ageCategory", city,
    country, "dominantFoot", "createdByIdentityId", "originAcademyId", "updatedAt")
    VALUES ($1, $2, $3, $4, 'Defensa', 'Sintetica', 'Bogota', 'Colombia', 'RIGHT', $5, $6, now())`,
    [passportId, playerId, input.state ?? 'ACTIVE', academyId ? 'ACADEMY' : input.kind === 'PERSONAL_MINOR' ? 'TUTOR' : 'PARTICULAR', responsibleId, academyId]);
  await client.query(`INSERT INTO "PassportResponsibility" (id, "passportId", "identityId", "academyId", kind)
    VALUES (gen_random_uuid(), $1, $2, $3, $4)`, [passportId, academyId ? null : responsibleId, academyId, academyId ? 'ACADEMY' : input.kind === 'PERSONAL_MINOR' ? 'LEGAL_REPRESENTATIVE' : 'SELF']);
  if (input.analystId) await client.query(`INSERT INTO "PassportCustody" (id, "passportId", "currentAnalystIdentityId", "assignedAt", "updatedAt")
    VALUES (gen_random_uuid(), $1, $2, now(), now())`, [passportId, input.analystId]);
  return { passportId, playerId, academyId, responsibleId };
}

export async function createAnalystWorkspaceFixture(client: PoolClient) {
  const base = await createFirstMatchFixture(client, { withCustody: true });
  const otherAnalystId = await createSyntheticAnalyst(client, base.ownerId);
  const inactiveAnalystId = await createSyntheticAnalyst(client, base.ownerId, { inactive: true });
  const revokedAnalystId = await createSyntheticAnalyst(client, base.ownerId, { revoked: true });
  const other = await createSyntheticPassport(client, { ownerId: base.ownerId, analystId: otherAnalystId, kind: 'ADULT_SELF' });
  const unassigned = await createSyntheticPassport(client, { ownerId: base.ownerId, kind: 'ADULT_SELF' });
  const nonActive = await createSyntheticPassport(client, { ownerId: base.ownerId, analystId: base.analystId, kind: 'ADULT_SELF', state: 'APPROVED' });
  const personalMinor = await createSyntheticPassport(client, { ownerId: base.ownerId, analystId: base.analystId, kind: 'PERSONAL_MINOR' });
  const academyAdult = await createSyntheticPassport(client, { ownerId: base.ownerId, analystId: base.analystId, kind: 'ACADEMY_ADULT', academyAdditionalAccount: true });
  const academyMinor = await createSyntheticPassport(client, { ownerId: base.ownerId, analystId: base.analystId, kind: 'ACADEMY_MINOR', academyAdditionalAccount: true });
  const waitingMatchId = await insertSyntheticFirstMatch(client, base, { date: '2026-11-01' });
  const loadedMatchId = await insertSyntheticFirstMatch(client, base, { date: '2026-10-01', state: 'LOADED',
    passportId: personalMinor.passportId, playerId: personalMinor.playerId });
  const canceledMatchId = await insertSyntheticFirstMatch(client, base, { date: '2026-09-01', state: 'CANCELED',
    passportId: academyAdult.passportId, playerId: academyAdult.playerId });
  return { ...base, otherAnalystId, inactiveAnalystId, revokedAnalystId, other, unassigned, nonActive,
    personalMinor, academyAdult, academyMinor, waitingMatchId, loadedMatchId, canceledMatchId };
}
