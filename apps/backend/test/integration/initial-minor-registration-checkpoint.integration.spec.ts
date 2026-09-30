import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InitialRegistrationCheckpointHarness, expectSafeProjection } from './initial-registration-checkpoint.fixture.js';

describe('T089 initial represented-minor checkpoint', () => {
  const checkpoint = new InitialRegistrationCheckpointHarness();
  beforeAll(async () => { await checkpoint.start(); }, 30_000);
  afterAll(async () => { await checkpoint.stop(); }, 30_000);

  it('submits required representation evidence while creating no minor account, contact or session', async () => {
    const applicant = await checkpoint.createAndAuthenticate('REPRESENTED_MINOR');
    await checkpoint.uploadAll(applicant.requestId, applicant.accessToken, 'REPRESENTED_MINOR');
    const submitted = await checkpoint.submit(applicant.requestId, applicant.accessToken);
    expect(submitted.data.status).toBe('SUBMITTED');

    const request = await checkpoint.prisma.registrationRequest.findUniqueOrThrow({
      where: { id: applicant.requestId },
      include: { representedMinorDetail: true, applicants: true, players: true, consents: true, evidenceItems: true },
    });
    expect(request.representedMinorDetail).toMatchObject({ relationship: 'MOTHER', authorityDeclared: true });
    expect(request.applicants).toHaveLength(1);
    expect(request.players).toHaveLength(1);
    expect(request.players[0]).not.toHaveProperty('identityId');
    expect(request.players[0]).not.toHaveProperty('encryptedEmail');
    expect(request.players[0]).not.toHaveProperty('encryptedPhone');
    expect(await checkpoint.prisma.authenticationCredential.count({ where: { identityId: applicant.identityId } })).toBe(1);
    expect(await checkpoint.prisma.authenticationSession.count({ where: { identityId: applicant.identityId } })).toBe(1);
    expect(new Set(request.consents.map(({ type }) => type))).toEqual(new Set(['PRIVACY', 'TRUTHFULNESS', 'REPRESENTATION', 'MINOR_TREATMENT']));
    expect(request.consents.every(({ textVersion, requestVersion, actorIdentityId }) => textVersion === 'checkpoint-v1' && requestVersion === 0 && actorIdentityId === applicant.identityId)).toBe(true);
    expect(new Set(request.evidenceItems.map(({ category }) => category))).toEqual(new Set(['IDENTITY_FRONT', 'IDENTITY_BACK', 'MINOR_CIVIL_IDENTITY', 'REPRESENTATION_AUTHORITY']));
    expect(request.evidenceItems.every(({ status }) => status === 'CLEAN')).toBe(true);

    const safe = await checkpoint.detail(applicant.requestId, applicant.accessToken);
    expectSafeProjection(safe.body);
    expect(JSON.stringify(safe.body)).not.toMatch(/minor.*(email|phone|session)|documentNumber/i);
  }, 30_000);
});
