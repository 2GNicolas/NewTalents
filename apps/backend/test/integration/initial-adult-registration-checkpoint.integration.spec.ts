import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InitialRegistrationCheckpointHarness, expectSafeProjection } from './initial-registration-checkpoint.fixture.js';

describe('T088 initial adult registration checkpoint', () => {
  const checkpoint = new InitialRegistrationCheckpointHarness();
  beforeAll(async () => { await checkpoint.start(); }, 30_000);
  afterAll(async () => { await checkpoint.stop(); }, 30_000);

  it('persists one complete adult request through CLEAN evidence, idempotent submit, pending status and Admin visibility', async () => {
    const applicant = await checkpoint.createAndAuthenticate('PERSONAL_ADULT');
    expect(applicant.created).toMatchObject({ type: 'PERSONAL_ADULT', status: 'DRAFT', version: 0, capabilities: [] });
    expect(applicant.access).toMatchObject({ classification: 'pending-onboarding', requestId: applicant.requestId });

    const evidenceKey = randomUUID();
    const front = await checkpoint.upload(applicant.requestId, applicant.accessToken, 'IDENTITY_FRONT', 0, evidenceKey);
    const frontRetry = await checkpoint.upload(applicant.requestId, applicant.accessToken, 'IDENTITY_FRONT', 0, evidenceKey);
    const back = await checkpoint.upload(applicant.requestId, applicant.accessToken, 'IDENTITY_BACK');
    const evidence = [front, frontRetry, back];
    expect(frontRetry).toEqual(front);
    expect(evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'IDENTITY_FRONT', status: 'CLEAN' }),
      expect.objectContaining({ category: 'IDENTITY_BACK', status: 'CLEAN' }),
    ]));

    const first = await checkpoint.submit(applicant.requestId, applicant.accessToken);
    const retry = await checkpoint.submit(applicant.requestId, applicant.accessToken, 0, first.idempotencyKey);
    expect(first.data).toMatchObject({ status: 'SUBMITTED', version: 1 });
    expect(retry.data).toMatchObject({ status: 'SUBMITTED', version: 1 });

    const persisted = await checkpoint.prisma.registrationRequest.findUniqueOrThrow({
      where: { id: applicant.requestId },
      include: { personalAdultDetail: true, consents: true, evidenceItems: true, events: true, idempotencyRecords: true },
    });
    expect(persisted.status).toBe('SUBMITTED');
    expect(persisted.personalAdultDetail?.actingForSelf).toBe(true);
    expect(new Set(persisted.consents.map(({ type }) => type))).toEqual(new Set(['PRIVACY', 'TRUTHFULNESS', 'SELF_ACTION']));
    expect(persisted.evidenceItems).toHaveLength(2);
    expect(persisted.evidenceItems.every(({ status }) => status === 'CLEAN')).toBe(true);
    expect(persisted.events.filter(({ action }) => action === 'SUBMITTED')).toHaveLength(1);
    expect(persisted.idempotencyRecords.filter(({ action }) => action === 'SUBMIT')).toHaveLength(1);

    const own = await checkpoint.detail(applicant.requestId, applicant.accessToken);
    expect(own.body.data).toMatchObject({ status: 'SUBMITTED', evidenceComplete: true });
    expectSafeProjection(own.body);

    const admin = await checkpoint.createAdministrator();
    const list = await checkpoint.adminList(admin.accessToken, 'PERSONAL_ADULT').expect(200);
    expect(list.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: applicant.requestId, status: 'SUBMITTED' })]));
    const detail = await checkpoint.adminDetail(admin.accessToken, applicant.requestId).expect(200);
    expect(detail.body.data).toMatchObject({ id: applicant.requestId, status: 'SUBMITTED' });
    expectSafeProjection(detail.body);

    const unrelated = await checkpoint.createAndAuthenticate('PERSONAL_ADULT');
    await checkpoint.detail(applicant.requestId, unrelated.accessToken, 404);
    expect(await checkpoint.prisma.roleAssignment.count({ where: { identityId: applicant.identityId } })).toBe(0);
    expect(await checkpoint.prisma.academyMembership.count({ where: { identityId: applicant.identityId } })).toBe(0);
  }, 30_000);
});
