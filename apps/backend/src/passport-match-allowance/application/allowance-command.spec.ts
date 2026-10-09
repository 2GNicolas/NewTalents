import { describe, expect, it, vi } from 'vitest';

import { AllowanceCommand } from './allowance-command.js';

const passportId = '22222222-2222-4222-8222-222222222222';
const administratorId = '11111111-1111-4111-8111-111111111111';
const idempotencyKey = '33333333-3333-4333-8333-333333333333';
const input = { passportId, administratorIdentityId: administratorId, expectedVersion: 0,
  idempotencyKey, cadence: 'MONTHLY' as const, matchLimit: 4, expectedActivationDate: '2026-10-09' };
const clock = () => new Date('2026-10-09T05:01:00.000Z');

function setup(options: { state?: string; existing?: object | null; replay?: object | null; failure?: Error; now?: Date } = {}) {
  const tx = {
    playerPassport: { findUnique: vi.fn().mockResolvedValue({ id: passportId, state: options.state ?? 'ACTIVE' }) },
    passportMatchAllowance: {
      findUnique: vi.fn().mockResolvedValue(options.existing ?? null),
      create: vi.fn().mockResolvedValue({ id: 'allowance-1' }),
    },
    passportMatchAllowanceRevision: {
      findFirst: vi.fn().mockResolvedValue(options.replay ?? null),
      create: vi.fn().mockImplementation(async () => {
        if (options.failure) throw options.failure;
        return { id: 'revision-1', confirmedAt: clock() };
      }),
    },
  };
  const runner = { executeLocked: vi.fn().mockImplementation((_passportId: string, operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx)) };
  const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }) };
  const command = new AllowanceCommand(runner as never, authorization as never, () => options.now ?? clock());
  return { command, tx, runner, authorization };
}

describe('confirmed first allowance creation', () => {
  it.each(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'] as const)('atomically creates one %s aggregate and revision on the Colombia day', async (cadence) => {
    const { command, tx, runner, authorization } = setup();
    const result = await command.create({ ...input, cadence });
    expect(result).toMatchObject({ outcome: 'applied', configuration: {
      version: 1, activatedOn: '2026-10-09', currentRule: { cadence, matchLimit: 4, effectiveOn: '2026-10-09' },
    } });
    expect(tx.passportMatchAllowance.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ passportId, version: 1, activatedOn: new Date('2026-10-09T00:00:00.000Z') }) }));
    expect(tx.passportMatchAllowanceRevision.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      allowanceId: 'allowance-1', sequence: 1, expectedVersion: 0, idempotencyKey, matchLimit: 4n,
      previousCadence: null, previousMatchLimit: null, confirmedByIdentityId: administratorId,
    }) }));
    expect(authorization.authorize).toHaveBeenCalledWith(administratorId, 'passport.allowance.write', { exists: true, active: true }, tx);
    expect(runner.executeLocked).toHaveBeenCalledWith(passportId, expect.any(Function));
  });

  it('rejects invalid, missing, arbitrary-date and unsafe values before any write', async () => {
    const { command, tx } = setup();
    for (const patch of [
      { matchLimit: 0 }, { matchLimit: -1 }, { matchLimit: 1.5 }, { matchLimit: Number.MAX_SAFE_INTEGER + 1 },
      { matchLimit: '4' }, { cadence: 'WEEKLY' }, { expectedActivationDate: '2026-02-30' },
      { expectedActivationDate: '2026-10-08' }, { expectedActivationDate: '2026-10-10' },
      { expectedVersion: 1 }, { startDate: '2026-10-09' },
    ]) {
      const result = await command.create({ ...input, ...patch } as never);
      expect(['invalid', 'activation-date-changed', 'conflict']).toContain(result.outcome);
    }
    expect(tx.passportMatchAllowance.create).not.toHaveBeenCalled();
    expect(tx.passportMatchAllowanceRevision.create).not.toHaveBeenCalled();
  });

  it('rechecks eligibility and authority inside the locked transaction', async () => {
    const inactive = setup({ state: 'DRAFT' });
    expect(await inactive.command.create(input)).toEqual({ outcome: 'ineligible-passport' });
    expect(inactive.tx.passportMatchAllowance.create).not.toHaveBeenCalled();
    const denied = setup();
    denied.authorization.authorize.mockResolvedValue({ allowed: false });
    expect(await denied.command.create(input)).toEqual({ outcome: 'not-found' });
    expect(denied.tx.passportMatchAllowance.create).not.toHaveBeenCalled();
  });

  it('replays the same intention exactly once and conflicts on changed intent or an existing aggregate', async () => {
    const replay = { id: 'revision-1', sequence: 1, expectedVersion: 0, idempotencyKey,
      cadence: 'MONTHLY', matchLimit: 4n, effectiveOn: new Date('2026-10-09T00:00:00Z'),
      confirmedAt: clock(), confirmedByIdentityId: administratorId };
    const previous = setup({ existing: { id: 'allowance-1', version: 1, activatedOn: replay.effectiveOn }, replay });
    expect(await previous.command.create(input)).toMatchObject({ outcome: 'idempotent', configuration: { version: 1 } });
    expect(previous.tx.passportMatchAllowance.create).not.toHaveBeenCalled();
    expect(await previous.command.create({ ...input, matchLimit: 5 })).toEqual({ outcome: 'idempotency-conflict' });
    const nextDayReplay = setup({ existing: { id: 'allowance-1', version: 1, activatedOn: replay.effectiveOn }, replay,
      now: new Date('2026-10-10T05:01:00.000Z') });
    expect(await nextDayReplay.command.create(input)).toMatchObject({ outcome: 'idempotent', colombiaToday: '2026-10-09' });
    const stale = setup({ existing: { id: 'allowance-1', version: 1, activatedOn: replay.effectiveOn } });
    expect(await stale.command.create(input)).toEqual({ outcome: 'conflict' });
  });

  it('has no side effect before confirmation and reports storage failure without partial success', async () => {
    const untouched = setup();
    expect(untouched.runner.executeLocked).not.toHaveBeenCalled();
    const failed = setup({ failure: new Error('storage failure') });
    expect(await failed.command.create(input)).toEqual({ outcome: 'unavailable' });
    expect(failed.runner.executeLocked).toHaveBeenCalledTimes(1);
  });
});
