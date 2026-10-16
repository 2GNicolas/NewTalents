import { describe, expect, it, vi } from 'vitest';

import { AnalystWorkspaceAccess } from './analyst-workspace-access.js';

const actor = '00000000-0000-4000-8000-000000000001';
const passport = '00000000-0000-4000-8000-000000000002';

function harness(options: { active?: boolean; role?: boolean; profile?: boolean; passportActive?: boolean; custody?: boolean } = {}) {
  const tx = {
    identity: { findUnique: vi.fn().mockResolvedValue(options.active === false ? { status: 'INACTIVE' } : {
      status: 'ACTIVE', roleAssignments: options.role === false ? [] : [{ role: 'ANALYST' }],
      analystOperationalProfile: options.profile === false ? null : { identityId: actor },
    }) },
    playerPassport: { findFirst: vi.fn().mockResolvedValue(options.passportActive === false || options.custody === false ? null : { id: passport }) },
  };
  const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) };
  return { access: new AnalystWorkspaceAccess(prisma as never), tx };
}

describe('AnalystWorkspaceAccess', () => {
  it.each([
    { active: false }, { role: false }, { profile: false },
  ])('denies collection when current Analyst eligibility is absent: %j', async (options) => {
    const { access } = harness(options);
    await expect(access.readCollection(actor, async () => 'secret')).rejects.toMatchObject({ kind: 'FORBIDDEN' });
  });

  it('requires ACTIVE passport and current custody for direct access', async () => {
    for (const options of [{ passportActive: false }, { custody: false }]) {
      const { access } = harness(options);
      await expect(access.readPassport(actor, passport, async () => 'secret')).rejects.toMatchObject({ kind: 'NOT_FOUND' });
    }
  });

  it('passes only a validated read scope to the projection', async () => {
    const { access, tx } = harness();
    const result = await access.readPassport(actor, passport, async (scope) => ({ actor: scope.actorIdentityId, passport: scope.passportId }));
    expect(result).toEqual({ actor, passport });
    expect(tx.playerPassport.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: passport, state: 'ACTIVE', custody: { currentAnalystIdentityId: actor } }),
    }));
  });
});
