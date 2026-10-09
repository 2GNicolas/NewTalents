import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RegistrationRequestLifecycleService } from '../../src/registration-requests/lifecycle/registration-request-lifecycle.service.js';
import { InitialRegistrationCheckpointHarness, expectSafeProjection } from './initial-registration-checkpoint.fixture.js';

describe('T091 initial natural-person academy checkpoint', () => {
  const checkpoint = new InitialRegistrationCheckpointHarness();
  beforeAll(async () => { await checkpoint.start(); }, 30_000);
  afterAll(async () => { await checkpoint.stop(); }, 30_000);

  it('submits operational evidence and supports a safe shared-lifecycle correction without a certification claim', async () => {
    const applicant = await checkpoint.createAndAuthenticate('NATURAL_PERSON_ACADEMY');
    await checkpoint.uploadAll(applicant.requestId, applicant.accessToken, 'NATURAL_PERSON_ACADEMY');
    const submitted = await checkpoint.submit(applicant.requestId, applicant.accessToken);
    expect(submitted.data.status).toBe('SUBMITTED');

    const lifecycle = (checkpoint as unknown as { app: { get<T>(token: unknown): T } }).app.get<RegistrationRequestLifecycleService>(RegistrationRequestLifecycleService);
    await expect(lifecycle.requestCorrection({ requestId: applicant.requestId, expectedVersion: 1, actorId: (await checkpoint.createAdministrator()).identityId, idempotencyKey: randomUUID(), safeCategory: 'EVIDENCE' }))
      .resolves.toMatchObject({ outcome: 'applied', snapshot: { status: 'REQUIRES_CORRECTION', version: 2 } });

    const request = await checkpoint.prisma.registrationRequest.findUniqueOrThrow({ where: { id: applicant.requestId }, include: { naturalPersonAcademyDetail: true, events: true } });
    expect(request.naturalPersonAcademyDetail).toMatchObject({ operationDeclared: true, proofCategories: ['PLACE_USE_AUTHORIZATION'] });
    expect(request.events.at(-1)).toMatchObject({ action: 'CORRECTION_REQUESTED', safeCategory: 'EVIDENCE' });
    expect(JSON.stringify(request.naturalPersonAcademyDetail)).not.toMatch(/certif(ied|ication|icada|icacion)/i);
    expectSafeProjection((await checkpoint.detail(applicant.requestId, applicant.accessToken)).body);
  }, 30_000);
});
