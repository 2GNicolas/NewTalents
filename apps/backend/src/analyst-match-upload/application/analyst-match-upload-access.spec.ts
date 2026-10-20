import { describe, expect, it, vi } from 'vitest';

import { AnalystMatchUploadAccess } from './analyst-match-upload-access.js';

const actor = '00000000-0000-4000-8000-000000000001';
const matchId = '00000000-0000-4000-8000-000000000002';
const passportId = '00000000-0000-4000-8000-000000000003';
const row = { id: matchId, passportId, playerId: '00000000-0000-4000-8000-000000000004',
  state: 'WAITING', unitState: 'RESERVED', version: 1 };

function harness(options: { active?: boolean; role?: boolean; profile?: boolean; match?: boolean } = {}) {
  const tx = {
    identity: { findUnique: vi.fn().mockResolvedValue({ status: options.active === false ? 'INACTIVE' : 'ACTIVE',
      roleAssignments: options.role === false ? [] : [{ role: 'ANALYST' }],
      analystOperationalProfile: options.profile === false ? null : { identityId: actor } }) },
    firstMatch: { findFirst: vi.fn().mockResolvedValue(options.match === false ? null : row) },
  };
  const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) };
  return { access: new AnalystMatchUploadAccess(prisma as never), tx, prisma };
}

describe('AnalystMatchUploadAccess', () => {
  it.each([{ active: false }, { role: false }, { profile: false }])
  ('rejects invalid current actor before reading match: %j', async (options) => {
    const { access, tx } = harness(options);
    await expect(access.readMatch(actor, matchId, async () => 'secret')).rejects.toMatchObject({ kind: 'FORBIDDEN' });
    expect(tx.firstMatch.findFirst).not.toHaveBeenCalled();
  });

  it('rejects foreign, non-active passport, removed custody, canceled and missing match identically', async () => {
    const { access, tx } = harness({ match: false });
    for (const id of [matchId, '00000000-0000-4000-8000-000000000099']) {
      await expect(access.readMatch(actor, id, async () => 'secret')).rejects.toMatchObject({ kind: 'NOT_FOUND' });
    }
    expect(tx.firstMatch.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      passport: { state: 'ACTIVE', custody: { currentAnalystIdentityId: actor } },
      state: { in: ['WAITING', 'LOADED'] },
    }) }));
  });

  it('passes a minimal authorized match scope to read and to an existing write transaction', async () => {
    const { access, tx } = harness();
    expect(await access.readMatch(actor, matchId, async (scope) => scope.match)).toEqual({ ...row, sourceKind: 'FIRST_MATCH' });
    expect(await access.requireMatchInTransaction(tx as never, actor, matchId)).toEqual({ ...row, sourceKind: 'FIRST_MATCH' });
    expect(tx.firstMatch.findFirst).toHaveBeenCalledTimes(2);
  });
});
