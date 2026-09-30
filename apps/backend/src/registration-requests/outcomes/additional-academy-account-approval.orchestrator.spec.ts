import { afterEach, describe, expect, it, vi } from 'vitest';

import { AcademyOperationApprovalExecutor } from './academy-operation-approval.shared.js';
import { AdditionalAcademyAccountApprovalOrchestrator } from './additional-academy-account-approval.orchestrator.js';

describe('AdditionalAcademyAccountApprovalOrchestrator', () => {
  afterEach(() => vi.restoreAllMocks());

  it('enables only ACADEMY_USER and one active membership in the authorized academy', async () => {
    const expected = { outcome: 'approved', identityRoles: ['ACADEMY_USER'], membership: 'ACTIVE', academyId: 'academy-1', userPrivilege: false, analystPrivilege: false, administratorPrivilege: false };
    const execute = vi.spyOn(AcademyOperationApprovalExecutor.prototype, 'execute').mockResolvedValue(expected as never);
    const orchestrator = new AdditionalAcademyAccountApprovalOrchestrator({} as never, {} as never, {} as never);

    await expect(orchestrator.approve({ requestId: '11111111-1111-4111-8111-111111111111', expectedVersion: 3 })).resolves.toEqual(expected);
    expect(execute).toHaveBeenCalledWith('ADDITIONAL_ACADEMY_ACCOUNT', expect.objectContaining({ expectedVersion: 3 }));
  });
});
