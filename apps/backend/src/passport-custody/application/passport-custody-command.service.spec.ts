import { describe, expect, it, vi } from 'vitest';

import { PassportCustodyCommandService } from './passport-custody-command.service.js';

const passportId = '11111111-1111-4111-8111-111111111111';
const analystId = '22222222-2222-4222-8222-222222222222';
const administratorId = '33333333-3333-4333-8333-333333333333';
const idempotencyKey = '44444444-4444-4444-8444-444444444444';
const eventId = '55555555-5555-4555-8555-555555555555';
const assignedAt = new Date('2026-09-30T16:00:00.000Z');

const validInput = Object.freeze({
  passportId,
  administratorIdentityId: administratorId,
  analystIdentityId: analystId,
  expectedVersion: 0,
  idempotencyKey,
});

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
      create: vi.fn().mockResolvedValue({ id: '66666666-6666-4666-8666-666666666666', version: 1, assignedAt }),
      update: vi.fn(),
    },
    analystOperationalProfile: {
      findFirst: vi.fn().mockResolvedValue({ identityId: analystId }),
    },
    identity: { create: vi.fn() },
    roleAssignment: { create: vi.fn() },
    playerPassportCreate: vi.fn(),
    ...overrides,
  };
}

describe('PassportCustodyCommandService initial assignment', () => {
  it('locks the existing passport and creates one versioned custody plus exactly one ASSIGNED event', async () => {
    const tx = transaction();
    const runner = { executeLocked: vi.fn(async (_passportId: string, operation: (value: unknown) => Promise<unknown>) => operation(tx)) };
    const service = new PassportCustodyCommandService(runner as never, () => assignedAt);

    await expect(service.assign(validInput)).resolves.toEqual({
      outcome: 'applied',
      passportId,
      eventId,
      custody: { state: 'ASSIGNED', version: 1, analystIdentityId: analystId, assignedAt: assignedAt.toISOString() },
    });
    expect(runner.executeLocked).toHaveBeenCalledWith(passportId, expect.any(Function));
    expect(tx.passportCustody.create).toHaveBeenCalledWith({ data: { passportId, currentAnalystIdentityId: analystId, version: 1, assignedAt } });
    expect(tx.passportCustodyEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.passportCustodyEvent.create).toHaveBeenCalledWith({ data: {
      passportId, sequence: 1, action: 'ASSIGNED', administratorIdentityId: administratorId,
      previousAnalystIdentityId: null, nextAnalystIdentityId: analystId,
      safeReason: null, expectedVersion: 0, resultingVersion: 1, idempotencyKey, createdAt: assignedAt,
    }, select: { id: true } });
    expect(tx.identity.create).not.toHaveBeenCalled();
    expect(tx.roleAssignment.create).not.toHaveBeenCalled();
    expect(tx.playerPassportCreate).not.toHaveBeenCalled();
  });

  it('rechecks the active basic passport, current version, unassigned state, and target eligibility', async () => {
    const cases = [
      { mutate: { playerPassport: { findUnique: vi.fn().mockResolvedValue(null) } }, outcome: 'not-found' },
      { mutate: { playerPassport: { findUnique: vi.fn().mockResolvedValue({ id: passportId, state: 'DRAFT', enrichmentStatus: 'COMPLETE' }) } }, outcome: 'ineligible-passport' },
      { mutate: { passportCustody: { findUnique: vi.fn().mockResolvedValue({ version: 1, currentAnalystIdentityId: null }), create: vi.fn(), update: vi.fn() } }, outcome: 'conflict' },
      { mutate: { passportCustody: { findUnique: vi.fn().mockResolvedValue({ version: 0, currentAnalystIdentityId: analystId }), create: vi.fn(), update: vi.fn() } }, outcome: 'conflict' },
      { mutate: { analystOperationalProfile: { findFirst: vi.fn().mockResolvedValue(null) } }, outcome: 'ineligible-analyst' },
    ] as const;
    for (const item of cases) {
      const tx = transaction(item.mutate);
      const runner = { executeLocked: vi.fn(async (_passportId: string, operation: (value: unknown) => Promise<unknown>) => operation(tx)) };
      const service = new PassportCustodyCommandService(runner as never, () => assignedAt);
      await expect(service.assign(validInput)).resolves.toMatchObject({ outcome: item.outcome });
      expect(tx.passportCustodyEvent.create).not.toHaveBeenCalled();
    }
  });

  it('does not require or persist a reason for initial assignment', async () => {
    const runner = { executeLocked: vi.fn() };
    const service = new PassportCustodyCommandService(runner as never, () => assignedAt);
    await expect(service.assign({ ...validInput, passportId: 'not-uuid' })).resolves.toEqual({ outcome: 'invalid' });
    expect(runner.executeLocked).not.toHaveBeenCalled();
  });

  it('returns an idempotent result for the same applied intention without a second mutation', async () => {
    const tx = transaction({
      passportCustodyEvent: {
        findUnique: vi.fn().mockResolvedValue({
          id: eventId, passportId, action: 'ASSIGNED', administratorIdentityId: administratorId,
          nextAnalystIdentityId: analystId, safeReason: null, expectedVersion: 0, resultingVersion: 1,
        }),
        create: vi.fn(),
      },
      passportCustody: {
        findUnique: vi.fn().mockResolvedValue({ version: 1, currentAnalystIdentityId: analystId, assignedAt }),
        create: vi.fn(), update: vi.fn(),
      },
    });
    const runner = { executeLocked: vi.fn(async (_passportId: string, operation: (value: unknown) => Promise<unknown>) => operation(tx)) };
    const service = new PassportCustodyCommandService(runner as never, () => assignedAt);

    await expect(service.assign(validInput)).resolves.toMatchObject({ outcome: 'idempotent', eventId, custody: { version: 1 } });
    expect(tx.passportCustody.create).not.toHaveBeenCalled();
    expect(tx.passportCustody.update).not.toHaveBeenCalled();
    expect(tx.passportCustodyEvent.create).not.toHaveBeenCalled();
  });

  it('contains storage failures inside the transaction result with no explicit partial fallback writes', async () => {
    const runner = { executeLocked: vi.fn().mockRejectedValue(new Error('storage failed')) };
    const service = new PassportCustodyCommandService(runner as never, () => assignedAt);

    await expect(service.assign(validInput)).resolves.toEqual({ outcome: 'unavailable' });
    expect(runner.executeLocked).toHaveBeenCalledTimes(1);
  });
});
