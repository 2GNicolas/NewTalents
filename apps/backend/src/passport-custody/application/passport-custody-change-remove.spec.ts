import { describe, expect, it, vi } from 'vitest';

import { PassportCustodyCommandService } from './passport-custody-command.service.js';

const passportId = '11111111-1111-4111-8111-111111111111';
const analystA = '22222222-2222-4222-8222-222222222222';
const analystB = '33333333-3333-4333-8333-333333333333';
const administratorId = '44444444-4444-4444-8444-444444444444';
const changeKey = '55555555-5555-4555-8555-555555555555';
const removeKey = '66666666-6666-4666-8666-666666666666';
const eventId = '77777777-7777-4777-8777-777777777777';
const changedAt = new Date('2026-10-01T10:00:00.000Z');

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    passportCustodyEvent: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: eventId }) },
    playerPassport: { findUnique: vi.fn().mockResolvedValue({ id: passportId, state: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT' }) },
    passportCustody: {
      findUnique: vi.fn().mockResolvedValue({ id: '88888888-8888-4888-8888-888888888888', version: 1, currentAnalystIdentityId: analystA, assignedAt: new Date('2026-09-30T10:00:00.000Z') }),
      update: vi.fn(), create: vi.fn(),
    },
    analystOperationalProfile: { findFirst: vi.fn().mockResolvedValue({ identityId: analystB }) },
    identity: { create: vi.fn(), update: vi.fn() },
    roleAssignment: { create: vi.fn(), update: vi.fn() },
    playerPassportCreate: vi.fn(),
    ...overrides,
  };
}

function service(tx: ReturnType<typeof transaction>) {
  const runner = { executeLocked: vi.fn(async (_passportId: string, operation: (value: unknown) => Promise<unknown>) => operation(tx)) };
  return { subject: new PassportCustodyCommandService(runner as never, () => changedAt), runner };
}

describe('PassportCustodyCommandService change/remove transitions', () => {
  it('changes A to a different eligible B exactly once and records prior/next authority', async () => {
    const tx = transaction();
    const { subject } = service(tx);

    await expect(subject.change({
      passportId, administratorIdentityId: administratorId, analystIdentityId: analystB,
      expectedVersion: 1, idempotencyKey: changeKey, reason: 'Redistribución de carga',
    })).resolves.toEqual({
      outcome: 'applied', passportId, eventId,
      custody: { state: 'ASSIGNED', version: 2, analystIdentityId: analystB, assignedAt: changedAt.toISOString() },
    });
    expect(tx.passportCustody.update).toHaveBeenCalledWith({
      where: { passportId }, data: { currentAnalystIdentityId: analystB, version: 2, assignedAt: changedAt },
    });
    expect(tx.passportCustodyEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.passportCustodyEvent.create).toHaveBeenCalledWith({ data: {
      passportId, sequence: 2, action: 'CHANGED', administratorIdentityId: administratorId,
      previousAnalystIdentityId: analystA, nextAnalystIdentityId: analystB,
      safeReason: 'Redistribución de carga', expectedVersion: 1, resultingVersion: 2, idempotencyKey: changeKey, createdAt: changedAt,
    }, select: { id: true } });
  });

  it('removes current custody exactly once and preserves the event history authority', async () => {
    const tx = transaction();
    const { subject } = service(tx);

    await expect(subject.remove({
      passportId, administratorIdentityId: administratorId,
      expectedVersion: 1, idempotencyKey: removeKey, reason: 'Retiro operativo confirmado',
    })).resolves.toEqual({ outcome: 'applied', passportId, eventId, custody: { state: 'UNASSIGNED', version: 2 } });
    expect(tx.passportCustody.update).toHaveBeenCalledWith({
      where: { passportId }, data: { currentAnalystIdentityId: null, version: 2, assignedAt: null },
    });
    expect(tx.passportCustodyEvent.create).toHaveBeenCalledWith({ data: {
      passportId, sequence: 2, action: 'REMOVED', administratorIdentityId: administratorId,
      previousAnalystIdentityId: analystA, nextAnalystIdentityId: null,
      safeReason: 'Retiro operativo confirmado', expectedVersion: 1, resultingVersion: 2, idempotencyKey: removeKey, createdAt: changedAt,
    }, select: { id: true } });
  });

  it('rejects same/ineligible targets, unassigned removal, stale versions, and inactive passports without mutation', async () => {
    const cases = [
      { action: 'change', tx: transaction({ analystOperationalProfile: { findFirst: vi.fn().mockResolvedValue(null) } }), input: { analystIdentityId: analystB }, outcome: 'ineligible-analyst' },
      { action: 'change', tx: transaction(), input: { analystIdentityId: analystA }, outcome: 'conflict' },
      { action: 'change', tx: transaction({ passportCustody: { findUnique: vi.fn().mockResolvedValue({ version: 0, currentAnalystIdentityId: null }), update: vi.fn(), create: vi.fn() } }), input: { analystIdentityId: analystB }, outcome: 'conflict' },
      { action: 'remove', tx: transaction({ passportCustody: { findUnique: vi.fn().mockResolvedValue({ version: 1, currentAnalystIdentityId: null }), update: vi.fn(), create: vi.fn() } }), input: {}, outcome: 'conflict' },
      { action: 'remove', tx: transaction({ passportCustody: { findUnique: vi.fn().mockResolvedValue({ version: 2, currentAnalystIdentityId: analystA }), update: vi.fn(), create: vi.fn() } }), input: {}, outcome: 'conflict' },
      { action: 'remove', tx: transaction({ playerPassport: { findUnique: vi.fn().mockResolvedValue({ id: passportId, state: 'INACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT' }) } }), input: {}, outcome: 'ineligible-passport' },
    ] as const;
    for (const item of cases) {
      const { subject } = service(item.tx);
      const base = { passportId, administratorIdentityId: administratorId, expectedVersion: 1, idempotencyKey: item.action === 'change' ? changeKey : removeKey, reason: 'Motivo sintético' };
      const result = item.action === 'change'
        ? await subject.change({ ...base, analystIdentityId: item.input.analystIdentityId! })
        : await subject.remove(base);
      expect(result).toMatchObject({ outcome: item.outcome });
      expect(item.tx.passportCustody.update).not.toHaveBeenCalled();
      expect(item.tx.passportCustodyEvent.create).not.toHaveBeenCalled();
    }
  });

  it('uses authoritative current rows for workloads and creates no roles, sports data, passport, or privilege', async () => {
    const tx = transaction();
    const { subject } = service(tx);
    await subject.change({ passportId, administratorIdentityId: administratorId, analystIdentityId: analystB, expectedVersion: 1, idempotencyKey: changeKey, reason: 'Cambio autorizado' });
    expect(tx.identity.create).not.toHaveBeenCalled();
    expect(tx.identity.update).not.toHaveBeenCalled();
    expect(tx.roleAssignment.create).not.toHaveBeenCalled();
    expect(tx.roleAssignment.update).not.toHaveBeenCalled();
    expect(tx.playerPassportCreate).not.toHaveBeenCalled();
    expect(tx.analystOperationalProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ identityId: analystB, identity: { status: 'ACTIVE', roleAssignments: { some: { role: 'ANALYST', status: 'ACTIVE' } } } }),
    }));
  });
});
