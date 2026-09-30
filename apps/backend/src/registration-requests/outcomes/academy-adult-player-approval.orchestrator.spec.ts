import { afterEach, describe, expect, it, vi } from 'vitest';

import { AcademyOperationApprovalExecutor } from './academy-operation-approval.shared.js';
import { AcademyAdultPlayerApprovalOrchestrator } from './academy-adult-player-approval.orchestrator.js';

describe('AcademyAdultPlayerApprovalOrchestrator', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates Player, academy sporting relationship and one basic passport without USER or SELF', async () => {
    const expected = { outcome: 'approved', playerCount: 1, sportingRelationship: 'ACTIVE', responsibility: 'ACADEMY', passportCount: 1, userCreated: false, selfResponsibilityCreated: false };
    const execute = vi.spyOn(AcademyOperationApprovalExecutor.prototype, 'execute').mockResolvedValue(expected as never);
    const orchestrator = new AcademyAdultPlayerApprovalOrchestrator({} as never, {} as never, {} as never);

    await expect(orchestrator.approve({ requestId: '11111111-1111-4111-8111-111111111111', expectedVersion: 2 })).resolves.toEqual(expected);
    expect(execute).toHaveBeenCalledWith('ACADEMY_ADULT_PLAYER', expect.objectContaining({ expectedVersion: 2 }));
  });
});
