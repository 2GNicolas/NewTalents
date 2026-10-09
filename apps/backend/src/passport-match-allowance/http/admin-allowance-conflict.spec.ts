import { HEADERS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AdminAllowanceController } from './admin-allowance.controller.js';
import { AdminAllowanceExceptionFilter, AdminAllowanceHttpError } from './admin-allowance-exception.filter.js';

const administratorId = '11111111-1111-4111-8111-111111111111';
const passportId = '22222222-2222-4222-8222-222222222222';
const idempotencyKey = '33333333-3333-4333-8333-333333333333';
const request = { actor: { identityId: administratorId, sessionId: 'session' } };
const update = { expectedVersion: 1, idempotencyKey, cadence: 'QUARTERLY', matchLimit: 6 };
const current = { passportId, canConfigure: true, colombiaToday: '2026-10-09', configuration: {
  version: 2, activatedOn: '2026-10-09', currentRule: { cadence: 'MONTHLY', matchLimit: 4, effectiveOn: '2026-10-09' },
  currentPeriod: { start: '2026-10-09', endExclusive: '2026-11-09', nextStart: '2026-11-09' },
  pendingRule: { cadence: 'QUARTERLY', matchLimit: 5, effectiveOn: '2026-11-09' },
  lastModifiedAt: '2026-10-09T15:00:00.000Z',
} };

function setup(outcome: object, projection: object = current) {
  const passports = { list: vi.fn(), detail: vi.fn() };
  const allowances = { get: vi.fn().mockResolvedValue(projection) };
  const commands = { create: vi.fn().mockResolvedValue(outcome), confirm: vi.fn().mockResolvedValue(outcome) };
  const history = { list: vi.fn().mockResolvedValue({ items: [{ sequence: 2, actorLabel: 'Administrador de New Talents' }], nextCursor: null }) };
  return { subject: new AdminAllowanceController(passports as never, allowances as never, commands as never, history as never),
    passports, allowances, commands, history };
}

describe('allowance update/history HTTP conflicts', () => {
  it('accepts the closed update shape, rejects an editable initial date, and delegates to versioned confirmation', async () => {
    const result = { outcome: 'applied', colombiaToday: '2026-10-09', configuration: current.configuration };
    const { subject, commands } = setup(result);
    await expect(subject.confirm(request, passportId, update)).resolves.toEqual({ configuration: current.configuration, colombiaToday: '2026-10-09' });
    expect(commands.confirm).toHaveBeenCalledWith({ passportId, administratorIdentityId: administratorId, ...update });
    for (const invalid of [{ ...update, expectedActivationDate: '2026-10-09' }, { ...update, startDate: '2026-10-09' },
      { ...update, extra: 1 }, { ...update, expectedVersion: -1 }]) {
      await expect(subject.confirm(request, passportId, invalid)).rejects.toMatchObject({ code: 'invalid' });
    }
  });

  it('maps every stale or changed-intention write to 409 with only a safe current projection', async () => {
    for (const [outcome, code] of [['conflict', 'conflict'], ['idempotency-conflict', 'idempotency-conflict']]) {
      const { subject, allowances } = setup({ outcome, current: { version: 2 } });
      const thrown = await subject.confirm(request, passportId, update).catch((error: unknown) => error);
      expect(thrown).toBeInstanceOf(AdminAllowanceHttpError);
      expect(thrown).toMatchObject({ code, current: { colombiaToday: '2026-10-09', configuration: { version: 2 } } });
      expect(JSON.stringify(thrown)).not.toContain(administratorId);
      expect(allowances.get).toHaveBeenCalledWith({ administratorId, passportId });
      const response = { status: vi.fn().mockReturnThis(), header: vi.fn().mockReturnThis(), json: vi.fn() };
      new AdminAllowanceExceptionFilter().catch(thrown, { switchToHttp: () => ({ getResponse: () => response }) } as never);
      expect(response.status).toHaveBeenCalledWith(409);
      expect(response.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(response.json).toHaveBeenCalledWith({ code: code === 'conflict' ? 'ALLOWANCE_CONFLICT' : 'IDEMPOTENCY_CONFLICT',
        message: expect.any(String), current: expect.objectContaining({ configuration: expect.objectContaining({ version: 2 }) }) });
    }
  });

  it('rejects Colombia activation-day rollover and ineligible passports without protected values', async () => {
    for (const [outcome, code] of [['activation-date-changed', 'activation-date-changed'], ['ineligible-passport', 'ineligible']]) {
      const { subject, allowances } = setup({ outcome });
      const command = outcome === 'activation-date-changed' ? { ...update, expectedVersion: 0, expectedActivationDate: '2026-10-08' } : update;
      await expect(subject.confirm(request, passportId, command)).rejects.toMatchObject({ code });
      expect(allowances.get).not.toHaveBeenCalled();
    }
  });

  it('makes missing and denied direct IDs identical and returns an authorized history page', async () => {
    const { subject, allowances, history } = setup({ outcome: 'not-found' }, { outcome: 'not-found' });
    await expect(subject.confirm(request, passportId, update)).rejects.toMatchObject({ code: 'not-found' });
    expect(allowances.get).not.toHaveBeenCalled();
    await expect(subject.allowanceHistory(request, passportId, { limit: '20' })).resolves.toEqual({ items: [{ sequence: 2, actorLabel: 'Administrador de New Talents' }], nextCursor: null });
    expect(history.list).toHaveBeenCalledWith({ administratorId, passportId, limit: 20 });
    history.list.mockResolvedValue({ outcome: 'not-found' });
    await expect(subject.allowanceHistory(request, passportId, {})).rejects.toMatchObject({ code: 'not-found' });
    expect(Reflect.getMetadata(PATH_METADATA, AdminAllowanceController.prototype.allowanceHistory)).toBe(':passportId/match-allowance/history');
    expect(Reflect.getMetadata(METHOD_METADATA, AdminAllowanceController.prototype.allowanceHistory)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(HEADERS_METADATA, AdminAllowanceController.prototype.allowanceHistory)).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
  });

  it('replays the accepted update with 200 without a second command intention', async () => {
    const { subject } = setup({ outcome: 'idempotent', colombiaToday: '2026-10-09', configuration: current.configuration });
    await expect(subject.confirm(request, passportId, update)).resolves.toMatchObject({ configuration: { version: 2 } });
  });
});
