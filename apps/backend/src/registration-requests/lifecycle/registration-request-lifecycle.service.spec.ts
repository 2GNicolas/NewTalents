import { describe, expect, it, vi } from 'vitest';

import type { RegistrationRequestSnapshot } from '../domain/registration-request.types.js';
import { RegistrationRequestLifecycleService, type RegistrationLifecycleRepository } from './registration-request-lifecycle.service.js';

const requestId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const key = '33333333-3333-4333-8333-333333333333';
const applicant = { encryptedLegalName: 'enc-name', encryptedDateOfBirth: 'enc-dob', encryptedDocumentType: 'enc-type', encryptedDocumentNumber: 'enc-number', documentFingerprint: 'doc-fp', nameDobFingerprint: 'name-dob-fp', derivedAdult: true } as const;
const player = { encryptedLegalName: 'enc-name', encryptedDateOfBirth: 'enc-dob', encryptedDocumentType: 'enc-type', encryptedDocumentNumber: 'enc-number', documentFingerprint: 'player-doc-fp', nameDobFingerprint: 'player-name-dob-fp', encryptedCountry: 'enc-country', encryptedCity: 'enc-city', derivedAdult: true } as const;
const draft = (overrides: Partial<RegistrationRequestSnapshot> = {}): RegistrationRequestSnapshot => ({
  id: requestId, type: 'PERSONAL_ADULT', status: 'DRAFT', version: 0, approvalExecutionStatus: 'NONE', ...overrides,
});

function repository(initial: RegistrationRequestSnapshot | null = draft()) {
  let snapshot = initial;
  const idempotency = new Map<string, RegistrationRequestSnapshot>();
  const repo: RegistrationLifecycleRepository = {
    createTypedDraft: vi.fn(async (input) => {
      snapshot = draft({ id: input.requestId, type: input.type });
      return snapshot;
    }),
    findSnapshot: vi.fn(async () => snapshot),
    findIdempotentResult: vi.fn(async (input) => idempotency.get(`${input.action}:${input.idempotencyKey}`) ?? null),
    commitTransition: vi.fn(async (input) => {
      if (!snapshot || snapshot.version !== input.expectedVersion) return { outcome: 'stale' as const };
      const applied = input.transition.snapshot;
      snapshot = applied;
      idempotency.set(`${input.action}:${input.idempotencyKey}`, applied);
      return { outcome: 'applied' as const, snapshot: applied };
    }),
  };
  return { repo, current: () => snapshot };
}

describe('RegistrationRequestLifecycleService', () => {
  it('creates a typed editable draft without accepting arbitrary detail maps', async () => {
    const { repo } = repository(null);
    const service = new RegistrationRequestLifecycleService(repo);
    await expect(service.createDraft({
      requestId, type: 'PERSONAL_ADULT', ownerIdentityId: actorId,
      detail: { type: 'PERSONAL_ADULT', applicant, player, actingForSelf: true },
    })).resolves.toMatchObject({ outcome: 'created', snapshot: { type: 'PERSONAL_ADULT', status: 'DRAFT', version: 0 } });
    expect(repo.createTypedDraft).toHaveBeenCalledOnce();
  });

  it('supports update, submit, correction and resubmit with optimistic versions', async () => {
    const state = repository();
    const service = new RegistrationRequestLifecycleService(state.repo);
    await expect(service.update({ requestId, expectedVersion: 0, actorId, idempotencyKey: key })).resolves.toMatchObject({ outcome: 'applied', snapshot: { status: 'DRAFT', version: 1 } });
    await expect(service.submit({ requestId, expectedVersion: 1, actorId, idempotencyKey: '44444444-4444-4444-8444-444444444444' })).resolves.toMatchObject({ outcome: 'applied', snapshot: { status: 'SUBMITTED', version: 2 } });
    await expect(service.requestCorrection({ requestId, expectedVersion: 2, actorId, idempotencyKey: '55555555-5555-4555-8555-555555555555', safeCategory: 'IDENTITY' })).resolves.toMatchObject({ outcome: 'applied', snapshot: { status: 'REQUIRES_CORRECTION', version: 3 } });
    await expect(service.resubmit({ requestId, expectedVersion: 3, actorId, idempotencyKey: '66666666-6666-4666-8666-666666666666' })).resolves.toMatchObject({ outcome: 'applied', snapshot: { status: 'SUBMITTED', version: 4 } });
  });

  it('prepares/finalizes approval separately and makes rejection terminal', async () => {
    const approvalState = repository(draft({ status: 'SUBMITTED', version: 4 }));
    const approval = new RegistrationRequestLifecycleService(approvalState.repo);
    await expect(approval.prepareApproval({ requestId, expectedVersion: 4, actorId, idempotencyKey: key })).resolves.toMatchObject({ outcome: 'applied', snapshot: { status: 'SUBMITTED', approvalExecutionStatus: 'PREPARED', version: 5 } });
    approvalState.repo.findSnapshot = vi.fn(async () => draft({ status: 'SUBMITTED', version: 5, approvalExecutionStatus: 'READY_TO_FINALIZE' }));
    await expect(approval.finalizeApproval({ requestId, expectedVersion: 5, actorId, idempotencyKey: '77777777-7777-4777-8777-777777777777' })).resolves.toMatchObject({ outcome: 'applied', snapshot: { status: 'APPROVED', version: 6 } });

    const rejectionState = repository(draft({ status: 'SUBMITTED', version: 8 }));
    const rejection = new RegistrationRequestLifecycleService(rejectionState.repo);
    await expect(rejection.reject({ requestId, expectedVersion: 8, actorId, idempotencyKey: key, safeCategory: 'ADMIN_DECISION' })).resolves.toMatchObject({ outcome: 'applied', snapshot: { status: 'REJECTED' } });
    await expect(rejection.update({ requestId, expectedVersion: 9, actorId, idempotencyKey: '88888888-8888-4888-8888-888888888888' })).resolves.toMatchObject({ outcome: 'invalid-transition' });
  });

  it('returns an idempotent result, rejects stale versions, and performs no partial commit on invalid transitions', async () => {
    const state = repository();
    const service = new RegistrationRequestLifecycleService(state.repo);
    const command = { requestId, expectedVersion: 0, actorId, idempotencyKey: key };
    const first = await service.submit(command);
    const second = await service.submit(command);
    expect(first).toMatchObject({ outcome: 'applied', snapshot: { version: 1 } });
    expect(second).toMatchObject({ outcome: 'idempotent', snapshot: { version: 1 } });
    expect(state.repo.commitTransition).toHaveBeenCalledTimes(1);

    await expect(service.update({ ...command, expectedVersion: 0, idempotencyKey: '99999999-9999-4999-8999-999999999999' })).resolves.toEqual({ outcome: 'stale' });
    await expect(service.update({ ...command, expectedVersion: 1, idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', safeCategory: 'raw-document-123' })).resolves.toEqual({ outcome: 'invalid-transition' });
    expect(state.current()).toMatchObject({ status: 'SUBMITTED', version: 1 });
  });
});
