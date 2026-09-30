import { afterEach, describe, expect, it, vi } from 'vitest';

import { PersonalApprovalExecutor } from './personal-approval.shared.js';
import { RepresentedMinorApprovalOrchestrator } from './represented-minor-approval.orchestrator.js';

describe('RepresentedMinorApprovalOrchestrator contract', () => {
  afterEach(() => vi.restoreAllMocks());
  it('enables only representative USER, creates legal responsibility/passport and no minor account', async () => {
    const expected = { outcome: 'approved', representativeRoles: ['USER'], responsibility: 'LEGAL_REPRESENTATIVE', minorAccountCreated: false, passportCount: 1 };
    const execute = vi.spyOn(PersonalApprovalExecutor.prototype, 'execute').mockResolvedValue(expected as never);
    const orchestrator = new RepresentedMinorApprovalOrchestrator({} as never, {} as never, {} as never);
    await expect(orchestrator.approve({ requestId: '11111111-1111-4111-8111-111111111111', expectedVersion: 1 })).resolves.toMatchObject({ outcome: 'approved', representativeRoles: ['USER'], responsibility: 'LEGAL_REPRESENTATIVE', minorAccountCreated: false, passportCount: 1 });
    expect(execute).toHaveBeenCalledWith('REPRESENTED_MINOR', expect.objectContaining({ expectedVersion: 1 }));
  });
});
