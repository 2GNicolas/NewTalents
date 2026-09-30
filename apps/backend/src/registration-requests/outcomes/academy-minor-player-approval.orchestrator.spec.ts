import { afterEach, describe, expect, it, vi } from 'vitest';

import { AcademyOperationApprovalExecutor } from './academy-operation-approval.shared.js';
import { AcademyMinorPlayerApprovalOrchestrator } from './academy-minor-player-approval.orchestrator.js';

describe('AcademyMinorPlayerApprovalOrchestrator', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps legal and sporting relationships separate and creates no automatic accounts', async () => {
    const expected = { outcome: 'approved', playerCount: 1, sportingRelationship: 'ACTIVE', responsibilities: ['LEGAL_REPRESENTATIVE', 'ACADEMY'], passportCount: 1, automaticAccounts: 0 };
    const execute = vi.spyOn(AcademyOperationApprovalExecutor.prototype, 'execute').mockResolvedValue(expected as never);
    const orchestrator = new AcademyMinorPlayerApprovalOrchestrator({} as never, {} as never, {} as never);

    await expect(orchestrator.approve({ requestId: '11111111-1111-4111-8111-111111111111', expectedVersion: 4 })).resolves.toEqual(expected);
    expect(execute).toHaveBeenCalledWith('ACADEMY_MINOR_PLAYER', expect.objectContaining({ expectedVersion: 4 }));
  });
});
