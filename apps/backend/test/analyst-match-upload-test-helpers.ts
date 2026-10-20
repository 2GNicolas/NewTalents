import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { createSyntheticAnalyst, createSyntheticPassport } from './analyst-workspace-test-helpers.js';
import { createFirstMatchFixture, insertSyntheticFirstMatch } from './first-match-test-helpers.js';

/** Synthetic values only. Use inside a test-owned transaction on the isolated Feature 011 database. */
export async function createAnalystMatchUploadFixture(client: PoolClient) {
  const base = await createFirstMatchFixture(client, { withCustody: true });
  const otherAnalystId = await createSyntheticAnalyst(client, base.ownerId);
  const revokedAnalystId = await createSyntheticAnalyst(client, base.ownerId, { revoked: true });
  const inactiveAnalystId = await createSyntheticAnalyst(client, base.ownerId, { inactive: true });
  const other = await createSyntheticPassport(client, {
    ownerId: base.ownerId, analystId: otherAnalystId, kind: 'ADULT_SELF',
  });
  const rescheduled = await createSyntheticPassport(client, {
    ownerId: base.ownerId, analystId: base.analystId, kind: 'ADULT_SELF',
  });
  const loaded = await createSyntheticPassport(client, {
    ownerId: base.ownerId, analystId: base.analystId, kind: 'ADULT_SELF',
  });
  const unassigned = await createSyntheticPassport(client, { ownerId: base.ownerId, kind: 'ADULT_SELF' });
  const nonActive = await createSyntheticPassport(client, {
    ownerId: base.ownerId, analystId: base.analystId, kind: 'ADULT_SELF', state: 'APPROVED',
  });

  const waitingMatchId = await insertSyntheticFirstMatch(client, base, { date: '2026-11-01' });
  const rescheduledMatchId = await insertSyntheticFirstMatch(client, base, {
    date: '2026-11-02', passportId: rescheduled.passportId, playerId: rescheduled.playerId,
  });
  await client.query(`UPDATE "FirstMatch" SET "matchDate" = '2026-11-03'::date, version = 2, "updatedAt" = now()
    WHERE id = $1`, [rescheduledMatchId]);
  const canceledMatchId = await insertSyntheticFirstMatch(client, base, { date: '2026-11-04', state: 'CANCELED' });
  const loadedMatchId = await insertSyntheticFirstMatch(client, base, {
    date: '2026-11-05', state: 'LOADED', passportId: loaded.passportId, playerId: loaded.playerId,
  });
  const otherMatchId = await insertSyntheticFirstMatch(client, base, {
    date: '2026-11-06', passportId: other.passportId, playerId: other.playerId,
  });
  const unassignedMatchId = await insertSyntheticFirstMatch(client, base, {
    date: '2026-11-07', passportId: unassigned.passportId, playerId: unassigned.playerId,
  });
  const nonActiveMatchId = await insertSyntheticFirstMatch(client, base, {
    date: '2026-11-08', passportId: nonActive.passportId, playerId: nonActive.playerId,
  });

  return { ...base, otherAnalystId, revokedAnalystId, inactiveAnalystId, other, rescheduled, loaded, unassigned, nonActive,
    waitingMatchId, rescheduledMatchId, canceledMatchId, loadedMatchId, otherMatchId,
    unassignedMatchId, nonActiveMatchId };
}

export const SYNTHETIC_VIDEO_URL = 'https://youtu.be/Feature011TestVideo';

/** Minimal synthetic private names for Feature 010 projections in a test-owned database. */
export async function seedSyntheticUploadPlayerNames(client: PoolClient, playerIds: readonly string[]) {
  for (const playerId of playerIds) {
    await client.query(`INSERT INTO "PlayerPrivateIdentity" (id, "playerId", "encryptedLegalName", "encryptedDateOfBirth",
      "encryptedDocumentType", "encryptedDocumentNumber", "documentFingerprint", "nameDobFingerprint", "updatedAt")
      VALUES (gen_random_uuid(), $1, 'synthetic-cipher', 'synthetic-dob', 'synthetic-type', 'synthetic-number', $2, $3, now())`,
    [playerId, randomUUID(), randomUUID()]);
  }
}

export const SYNTHETIC_PARTICIPATION_CASES = {
  addedTime: { participation: 'PARTICIPATED', totalMinutesPlayed: 97, videoMinute: '90+7' },
  lateSubstitute: { participation: 'PARTICIPATED', totalMinutesPlayed: 12, videoMinute: '88' },
  didNotParticipate: { participation: 'DID_NOT_PARTICIPATE', totalMinutesPlayed: 0, events: [] },
} as const;

export function syntheticUploadIntent() { return randomUUID(); }
