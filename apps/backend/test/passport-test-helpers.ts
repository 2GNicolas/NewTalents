import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { Pool } from 'pg';

import type { PrismaService } from '../src/database/prisma.service.js';
import { TokenService } from '../src/authentication/token.service.js';
import type { FunctionalRole } from '../src/identity/role-assignment.service.js';

const FIXTURE_UUIDS = {
  mixedUser: '71000000-0000-4000-8000-000000000001',
  representativeUser: '71000000-0000-4000-8000-000000000002',
  historicalCompleteTutor: '71000000-0000-4000-8000-000000000003',
  historicalIncompleteTutor: '71000000-0000-4000-8000-000000000004',
  academy: '72000000-0000-4000-8000-000000000001',
  adultPlayer: '73000000-0000-4000-8000-000000000001',
  firstMinorPlayer: '73000000-0000-4000-8000-000000000002',
  secondMinorPlayer: '73000000-0000-4000-8000-000000000003',
  academyMinorPlayer: '73000000-0000-4000-8000-000000000004',
  historicalCompletePlayer: '73000000-0000-4000-8000-000000000005',
  historicalIncompletePlayer: '73000000-0000-4000-8000-000000000006',
  adultPassport: '74000000-0000-4000-8000-000000000001',
  firstMinorPassport: '74000000-0000-4000-8000-000000000002',
  secondMinorPassport: '74000000-0000-4000-8000-000000000003',
  academyMinorPassport: '74000000-0000-4000-8000-000000000004',
  historicalCompletePassport: '74000000-0000-4000-8000-000000000005',
  historicalIncompletePassport: '74000000-0000-4000-8000-000000000006',
} as const;

export type CorrectivePassportFixtureSet = Readonly<{
  ids: PassportTestIds;
  identities: Readonly<{
    mixedUser: string;
    representativeUser: string;
    historicalCompleteTutor: string;
    historicalIncompleteTutor: string;
  }>;
  academyId: string;
  passports: Readonly<{
    adultSelf: string;
    representedMinors: readonly [string, string];
    academyMinor: string;
    historicalComplete: string;
    historicalIncomplete: string;
  }>;
  birthdayBoundary: Readonly<{
    evaluationDate: Date;
    beforeMajority: string;
    onMajority: string;
    afterMajority: string;
  }>;
}>;

export type PassportTestIds = {
  identities: string[];
  academyIds: string[];
  playerIds: string[];
  passportIds: string[];
  sessions: string[];
};

export async function createPassportIdentity(prisma: PrismaService, role: FunctionalRole): Promise<string> {
  const identity = await prisma.identity.create({ data: { status: 'ACTIVE' } });
  await prisma.roleAssignment.create({
    data: { identityId: identity.id, role, status: 'ACTIVE', assignedByIdentityId: identity.id },
  });
  return identity.id;
}

export async function createPassportSession(prisma: PrismaService, identityId: string): Promise<string> {
  const session = await prisma.authenticationSession.create({
    data: {
      identityId,
      familyId: randomUUID(),
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return session.id;
}

export async function createPassportAcademy(prisma: PrismaService): Promise<string> {
  const academy = await prisma.academy.create({ data: {} });
  return academy.id;
}

export async function createPassportMembership(prisma: PrismaService, identityId: string, academyId: string): Promise<void> {
  await prisma.academyMembership.create({
    data: { identityId, academyId, status: 'ACTIVE', assignedByIdentityId: identityId },
  });
}

export async function createCorrectivePassportFixtureSet(prisma: PrismaService, pool: Pool): Promise<CorrectivePassportFixtureSet> {
  const identityIds = [FIXTURE_UUIDS.mixedUser, FIXTURE_UUIDS.representativeUser, FIXTURE_UUIDS.historicalCompleteTutor, FIXTURE_UUIDS.historicalIncompleteTutor];
  const playerIds = [FIXTURE_UUIDS.adultPlayer, FIXTURE_UUIDS.firstMinorPlayer, FIXTURE_UUIDS.secondMinorPlayer, FIXTURE_UUIDS.academyMinorPlayer, FIXTURE_UUIDS.historicalCompletePlayer, FIXTURE_UUIDS.historicalIncompletePlayer];
  const passportIds = [FIXTURE_UUIDS.adultPassport, FIXTURE_UUIDS.firstMinorPassport, FIXTURE_UUIDS.secondMinorPassport, FIXTURE_UUIDS.academyMinorPassport, FIXTURE_UUIDS.historicalCompletePassport, FIXTURE_UUIDS.historicalIncompletePassport];
  const ids: PassportTestIds = { identities: [...identityIds], academyIds: [FIXTURE_UUIDS.academy], playerIds: [...playerIds], passportIds: [...passportIds], sessions: [] };

  // A prior interrupted focused run is harmless: remove only this fixture's fixed identifiers.
  await cleanupPassportTestData(pool, ids);

  await prisma.identity.createMany({ data: identityIds.map((id) => ({ id, status: 'ACTIVE' })) });
  await prisma.roleAssignment.createMany({ data: [
    { identityId: FIXTURE_UUIDS.mixedUser, role: 'USER', status: 'ACTIVE', assignedByIdentityId: FIXTURE_UUIDS.mixedUser },
    { identityId: FIXTURE_UUIDS.mixedUser, role: 'ACADEMY_USER', status: 'ACTIVE', assignedByIdentityId: FIXTURE_UUIDS.mixedUser },
    { identityId: FIXTURE_UUIDS.representativeUser, role: 'USER', status: 'ACTIVE', assignedByIdentityId: FIXTURE_UUIDS.representativeUser },
    { identityId: FIXTURE_UUIDS.historicalCompleteTutor, role: 'TUTOR', status: 'ACTIVE', assignedByIdentityId: FIXTURE_UUIDS.historicalCompleteTutor },
    { identityId: FIXTURE_UUIDS.historicalIncompleteTutor, role: 'TUTOR', status: 'ACTIVE', assignedByIdentityId: FIXTURE_UUIDS.historicalIncompleteTutor },
  ] });
  await prisma.academy.create({ data: { id: FIXTURE_UUIDS.academy, displayName: 'Academia Sintetica T103' } });
  await prisma.academyMembership.create({ data: { identityId: FIXTURE_UUIDS.mixedUser, academyId: FIXTURE_UUIDS.academy, status: 'ACTIVE', assignedByIdentityId: FIXTURE_UUIDS.mixedUser } });
  await prisma.player.createMany({ data: playerIds.map((id) => ({ id })) });
  await prisma.playerPassport.createMany({ data: [
    { id: FIXTURE_UUIDS.adultPassport, playerId: FIXTURE_UUIDS.adultPlayer, originKind: 'PARTICULAR', position: 'Defensa', ageCategory: 'Mayores', city: 'Bogota', country: 'Colombia', dominantFoot: 'RIGHT', createdByIdentityId: FIXTURE_UUIDS.mixedUser },
    { id: FIXTURE_UUIDS.firstMinorPassport, playerId: FIXTURE_UUIDS.firstMinorPlayer, originKind: 'PARTICULAR', position: 'Volante', ageCategory: 'Sub-15', city: 'Bogota', country: 'Colombia', dominantFoot: 'LEFT', createdByIdentityId: FIXTURE_UUIDS.representativeUser },
    { id: FIXTURE_UUIDS.secondMinorPassport, playerId: FIXTURE_UUIDS.secondMinorPlayer, originKind: 'PARTICULAR', position: 'Portero', ageCategory: 'Sub-13', city: 'Cali', country: 'Colombia', dominantFoot: 'BOTH', createdByIdentityId: FIXTURE_UUIDS.representativeUser },
    { id: FIXTURE_UUIDS.academyMinorPassport, playerId: FIXTURE_UUIDS.academyMinorPlayer, originKind: 'ACADEMY', position: 'Delantero', ageCategory: 'Sub-17', city: 'Medellin', country: 'Colombia', dominantFoot: 'UNDECLARED', createdByIdentityId: FIXTURE_UUIDS.mixedUser, originAcademyId: FIXTURE_UUIDS.academy },
    { id: FIXTURE_UUIDS.historicalCompletePassport, playerId: FIXTURE_UUIDS.historicalCompletePlayer, originKind: 'TUTOR', position: 'Defensa', ageCategory: 'Sub-17', city: 'Tunja', country: 'Colombia', dominantFoot: 'RIGHT', createdByIdentityId: FIXTURE_UUIDS.historicalCompleteTutor },
    { id: FIXTURE_UUIDS.historicalIncompletePassport, playerId: FIXTURE_UUIDS.historicalIncompletePlayer, originKind: 'TUTOR', position: 'Volante', ageCategory: 'Sub-15', city: 'Pasto', country: 'Colombia', dominantFoot: 'LEFT', createdByIdentityId: FIXTURE_UUIDS.historicalIncompleteTutor },
  ] });
  await prisma.passportResponsibility.createMany({ data: [
    { passportId: FIXTURE_UUIDS.adultPassport, identityId: FIXTURE_UUIDS.mixedUser, kind: 'SELF' },
    { passportId: FIXTURE_UUIDS.firstMinorPassport, identityId: FIXTURE_UUIDS.representativeUser, kind: 'LEGAL_REPRESENTATIVE' },
    { passportId: FIXTURE_UUIDS.secondMinorPassport, identityId: FIXTURE_UUIDS.representativeUser, kind: 'LEGAL_REPRESENTATIVE' },
    { passportId: FIXTURE_UUIDS.academyMinorPassport, academyId: FIXTURE_UUIDS.academy, kind: 'ACADEMY' },
    { passportId: FIXTURE_UUIDS.academyMinorPassport, identityId: FIXTURE_UUIDS.representativeUser, kind: 'LEGAL_REPRESENTATIVE' },
    { passportId: FIXTURE_UUIDS.historicalCompletePassport, identityId: FIXTURE_UUIDS.historicalCompleteTutor, kind: 'LEGAL_REPRESENTATIVE' },
  ] });
  await prisma.initialTutorResponsibility.createMany({ data: [
    { playerId: FIXTURE_UUIDS.historicalCompletePlayer, tutorIdentityId: FIXTURE_UUIDS.historicalCompleteTutor },
    { playerId: FIXTURE_UUIDS.historicalIncompletePlayer, tutorIdentityId: FIXTURE_UUIDS.historicalIncompleteTutor },
  ] });
  await prisma.historicalTutorReconciliationAudit.createMany({ data: [
    { actorIdentityId: FIXTURE_UUIDS.historicalCompleteTutor, legacyResponsibilityId: 'synthetic-complete-tutor-fact', outcome: 'LEGAL_REPRESENTATIVE_RECONCILED', reasonCategory: 'COMPLETE_VERIFIED_FACTS' },
    { actorIdentityId: FIXTURE_UUIDS.historicalIncompleteTutor, legacyResponsibilityId: 'synthetic-incomplete-tutor-fact', outcome: 'NO_AUTHORITY_GRANTED', reasonCategory: 'INCOMPLETE_HISTORICAL_FACTS' },
  ] });

  return {
    ids,
    identities: {
      mixedUser: FIXTURE_UUIDS.mixedUser,
      representativeUser: FIXTURE_UUIDS.representativeUser,
      historicalCompleteTutor: FIXTURE_UUIDS.historicalCompleteTutor,
      historicalIncompleteTutor: FIXTURE_UUIDS.historicalIncompleteTutor,
    },
    academyId: FIXTURE_UUIDS.academy,
    passports: {
      adultSelf: FIXTURE_UUIDS.adultPassport,
      representedMinors: [FIXTURE_UUIDS.firstMinorPassport, FIXTURE_UUIDS.secondMinorPassport],
      academyMinor: FIXTURE_UUIDS.academyMinorPassport,
      historicalComplete: FIXTURE_UUIDS.historicalCompletePassport,
      historicalIncomplete: FIXTURE_UUIDS.historicalIncompletePassport,
    },
    birthdayBoundary: {
      evaluationDate: new Date('2026-09-21T17:00:00.000Z'),
      beforeMajority: '2008-09-22',
      onMajority: '2008-09-21',
      afterMajority: '2008-09-20',
    },
  };
}

export async function issuePassportBearer(app: INestApplication, identityId: string, sessionId: string): Promise<string> {
  const tokenService = app.get<TokenService>(TokenService);
  return tokenService.issueAccessToken({ identityId, sessionId });
}

export async function cleanupPassportTestData(pool: Pool, ids: PassportTestIds): Promise<void> {
  await pool.query('ALTER TABLE "PassportLifecycleEvent" DISABLE TRIGGER "passport_lifecycle_events_immutable"');
  try {
    const passportIds = [...new Set(ids.passportIds.filter((id) => id.length > 0))];
    const playerIds = new Set(ids.playerIds.filter((id) => id.length > 0));

    if (passportIds.length) {
      const linkedPlayers = await pool.query<{ playerId: string }>(
        'SELECT "playerId" FROM "PlayerPassport" WHERE id = ANY($1::uuid[])',
        [passportIds],
      );
      for (const row of linkedPlayers.rows) playerIds.add(row.playerId);

      await pool.query('DELETE FROM "PassportLifecycleEvent" WHERE "passportId" = ANY($1::uuid[])', [passportIds]);
      await pool.query('DELETE FROM "PassportPossibleDuplicateSignal" WHERE "passportId" = ANY($1::uuid[])', [passportIds]);
      await pool.query('DELETE FROM "PassportReviewReturn" WHERE "passportId" = ANY($1::uuid[])', [passportIds]);
      await pool.query('DELETE FROM "RepresentativeConfirmation" WHERE "passportId" = ANY($1::uuid[])', [passportIds]);
      await pool.query('DELETE FROM "PassportResponsibility" WHERE "passportId" = ANY($1::uuid[])', [passportIds]);
      await pool.query('DELETE FROM "PlayerPassport" WHERE id = ANY($1::uuid[])', [passportIds]);
    }

    const orderedPlayerIds = [...playerIds];
    if (orderedPlayerIds.length) {
      await pool.query('DELETE FROM "InitialTutorResponsibility" WHERE "playerId" = ANY($1::uuid[])', [orderedPlayerIds]);
      await pool.query('DELETE FROM "PlayerPrivateIdentity" WHERE "playerId" = ANY($1::uuid[])', [orderedPlayerIds]);
      await pool.query('DELETE FROM "Player" WHERE id = ANY($1::uuid[])', [orderedPlayerIds]);
    }

    const identityIds = [...new Set(ids.identities.filter((id) => id.length > 0))];
    if (identityIds.length) {
      await pool.query('DELETE FROM "RepresentativeConfirmation" WHERE "representativeIdentityId" = ANY($1::uuid[])', [identityIds]);
      await pool.query('DELETE FROM "HistoricalTutorReconciliationAudit" WHERE "actorIdentityId" = ANY($1::uuid[])', [identityIds]);
      await pool.query('DELETE FROM "AuthenticationSession" WHERE "identityId" = ANY($1::uuid[])', [identityIds]);
      await pool.query('DELETE FROM "RoleAssignment" WHERE "identityId" = ANY($1::uuid[])', [identityIds]);
      await pool.query('DELETE FROM "AcademyMembership" WHERE "identityId" = ANY($1::uuid[])', [identityIds]);
      await pool.query('DELETE FROM "PassportLifecycleEvent" WHERE "actorIdentityId" = ANY($1::uuid[])', [identityIds]);
      await pool.query('DELETE FROM "Identity" WHERE id = ANY($1::uuid[])', [identityIds]);
    }
    const academyIds = ids.academyIds;
    if (academyIds.length) {
      await pool.query('DELETE FROM "Academy" WHERE id = ANY($1::uuid[])', [academyIds]);
    }
  } finally {
    await pool.query('ALTER TABLE "PassportLifecycleEvent" ENABLE TRIGGER "passport_lifecycle_events_immutable"');
  }
}
