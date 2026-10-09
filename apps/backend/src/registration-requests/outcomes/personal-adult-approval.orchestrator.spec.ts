import { afterEach, describe, expect, it, vi } from 'vitest';

import { PersonalAdultApprovalOrchestrator } from './personal-adult-approval.orchestrator.js';
import { PersonalApprovalExecutor } from './personal-approval.shared.js';

describe('PersonalAdultApprovalOrchestrator contract', () => {
  afterEach(() => vi.restoreAllMocks());
  it('atomically enables USER, deduplicates Player, creates SELF and one active basic passport awaiting enrichment', async () => {
    const expected = { outcome: 'approved', identityRoles: ['USER'], responsibility: 'SELF', passport: { state: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT' } };
    const execute = vi.spyOn(PersonalApprovalExecutor.prototype, 'execute').mockResolvedValue(expected as never);
    const orchestrator = new PersonalAdultApprovalOrchestrator({} as never, {} as never, {} as never);
    await expect(orchestrator.approve({ requestId: '11111111-1111-4111-8111-111111111111', expectedVersion: 1 })).resolves.toMatchObject({ outcome: 'approved', identityRoles: ['USER'], responsibility: 'SELF', passport: { state: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT' } });
    expect(execute).toHaveBeenCalledWith('PERSONAL_ADULT', expect.objectContaining({ expectedVersion: 1 }));
  });
});
