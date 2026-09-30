import type { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/database/prisma.service.js';
import { createApplication } from '../../src/main.js';
import { PassportAuthorizationAdapter } from '../../src/player-passport/passport-authorization/passport-authorization.adapter.js';
import {
  cleanupPassportTestData,
  createCorrectivePassportFixtureSet,
  type CorrectivePassportFixtureSet,
} from '../passport-test-helpers.js';

describe('Feature 005 passport and TUTOR compatibility regression', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let app: INestApplication;
  let prisma: PrismaService;
  let authorization: PassportAuthorizationAdapter;
  let fixture: CorrectivePassportFixtureSet;

  beforeAll(async () => {
    app = await createApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);
    authorization = app.get(PassportAuthorizationAdapter);
    fixture = await createCorrectivePassportFixtureSet(prisma, pool);
  });

  afterAll(async () => {
    if (fixture) await cleanupPassportTestData(pool, fixture.ids);
    await app?.close();
    await pool.end();
  });

  it('preserves existing passports and explicit SELF, legal, and academy responsibilities', async () => {
    const before = await prisma.playerPassport.findMany({
      where: { id: { in: fixture.ids.passportIds } },
      orderBy: { id: 'asc' },
      select: { id: true, playerId: true, originKind: true, originAcademyId: true, createdByIdentityId: true },
    });
    expect(before).toHaveLength(6);

    await expect(authorization.authorize({ identityId: fixture.identities.mixedUser, permission: 'passport.particular.manage', passportId: fixture.passports.adultSelf })).resolves.toMatchObject({ allowed: true });
    await expect(authorization.authorize({ identityId: fixture.identities.representativeUser, permission: 'passport.particular.manage', passportId: fixture.passports.representedMinors[0] })).resolves.toMatchObject({ allowed: true });
    await expect(authorization.authorize({ identityId: fixture.identities.mixedUser, permission: 'passport.academy.manage', passportId: fixture.passports.academyMinor })).resolves.toMatchObject({ allowed: true });

    const after = await prisma.playerPassport.findMany({
      where: { id: { in: fixture.ids.passportIds } },
      orderBy: { id: 'asc' },
      select: { id: true, playerId: true, originKind: true, originAcademyId: true, createdByIdentityId: true },
    });
    expect(after).toEqual(before);
  });

  it('keeps reconciled TUTOR authority explicit and grants nothing from incomplete historical facts', async () => {
    await expect(authorization.authorize({ identityId: fixture.identities.historicalCompleteTutor, permission: 'passport.tutor.manage', passportId: fixture.passports.historicalComplete })).resolves.toMatchObject({ allowed: true });
    await expect(authorization.authorize({ identityId: fixture.identities.historicalIncompleteTutor, permission: 'passport.tutor.manage', passportId: fixture.passports.historicalIncomplete })).resolves.toMatchObject({ allowed: true });

    const tutorRoles = await prisma.roleAssignment.findMany({
      where: { identityId: { in: [fixture.identities.historicalCompleteTutor, fixture.identities.historicalIncompleteTutor] }, status: 'ACTIVE' },
      orderBy: { identityId: 'asc' },
      select: { identityId: true, role: true },
    });
    expect(tutorRoles).toEqual([
      { identityId: fixture.identities.historicalCompleteTutor, role: 'TUTOR' },
      { identityId: fixture.identities.historicalIncompleteTutor, role: 'TUTOR' },
    ]);
    expect(await prisma.passportResponsibility.count({ where: { passportId: fixture.passports.historicalComplete, identityId: fixture.identities.historicalCompleteTutor, kind: 'LEGAL_REPRESENTATIVE' } })).toBe(1);
    expect(await prisma.passportResponsibility.count({ where: { passportId: fixture.passports.historicalIncomplete } })).toBe(0);
    expect(await prisma.passportResponsibility.count({ where: { identityId: { in: [fixture.identities.historicalCompleteTutor, fixture.identities.historicalIncompleteTutor] }, kind: 'SELF' } })).toBe(0);
  });
});
