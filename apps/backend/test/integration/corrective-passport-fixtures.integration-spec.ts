import type { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/database/prisma.service.js';
import { createApplication } from '../../src/main.js';
import { PassportAgePolicyService } from '../../src/player-passport/age-policy/passport-age-policy.service.js';
import { cleanupPassportTestData, createCorrectivePassportFixtureSet, type CorrectivePassportFixtureSet } from '../passport-test-helpers.js';

describe('T103 isolated corrective passport fixtures', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let app: INestApplication;
  let prisma: PrismaService;
  let fixture: CorrectivePassportFixtureSet;

  beforeAll(async () => {
    app = await createApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);
    fixture = await createCorrectivePassportFixtureSet(prisma, pool);
  });

  afterAll(async () => {
    if (fixture) await cleanupPassportTestData(pool, fixture.ids);
    await app?.close();
    await pool.end();
  });

  it('provides an adult SELF who is also an active ACADEMY_USER without mixing responsibilities', async () => {
    const roles = await prisma.roleAssignment.findMany({ where: { identityId: fixture.identities.mixedUser }, select: { role: true }, orderBy: { role: 'asc' } });
    const self = await prisma.passportResponsibility.findMany({ where: { passportId: fixture.passports.adultSelf }, select: { kind: true, identityId: true, academyId: true } });
    expect(roles.map(({ role }) => role)).toEqual(['ACADEMY_USER', 'USER']);
    expect(await prisma.academyMembership.count({ where: { identityId: fixture.identities.mixedUser, academyId: fixture.academyId, status: 'ACTIVE' } })).toBe(1);
    expect(self).toEqual([{ kind: 'SELF', identityId: fixture.identities.mixedUser, academyId: null }]);
  });

  it('provides one USER representing multiple minors and an academy minor with separate relationships', async () => {
    const represented = await prisma.passportResponsibility.findMany({ where: { passportId: { in: [...fixture.passports.representedMinors] } }, select: { passportId: true, kind: true, identityId: true } });
    expect(represented).toHaveLength(2);
    expect(represented.every((item) => item.kind === 'LEGAL_REPRESENTATIVE' && item.identityId === fixture.identities.representativeUser)).toBe(true);
    const academy = await prisma.passportResponsibility.findMany({ where: { passportId: fixture.passports.academyMinor }, select: { kind: true, identityId: true, academyId: true } });
    expect(academy).toEqual(expect.arrayContaining([
      { kind: 'ACADEMY', identityId: null, academyId: fixture.academyId },
      { kind: 'LEGAL_REPRESENTATIVE', identityId: fixture.identities.representativeUser, academyId: null },
    ]));
  });

  it('classifies dates immediately before, on and after the Colombia/18 boundary deterministically', () => {
    const policy = new PassportAgePolicyService();
    expect(policy.classify(fixture.birthdayBoundary.beforeMajority, fixture.birthdayBoundary.evaluationDate)).toBe('MINOR');
    expect(policy.classify(fixture.birthdayBoundary.onMajority, fixture.birthdayBoundary.evaluationDate)).toBe('ADULT');
    expect(policy.classify(fixture.birthdayBoundary.afterMajority, fixture.birthdayBoundary.evaluationDate)).toBe('ADULT');
  });

  it('keeps complete historical TUTOR reconciliation explicit and incomplete history authority-free', async () => {
    const complete = await prisma.passportResponsibility.findMany({ where: { passportId: fixture.passports.historicalComplete }, select: { kind: true, identityId: true } });
    const incomplete = await prisma.passportResponsibility.findMany({ where: { passportId: fixture.passports.historicalIncomplete }, select: { kind: true, identityId: true } });
    const audits = await prisma.historicalTutorReconciliationAudit.findMany({ where: { actorIdentityId: { in: [fixture.identities.historicalCompleteTutor, fixture.identities.historicalIncompleteTutor] } }, select: { actorIdentityId: true, outcome: true, reasonCategory: true } });
    expect(complete).toEqual([{ kind: 'LEGAL_REPRESENTATIVE', identityId: fixture.identities.historicalCompleteTutor }]);
    expect(incomplete).toEqual([]);
    expect(audits).toEqual(expect.arrayContaining([
      { actorIdentityId: fixture.identities.historicalCompleteTutor, outcome: 'LEGAL_REPRESENTATIVE_RECONCILED', reasonCategory: 'COMPLETE_VERIFIED_FACTS' },
      { actorIdentityId: fixture.identities.historicalIncompleteTutor, outcome: 'NO_AUTHORITY_GRANTED', reasonCategory: 'INCOMPLETE_HISTORICAL_FACTS' },
    ]));
  });
});
