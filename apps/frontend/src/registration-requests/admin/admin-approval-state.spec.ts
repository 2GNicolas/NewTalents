import { approvalViewState } from '../../../app/(admin)/registration/[requestId]/approval';
import type { AdminRegistrationReview } from '../registration-request-api';

const review = { status: 'SUBMITTED', approvalExecutionStatus: 'NONE', deletion: { status: 'PENDING', totalItems: 2, completedItems: 0 } } as AdminRegistrationReview;

describe('Administrator approval view state', () => {
  it('does not confuse correction-replacement cleanup with an approval execution', () => {
    expect(approvalViewState(review)).toBe('ready');
    expect(approvalViewState({ ...review, approvalExecutionStatus: 'DELETING_EVIDENCE' })).toBe('pending-deletion');
    expect(approvalViewState({ ...review, approvalExecutionStatus: 'RECOVERY_REQUIRED' })).toBe('recovery-required');
  });
});
