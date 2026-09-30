import { describe, expect, it } from 'vitest';

import { RegistrationRequestAggregate, RegistrationRequestDomainError } from './registration-request.aggregate.js';
import type { RegistrationRequestSnapshot } from './registration-request.types.js';

const draft = (overrides: Partial<RegistrationRequestSnapshot> = {}): RegistrationRequestSnapshot => ({
  id: '11111111-1111-4111-8111-111111111111', type: 'PERSONAL_ADULT', status: 'DRAFT', version: 0,
  approvalExecutionStatus: 'NONE', ...overrides,
});

describe('RegistrationRequestAggregate', () => {
  it('permits only the approved product transitions and increments optimistic version', () => {
    const submitted = RegistrationRequestAggregate.from(draft()).transition({ action: 'SUBMIT', expectedVersion: 0, actorId: 'actor' });
    expect(submitted.snapshot).toMatchObject({ status: 'SUBMITTED', version: 1 });
    const correction = RegistrationRequestAggregate.from(submitted.snapshot).transition({ action: 'REQUEST_CORRECTION', expectedVersion: 1, actorId: 'admin', safeCategory: 'IDENTITY' });
    expect(correction.snapshot).toMatchObject({ status: 'REQUIRES_CORRECTION', version: 2 });
    const resubmitted = RegistrationRequestAggregate.from(correction.snapshot).transition({ action: 'RESUBMIT', expectedVersion: 2, actorId: 'actor' });
    expect(resubmitted.snapshot).toMatchObject({ status: 'SUBMITTED', version: 3 });
  });

  it('rejects stale versions and invalid or terminal-state mutations', () => {
    expect(() => RegistrationRequestAggregate.from(draft({ version: 2 })).transition({ action: 'SUBMIT', expectedVersion: 1, actorId: 'actor' })).toThrowError(RegistrationRequestDomainError);
    for (const status of ['APPROVED', 'REJECTED'] as const) {
      expect(() => RegistrationRequestAggregate.from(draft({ status })).transition({ action: 'UPDATE', expectedVersion: 0, actorId: 'actor' })).toThrowError('terminal');
    }
    expect(() => RegistrationRequestAggregate.from(draft({ status: 'SUBMITTED' })).transition({ action: 'UPDATE', expectedVersion: 0, actorId: 'actor' })).toThrowError('not allowed');
  });

  it('keeps approval execution orthogonal and requires verified readiness before final approval', () => {
    const submitted = draft({ status: 'SUBMITTED', version: 4 });
    const prepared = RegistrationRequestAggregate.from(submitted).transition({ action: 'PREPARE_APPROVAL', expectedVersion: 4, actorId: 'admin' });
    expect(prepared.snapshot).toMatchObject({ status: 'SUBMITTED', approvalExecutionStatus: 'PREPARED', version: 5 });
    expect(() => RegistrationRequestAggregate.from(prepared.snapshot).transition({ action: 'FINALIZE_APPROVAL', expectedVersion: 5, actorId: 'admin' })).toThrowError('READY_TO_FINALIZE');
    const finalized = RegistrationRequestAggregate.from({ ...prepared.snapshot, approvalExecutionStatus: 'READY_TO_FINALIZE' }).transition({ action: 'FINALIZE_APPROVAL', expectedVersion: 5, actorId: 'admin' });
    expect(finalized.snapshot).toMatchObject({ status: 'APPROVED', approvalExecutionStatus: 'FINALIZED', version: 6 });
  });

  it('emits a safely projectable event without arbitrary details', () => {
    const result = RegistrationRequestAggregate.from(draft()).transition({ action: 'SUBMIT', expectedVersion: 0, actorId: 'actor', safeCategory: 'SUBMISSION' });
    expect(result.event).toEqual({ actorId: 'actor', action: 'SUBMITTED', outcome: 'APPLIED', priorStatus: 'DRAFT', resultingStatus: 'SUBMITTED', requestVersion: 1, safeCategory: 'SUBMISSION' });
    expect(JSON.stringify(result.event)).not.toMatch(/password|document|birth|contact|base64/i);
  });
});
