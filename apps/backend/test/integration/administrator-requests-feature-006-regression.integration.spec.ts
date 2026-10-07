import { describe, expect, it, vi } from 'vitest';

import { AdminRegistrationReviewController } from '../../src/registration-requests/http/admin-registration-review.controller.js';

const identityId = '70000000-0000-4000-8000-000000000001';
const requestId = '70000000-0000-4000-8000-000000000003';
const idempotencyKey = '70000000-0000-4000-8000-000000000009';
const actor = { actor: { identityId } } as never;

describe('Feature 007 Administrator workspace reuses Feature 006 operations', () => {
  it('delegates review, correction and rejection to the existing services unchanged', async () => {
    const queries = { list: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }) };
    const reviews = { detail: vi.fn().mockResolvedValue({ outcome: 'found', request: { id: requestId } }) };
    const decisions = {
      requestCorrection: vi.fn().mockResolvedValue({ outcome: 'applied', requestId, requestStatus: 'REQUIRES_CORRECTION' }),
      reject: vi.fn().mockResolvedValue({ outcome: 'applied', requestId, requestStatus: 'REJECTED' }),
    };
    const controller = new AdminRegistrationReviewController(queries as never, reviews as never, decisions as never, {} as never, {} as never, {} as never);

    await expect(controller.list(actor, { limit: '20' })).resolves.toEqual({ data: [], pagination: { hasMore: false } });
    await expect(controller.detail(actor, requestId)).resolves.toEqual({ data: { id: requestId } });
    await expect(controller.correction(actor, requestId, { expectedVersion: 3, idempotencyKey, safeReason: 'Corrección sintética segura', correctionTargets: ['IDENTITY_FRONT'] })).resolves.toMatchObject({ data: { outcome: 'applied' } });
    await expect(controller.reject(actor, requestId, { expectedVersion: 3, idempotencyKey, safeReason: 'Rechazo sintético seguro' })).resolves.toMatchObject({ data: { outcome: 'applied' } });
    expect(decisions.requestCorrection).toHaveBeenCalledWith(identityId, requestId, expect.objectContaining({ expectedVersion: 3 }));
    expect(decisions.reject).toHaveBeenCalledWith(identityId, requestId, expect.objectContaining({ expectedVersion: 3 }));
  });

  it('keeps dossier confirmation, evidence deletion and typed approval result in the existing execution boundary', async () => {
    const executionId = '70000000-0000-4000-8000-000000000010';
    const approvals = {
      approve: vi.fn().mockResolvedValue({ outcome: 'pending-deletion', executionId, requestId, requestStatus: 'SUBMITTED' }),
      finalize: vi.fn().mockResolvedValue({ outcome: 'approved', requestId, requestStatus: 'APPROVED', resultReferences: { passportId: '70000000-0000-4000-8000-000000000005' } }),
    };
    const deletions = { retryRequestRecovery: vi.fn().mockResolvedValue({ outcome: 'scheduled', requestId, requestStatus: 'SUBMITTED' }) };
    const worker = { runOnce: vi.fn().mockResolvedValue({ claimed: 1, completed: 1, deferred: 0, recoveryRequired: 0 }) };
    const controller = new AdminRegistrationReviewController({} as never, {} as never, {} as never, approvals as never, deletions as never, worker as never);

    const approval = await controller.approve(actor, requestId, { expectedVersion: 3, idempotencyKey, manualDossierConfirmation: { confirmed: true, dossierName: 'exp-regresion', declarationVersion: 'manual-v1', categories: ['IDENTITY_FRONT'] } });
    expect(approvals.approve).toHaveBeenCalledWith(identityId, requestId, expect.objectContaining({ manualDossierConfirmation: expect.objectContaining({ confirmed: true }) }));
    expect(worker.runOnce).toHaveBeenCalledOnce();
    expect(approvals.finalize).toHaveBeenCalledWith(executionId, identityId);
    expect(approval.data).toMatchObject({ outcome: 'approved', resultReferences: { passportId: expect.any(String) } });

    await expect(controller.retryDeletion(actor, requestId, { expectedVersion: 3, idempotencyKey })).resolves.toMatchObject({ data: { outcome: 'scheduled' } });
    expect(deletions.retryRequestRecovery).toHaveBeenCalledWith({ actorIdentityId: identityId, requestId, expectedVersion: 3 });
  });
});
