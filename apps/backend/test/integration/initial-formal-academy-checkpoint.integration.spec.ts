import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InitialRegistrationCheckpointHarness, expectSafeProjection } from './initial-registration-checkpoint.fixture.js';

describe('T090 initial formal-academy checkpoint', () => {
  const checkpoint = new InitialRegistrationCheckpointHarness();
  beforeAll(async () => { await checkpoint.start(); }, 30_000);
  afterAll(async () => { await checkpoint.stop(); }, 30_000);

  it('submits the formal request without materializing Academy, ACADEMY_USER or membership while pending', async () => {
    const beforeAcademies = await checkpoint.prisma.academy.count();
    const applicant = await checkpoint.createAndAuthenticate('FORMAL_ACADEMY');
    await checkpoint.uploadAll(applicant.requestId, applicant.accessToken, 'FORMAL_ACADEMY');
    const submitted = await checkpoint.submit(applicant.requestId, applicant.accessToken);
    expect(submitted.data.status).toBe('SUBMITTED');

    const request = await checkpoint.prisma.registrationRequest.findUniqueOrThrow({ where: { id: applicant.requestId }, include: { formalAcademyDetail: true, consents: true, evidenceItems: true } });
    expect(request.formalAcademyDetail).toMatchObject({ authorityDeclared: true });
    expect(request.evidenceItems).toHaveLength(3);
    expect(request.evidenceItems.every(({ status }) => status === 'CLEAN')).toBe(true);
    expect(await checkpoint.prisma.academy.count()).toBe(beforeAcademies);
    expect(await checkpoint.prisma.roleAssignment.count({ where: { identityId: applicant.identityId } })).toBe(0);
    expect(await checkpoint.prisma.academyMembership.count({ where: { identityId: applicant.identityId } })).toBe(0);
    expectSafeProjection((await checkpoint.detail(applicant.requestId, applicant.accessToken)).body);
  }, 30_000);
});
