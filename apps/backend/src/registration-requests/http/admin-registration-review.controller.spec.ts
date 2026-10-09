import { describe, expect, it, vi } from 'vitest';

import { AdminRegistrationReviewController } from './admin-registration-review.controller.js';

describe('AdminRegistrationReviewController approval', () => {
  it('processes the bounded deletion worker and finalizes only after preparation', async () => {
    const approve = vi.fn().mockResolvedValue({ outcome: 'pending-deletion', executionId: '11111111-1111-4111-8111-111111111111', requestId: '22222222-2222-4222-8222-222222222222', requestStatus: 'SUBMITTED' });
    const finalize = vi.fn().mockResolvedValue({ outcome: 'approved', requestId: '22222222-2222-4222-8222-222222222222', requestStatus: 'APPROVED' });
    const runOnce = vi.fn().mockResolvedValue({ claimed: 2, completed: 2, deferred: 0, recoveryRequired: 0 });
    const controller = new AdminRegistrationReviewController({} as never, {} as never, {} as never, { approve, finalize } as never, {} as never, { runOnce } as never);

    const response = await controller.approve(
      { actor: { identityId: '33333333-3333-4333-8333-333333333333' } } as never,
      '22222222-2222-4222-8222-222222222222',
      { expectedVersion: 1, idempotencyKey: '44444444-4444-4444-8444-444444444444', manualDossierConfirmation: { confirmed: true, dossierName: 'exp-prueba-001', declarationVersion: 'manual-v1', categories: ['IDENTITY_FRONT', 'IDENTITY_BACK'] } },
    );

    expect(approve).toHaveBeenCalledOnce();
    expect(runOnce).toHaveBeenCalledOnce();
    expect(finalize).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333');
    expect(response.data).toMatchObject({ outcome: 'approved', requestStatus: 'APPROVED' });
    expect(approve.mock.invocationCallOrder[0]!).toBeLessThan(runOnce.mock.invocationCallOrder[0]!);
    expect(runOnce.mock.invocationCallOrder[0]!).toBeLessThan(finalize.mock.invocationCallOrder[0]!);
  });
});
