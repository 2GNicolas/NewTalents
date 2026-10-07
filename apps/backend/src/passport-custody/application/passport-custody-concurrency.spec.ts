import { describe, expect, it, vi } from 'vitest';

import { PassportCustodyTransactionRunner } from '../persistence/passport-custody-transaction.runner.js';
import { PassportCustodyCommandService } from './passport-custody-command.service.js';

const passportId = '11111111-1111-4111-8111-111111111111';
const administratorId = '22222222-2222-4222-8222-222222222222';
const analystA = '33333333-3333-4333-8333-333333333333';
const analystB = '44444444-4444-4444-8444-444444444444';
const key = '55555555-5555-4555-8555-555555555555';
const eventId = '66666666-6666-4666-8666-666666666666';
const eventAt = new Date('2026-10-01T10:00:00.000Z');

const command = {
  passportId,
  administratorIdentityId: administratorId,
  analystIdentityId: analystA,
  expectedVersion: 0,
  idempotencyKey: key,
} as const;

function replayEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: eventId,
    passportId,
    action: 'ASSIGNED',
    administratorIdentityId: administratorId,
    previousAnalystIdentityId: null,
    nextAnalystIdentityId: analystA,
    safeReason: null,
    expectedVersion: 0,
    resultingVersion: 1,
    createdAt: eventAt,
    ...overrides,
  };
}

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    passportCustodyEvent: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: eventId }),
    },
    playerPassport: {
      findUnique: vi.fn().mockResolvedValue({ id: passportId, state: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT' }),
    },
    passportCustody: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    analystOperationalProfile: { findFirst: vi.fn().mockResolvedValue({ identityId: analystA }) },
    ...overrides,
  };
}

describe('PassportCustodyCommandService concurrency and idempotency', () => {
  it('reconstructs a same-key same-intention result from the immutable event even after current custody advances', async () => {
    const tx = transaction({
      passportCustodyEvent: { findUnique: vi.fn().mockResolvedValue(replayEvent()), create: vi.fn() },
      passportCustody: {
        findUnique: vi.fn().mockResolvedValue({ version: 2, currentAnalystIdentityId: analystB, assignedAt: new Date('2026-10-01T11:00:00.000Z') }),
        create: vi.fn(), update: vi.fn(),
      },
    });
    const runner = { executeLocked: vi.fn(async (_id: string, operation: (client: unknown) => Promise<unknown>) => operation(tx)) };
    const service = new PassportCustodyCommandService(runner as never);

    await expect(service.assign(command)).resolves.toEqual({
      outcome: 'idempotent', passportId, eventId,
      custody: { state: 'ASSIGNED', version: 1, analystIdentityId: analystA, assignedAt: eventAt.toISOString() },
    });
    expect(tx.passportCustodyEvent.create).not.toHaveBeenCalled();
    expect(tx.passportCustody.create).not.toHaveBeenCalled();
    expect(tx.passportCustody.update).not.toHaveBeenCalled();
  });

  it('reconstructs CHANGED and REMOVED replay projections without another state/event write', async () => {
    const changeInput = { ...command, analystIdentityId: analystB, expectedVersion: 1, reason: 'Cambio concurrente seguro' };
    const changeTx = transaction({
      passportCustodyEvent: { findUnique: vi.fn().mockResolvedValue(replayEvent({ action: 'CHANGED', previousAnalystIdentityId: analystA, nextAnalystIdentityId: analystB, expectedVersion: 1, resultingVersion: 2, safeReason: changeInput.reason })), create: vi.fn() },
    });
    const changeRunner = { executeLocked: vi.fn(async (_id: string, operation: (client: unknown) => Promise<unknown>) => operation(changeTx)) };
    await expect(new PassportCustodyCommandService(changeRunner as never).change(changeInput)).resolves.toEqual({
      outcome: 'idempotent', passportId, eventId,
      custody: { state: 'ASSIGNED', version: 2, analystIdentityId: analystB, assignedAt: eventAt.toISOString() },
    });

    const removeInput = { passportId, administratorIdentityId: administratorId, expectedVersion: 2, idempotencyKey: key, reason: 'Retiro concurrente seguro' };
    const removeTx = transaction({
      passportCustodyEvent: { findUnique: vi.fn().mockResolvedValue(replayEvent({ action: 'REMOVED', previousAnalystIdentityId: analystB, nextAnalystIdentityId: null, expectedVersion: 2, resultingVersion: 3, safeReason: removeInput.reason })), create: vi.fn() },
    });
    const removeRunner = { executeLocked: vi.fn(async (_id: string, operation: (client: unknown) => Promise<unknown>) => operation(removeTx)) };
    await expect(new PassportCustodyCommandService(removeRunner as never).remove(removeInput)).resolves.toEqual({
      outcome: 'idempotent', passportId, eventId, custody: { state: 'UNASSIGNED', version: 3 },
    });
    expect(changeTx.passportCustodyEvent.create).not.toHaveBeenCalled();
    expect(removeTx.passportCustodyEvent.create).not.toHaveBeenCalled();
  });

  it('rejects reuse of a key for another intention without mutation and reports the target current state', async () => {
    const tx = transaction({
      passportCustodyEvent: { findUnique: vi.fn().mockResolvedValue(replayEvent({ nextAnalystIdentityId: analystB })), create: vi.fn() },
      passportCustody: {
        findUnique: vi.fn().mockResolvedValue({ version: 1, currentAnalystIdentityId: analystA, assignedAt: eventAt }),
        create: vi.fn(), update: vi.fn(),
      },
    });
    const runner = { executeLocked: vi.fn(async (_id: string, operation: (client: unknown) => Promise<unknown>) => operation(tx)) };

    await expect(new PassportCustodyCommandService(runner as never).assign(command)).resolves.toEqual({
      outcome: 'idempotency-conflict',
      current: { state: 'ASSIGNED', version: 1, analystIdentityId: analystA, assignedAt: eventAt.toISOString() },
    });
    expect(tx.passportCustodyEvent.create).not.toHaveBeenCalled();
    expect(tx.passportCustody.update).not.toHaveBeenCalled();
  });

  it('returns authoritative current state for a stale version and never appends a duplicate sequence', async () => {
    const tx = transaction({
      passportCustody: {
        findUnique: vi.fn().mockResolvedValue({ version: 1, currentAnalystIdentityId: analystA, assignedAt: eventAt }),
        create: vi.fn(), update: vi.fn(),
      },
    });
    const runner = { executeLocked: vi.fn(async (_id: string, operation: (client: unknown) => Promise<unknown>) => operation(tx)) };

    await expect(new PassportCustodyCommandService(runner as never).assign(command)).resolves.toEqual({
      outcome: 'conflict',
      current: { state: 'ASSIGNED', version: 1, analystIdentityId: analystA, assignedAt: eventAt.toISOString() },
    });
    expect(tx.passportCustodyEvent.create).not.toHaveBeenCalled();
  });

  it('re-enters one fresh locked transaction after a unique race so the winner can be replayed', async () => {
    const first = Object.assign(new Error('unique race'), { code: 'P2002' });
    const tx = transaction({ passportCustodyEvent: { findUnique: vi.fn().mockResolvedValue(replayEvent()), create: vi.fn() } });
    const runner = {
      executeLocked: vi.fn()
        .mockRejectedValueOnce(first)
        .mockImplementationOnce(async (_id: string, operation: (client: unknown) => Promise<unknown>) => operation(tx)),
    };

    await expect(new PassportCustodyCommandService(runner as never).assign(command)).resolves.toMatchObject({ outcome: 'idempotent', eventId });
    expect(runner.executeLocked).toHaveBeenCalledTimes(2);
  });

  it('returns unavailable after a pre-commit storage failure without logging protected data', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const runner = { executeLocked: vi.fn().mockRejectedValue(new Error('pre-commit failure')) };
    await expect(new PassportCustodyCommandService(runner as never).assign(command)).resolves.toEqual({ outcome: 'unavailable' });
    expect(logger).not.toHaveBeenCalled();
    logger.mockRestore();
  });
});

describe('PassportCustodyTransactionRunner bounded serialization retries', () => {
  it('uses fresh Serializable transactions with 50ms and 100ms delays before succeeding', async () => {
    let attempts = 0;
    const prisma = {
      $transaction: vi.fn(async (operation: (tx: unknown) => Promise<unknown>, options: unknown) => {
        attempts += 1;
        expect(options).toMatchObject({ isolationLevel: 'Serializable' });
        if (attempts < 3) throw Object.assign(new Error('serialization'), { code: 'P2034' });
        return operation({ $queryRaw: vi.fn(), marker: 'fresh' });
      }),
    };
    const delay = vi.fn().mockResolvedValue(undefined);
    const operation = vi.fn().mockResolvedValue('applied');
    const runner = new PassportCustodyTransactionRunner(prisma as never, delay);

    await expect(runner.executeLocked(passportId, operation as never)).resolves.toBe('applied');
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(delay.mock.calls).toEqual([[50], [100]]);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('exhausts after three P2034 attempts and never retries another failure code', async () => {
    const p2034 = Object.assign(new Error('serialization'), { code: 'P2034' });
    const prisma = { $transaction: vi.fn().mockRejectedValue(p2034) };
    const delay = vi.fn().mockResolvedValue(undefined);
    await expect(new PassportCustodyTransactionRunner(prisma as never, delay).executeLocked(passportId, vi.fn())).rejects.toBe(p2034);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(delay.mock.calls).toEqual([[50], [100]]);

    const nonRetryable = Object.assign(new Error('storage'), { code: 'P2003' });
    prisma.$transaction.mockClear().mockRejectedValue(nonRetryable);
    await expect(new PassportCustodyTransactionRunner(prisma as never, delay).executeLocked(passportId, vi.fn())).rejects.toBe(nonRetryable);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
