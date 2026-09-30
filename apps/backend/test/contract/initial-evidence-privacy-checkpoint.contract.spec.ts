import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InitialRegistrationCheckpointHarness, expectSafeProjection } from '../integration/initial-registration-checkpoint.fixture.js';

describe('T093 submitted evidence privacy checkpoint', () => {
  const checkpoint = new InitialRegistrationCheckpointHarness();
  beforeAll(async () => { await checkpoint.start(); }, 30_000);
  afterAll(async () => { await checkpoint.stop(); }, 30_000);

  it('exposes metadata to the applicant and streams bytes only to an authorized Administrator with separate audit', async () => {
    const applicant = await checkpoint.createAndAuthenticate('PERSONAL_ADULT');
    await checkpoint.uploadAll(applicant.requestId, applicant.accessToken, 'PERSONAL_ADULT');
    await checkpoint.submit(applicant.requestId, applicant.accessToken);
    const admin = await checkpoint.createAdministrator();

    const own = await checkpoint.detail(applicant.requestId, applicant.accessToken);
    expect(own.body.data.evidence).toEqual(expect.arrayContaining([expect.objectContaining({ category: 'IDENTITY_FRONT', status: 'CLEAN', sizeBytes: 44 })]));
    expectSafeProjection(own.body);
    const evidenceId = String(own.body.data.evidence[0].id);
    const lifecycleEventsBefore = await checkpoint.prisma.registrationRequestEvent.count({ where: { requestId: applicant.requestId } });

    const streamed = await checkpoint.adminEvidence(admin.accessToken, applicant.requestId, evidenceId).expect(200);
    expect(streamed.headers['cache-control']).toBe('no-store');
    expect(streamed.headers['x-content-type-options']).toBe('nosniff');
    expect(streamed.headers['content-type']).toMatch(/^application\/pdf/);
    expect(streamed.headers['content-disposition']).toMatch(/^inline; filename="[a-z-]+\.pdf"$/);
    expect(Buffer.from(streamed.body).subarray(0, 5).toString()).toBe('%PDF-');

    const denied = await checkpoint.adminEvidence(applicant.accessToken, applicant.requestId, evidenceId).expect(404);
    expect(denied.headers['cache-control']).toBe('no-store');
    expect(denied.headers['x-content-type-options']).toBe('nosniff');
    expectSafeProjection(denied.body);
    expect(await checkpoint.prisma.registrationEvidenceAccessAudit.count({ where: { requestId: applicant.requestId } })).toBe(2);
    expect(await checkpoint.prisma.registrationRequestEvent.count({ where: { requestId: applicant.requestId } })).toBe(lifecycleEventsBefore);
  }, 30_000);
});
