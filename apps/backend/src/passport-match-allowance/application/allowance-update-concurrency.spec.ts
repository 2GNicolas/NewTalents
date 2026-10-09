import { describe, expect, it, vi } from 'vitest';

import { AllowanceCommand } from './allowance-command.js';

const passportId = '22222222-2222-4222-8222-222222222222';
const administratorId = '11111111-1111-4111-8111-111111111111';
const key = '33333333-3333-4333-8333-333333333333';
const activatedOn = new Date('2026-01-31T00:00:00.000Z');
const first = { id: 'revision-1', allowanceId: 'allowance-1', sequence: 1, idempotencyKey: '44444444-4444-4444-8444-444444444444',
  expectedVersion: 0, cadence: 'MONTHLY' as const, matchLimit: 2n, effectiveOn: activatedOn,
  previousCadence: null, previousMatchLimit: null, previousEffectiveOn: null, supersededPendingRevision: false,
  confirmedAt: new Date('2026-01-31T15:00:00Z'), confirmedByIdentityId: administratorId };
const input = { passportId, administratorIdentityId: administratorId, expectedVersion: 1, idempotencyKey: key,
  cadence: 'MONTHLY' as const, matchLimit: 3 };

type RevisionFixture = Omit<typeof first, 'previousCadence' | 'previousMatchLimit' | 'previousEffectiveOn'> & {
  previousCadence: 'MONTHLY' | null;
  previousMatchLimit: bigint | null;
  previousEffectiveOn: Date | null;
};

function setup(options: { version?: number; revisions?: RevisionFixture[]; now?: Date; state?: string; allowed?: boolean } = {}) {
  const revisions = options.revisions ?? [first];
  const aggregate = { id: 'allowance-1', version: options.version ?? revisions.length, activatedOn };
  const tx = {
    playerPassport: { findUnique: vi.fn().mockResolvedValue({ id: passportId, state: options.state ?? 'ACTIVE' }) },
    passportMatchAllowance: { findUnique: vi.fn().mockResolvedValue(aggregate), update: vi.fn().mockResolvedValue({ ...aggregate, version: aggregate.version + 1 }) },
    passportMatchAllowanceRevision: {
      findFirst: vi.fn().mockImplementation(async ({ where }: { where: { idempotencyKey: string } }) => revisions.find((row) => row.idempotencyKey === where.idempotencyKey) ?? null),
      findMany: vi.fn().mockResolvedValue(revisions),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'revision-new', confirmedAt: options.now ?? new Date('2026-02-10T16:00:00Z'), ...data })),
    },
  };
  const runner = { executeLocked: vi.fn().mockImplementation((_id: string, operation: (client: typeof tx) => Promise<unknown>) => operation(tx)) };
  const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: options.allowed ?? true }) };
  const command = new AllowanceCommand(runner as never, authorization as never, () => options.now ?? new Date('2026-02-10T16:00:00Z'));
  return { command, tx, runner, authorization };
}

describe('confirmed update and concurrency', () => {
  it('defers a limit change to the next old boundary and keeps the January-31 anchor', async () => {
    const { command, tx } = setup();
    const result = await command.confirm(input);
    expect(result).toMatchObject({ outcome: 'applied', colombiaToday: '2026-02-10', configuration: {
      version: 2, activatedOn: '2026-01-31',
      currentRule: { cadence: 'MONTHLY', matchLimit: 2 },
      currentPeriod: { start: '2026-01-31', endExclusive: '2026-02-28' },
      pendingRule: { cadence: 'MONTHLY', matchLimit: 3, effectiveOn: '2026-02-28' },
    } });
    expect(tx.passportMatchAllowance.update).toHaveBeenCalledWith({ where: { id: 'allowance-1' }, data: { version: 2 } });
    expect(tx.passportMatchAllowanceRevision.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      sequence: 2, expectedVersion: 1, effectiveOn: new Date('2026-02-28T00:00:00.000Z'),
      previousCadence: 'MONTHLY', previousMatchLimit: 2n, previousEffectiveOn: activatedOn,
      confirmedByIdentityId: administratorId,
    }), select: expect.any(Object) });
  });

  it('reanchors cadence at the old boundary while leaving activation and past periods unchanged', async () => {
    const { command, tx } = setup();
    const result = await command.confirm({ ...input, cadence: 'QUARTERLY' });
    expect(result).toMatchObject({ outcome: 'applied', configuration: { activatedOn: '2026-01-31',
      currentRule: { cadence: 'MONTHLY' }, pendingRule: { cadence: 'QUARTERLY', effectiveOn: '2026-02-28' } } });
    expect(tx.passportMatchAllowanceRevision.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ cadence: 'QUARTERLY', effectiveOn: new Date('2026-02-28T00:00:00.000Z') }) }));
    expect(tx.passportMatchAllowance.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ activatedOn: expect.anything() }) }));
  });

  it('rejects every stale version without mutation, including a second proposal for an already pending boundary', async () => {
    const pending = { ...first, id: 'revision-2', sequence: 2, idempotencyKey: '55555555-5555-4555-8555-555555555555',
      expectedVersion: 1, matchLimit: 3n, effectiveOn: new Date('2026-02-28T00:00:00.000Z'),
      previousCadence: 'MONTHLY' as const, previousMatchLimit: 2n, previousEffectiveOn: activatedOn };
    const stale = setup({ version: 2, revisions: [first, pending] });
    expect(await stale.command.confirm({ ...input, matchLimit: 4 })).toMatchObject({ outcome: 'conflict', current: { version: 2 } });
    expect(stale.tx.passportMatchAllowance.update).not.toHaveBeenCalled();
    expect(stale.tx.passportMatchAllowanceRevision.create).not.toHaveBeenCalled();

    const refreshed = setup({ version: 2, revisions: [first, pending] });
    const accepted = await refreshed.command.confirm({ ...input, expectedVersion: 2, matchLimit: 4 });
    expect(accepted).toMatchObject({ outcome: 'applied', configuration: { version: 3,
      currentRule: { matchLimit: 2 }, pendingRule: { matchLimit: 4, effectiveOn: '2026-02-28' } } });
    expect(refreshed.tx.passportMatchAllowanceRevision.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      sequence: 3, previousMatchLimit: 3n, supersededPendingRevision: true,
    }) }));
  });

  it('replays the same intention once, rejects a changed intention for the same key, and keeps audit unchanged', async () => {
    const replay = { ...first, id: 'revision-2', sequence: 2, idempotencyKey: key, expectedVersion: 1,
      matchLimit: 3n, effectiveOn: new Date('2026-02-28T00:00:00.000Z'), previousCadence: 'MONTHLY' as const,
      previousMatchLimit: 2n, previousEffectiveOn: activatedOn, confirmedAt: new Date('2026-02-10T16:00:00Z') };
    const subject = setup({ version: 2, revisions: [first, replay] });
    expect(await subject.command.confirm(input)).toMatchObject({ outcome: 'idempotent', configuration: { version: 2 } });
    expect(await subject.command.confirm({ ...input, matchLimit: 4 })).toEqual(expect.objectContaining({ outcome: 'idempotency-conflict' }));
    expect(subject.tx.passportMatchAllowance.update).not.toHaveBeenCalled();
    expect(subject.tx.passportMatchAllowanceRevision.create).not.toHaveBeenCalled();
  });

  it('uses the Colombia day at confirmation and refuses inactive or unauthorized writes', async () => {
    const boundaryDay = setup({ now: new Date('2026-02-28T05:01:00Z') });
    expect(await boundaryDay.command.confirm(input)).toMatchObject({ outcome: 'applied', colombiaToday: '2026-02-28', configuration: {
      pendingRule: { effectiveOn: '2026-03-31' },
    } });
    const inactive = setup({ state: 'DRAFT' });
    expect(await inactive.command.confirm(input)).toEqual({ outcome: 'ineligible-passport' });
    expect(inactive.tx.passportMatchAllowance.update).not.toHaveBeenCalled();
    const denied = setup({ allowed: false });
    expect(await denied.command.confirm(input)).toEqual({ outcome: 'not-found' });
    expect(denied.tx.passportMatchAllowance.update).not.toHaveBeenCalled();
  });
});
