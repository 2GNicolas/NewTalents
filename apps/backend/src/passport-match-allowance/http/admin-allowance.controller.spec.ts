import { HEADERS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ForbiddenException, RequestMethod } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AdminAllowanceController } from './admin-allowance.controller.js';
import { AdminAllowanceHttpError, AdminAllowanceExceptionFilter } from './admin-allowance-exception.filter.js';

const administratorId = '11111111-1111-4111-8111-111111111111';
const passportId = '22222222-2222-4222-8222-222222222222';
const idempotencyKey = '33333333-3333-4333-8333-333333333333';
const request = { actor: { identityId: administratorId, sessionId: 'session' } };
const body = { expectedVersion: 0, idempotencyKey, cadence: 'MONTHLY', matchLimit: 4, expectedActivationDate: '2026-10-09' };
const card = { passportId, playerLabel: 'Jugador Uno', maskedReference: 'PAS-••••-2222', lifecycleState: 'ACTIVE', canConfigure: true, detailPath: `/admin/passports/${passportId}` };
const projection = { passportId, canConfigure: true, colombiaToday: '2026-10-09', configuration: null };

function setup(overrides: { passports?: object; allowance?: object; command?: object } = {}) {
  const passports = (overrides.passports ?? { list: vi.fn().mockResolvedValue({ items: [card], nextCursor: 'cursor' }), detail: vi.fn().mockResolvedValue(card) }) as { list: ReturnType<typeof vi.fn>; detail: ReturnType<typeof vi.fn> };
  const allowance = (overrides.allowance ?? { get: vi.fn().mockResolvedValue(projection) }) as { get: ReturnType<typeof vi.fn> };
  const command = (overrides.command ?? { create: vi.fn().mockResolvedValue({ outcome: 'applied', colombiaToday: '2026-10-09', configuration: {
    version: 1, activatedOn: '2026-10-09', currentRule: { cadence: 'MONTHLY', matchLimit: 4, effectiveOn: '2026-10-09' },
    currentPeriod: { start: '2026-10-09', endExclusive: '2026-11-09' }, pendingRule: null, lastModifiedAt: '2026-10-09T05:01:00.000Z',
  } }) }) as { create: ReturnType<typeof vi.fn> };
  return { subject: new AdminAllowanceController(passports as never, allowance as never, command as never), passports, allowance, command };
}

describe('Administrator allowance HTTP first slice', () => {
  it('registers exactly the four first-slice operations under an isolated route with no-store', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdminAllowanceController)).toBe('admin/passports');
    const routes = [
      [AdminAllowanceController.prototype.list, '/', RequestMethod.GET],
      [AdminAllowanceController.prototype.detail, ':passportId', RequestMethod.GET],
      [AdminAllowanceController.prototype.allowance, ':passportId/match-allowance', RequestMethod.GET],
      [AdminAllowanceController.prototype.confirm, ':passportId/match-allowance', RequestMethod.PUT],
    ] as const;
    for (const [handler, path, method] of routes) {
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
      expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
    }
  });

  it('lists bounded all-passport cards and composes safe detail/allowance projections', async () => {
    const { subject, passports, allowance } = setup();
    await expect(subject.list(request, { limit: '20' })).resolves.toMatchObject({ items: [{ id: passportId, state: 'ACTIVE', playerLabel: 'Jugador Uno' }], nextCursor: 'cursor' });
    expect(passports.list).toHaveBeenCalledWith({ administratorId, limit: 20 });
    await expect(subject.detail(request, passportId)).resolves.toMatchObject({ passport: { id: passportId }, allowance: { configuration: null, colombiaToday: '2026-10-09' } });
    await expect(subject.allowance(request, passportId)).resolves.toEqual({ configuration: null, colombiaToday: '2026-10-09' });
    expect(allowance.get).toHaveBeenCalledWith({ administratorId, passportId });
  });

  it('rejects closed-input violations and maps denied or missing direct IDs safely', async () => {
    const { subject } = setup();
    for (const query of [{ limit: '51' }, { limit: '0' }, { limit: '1.5' }, { extra: 'x' }]) {
      await expect(subject.list(request, query)).rejects.toMatchObject({ code: 'invalid' });
    }
    for (const invalid of [{ ...body, startDate: '2026-10-09' }, { ...body, matchLimit: 0 }, { ...body, matchLimit: 1.5 },
      { ...body, matchLimit: Number.MAX_SAFE_INTEGER + 1 }, { ...body, expectedActivationDate: '2026-02-30' }, { ...body, cadence: 'WEEKLY' }]) {
      await expect(subject.confirm(request, passportId, invalid)).rejects.toMatchObject({ code: 'invalid' });
    }
    await expect(subject.detail(request, 'bad-id')).rejects.toMatchObject({ code: 'not-found' });
    const denied = setup({ passports: { list: vi.fn().mockResolvedValue({ outcome: 'denied' }), detail: vi.fn().mockResolvedValue({ outcome: 'not-found' }) } }).subject;
    await expect(denied.list(request, {})).rejects.toMatchObject({ code: 'denied' });
    await expect(denied.detail(request, passportId)).rejects.toMatchObject({ code: 'not-found' });
  });

  it('confirms only a closed first-create command and returns the stored projection on replay', async () => {
    const command = { create: vi.fn().mockResolvedValue({ outcome: 'idempotent', colombiaToday: '2026-10-09', configuration: { version: 1 } }) };
    const { subject } = setup({ command });
    await expect(subject.confirm(request, passportId, body)).resolves.toEqual({ configuration: { version: 1 }, colombiaToday: '2026-10-09' });
    expect(command.create).toHaveBeenCalledWith({ passportId, administratorIdentityId: administratorId, ...body });
  });

  it('maps safe 404/409/422/503 errors and no-store error envelopes', async () => {
    for (const [outcome, code] of [
      ['not-found', 'not-found'], ['conflict', 'conflict'], ['idempotency-conflict', 'idempotency-conflict'],
      ['activation-date-changed', 'activation-date-changed'], ['ineligible-passport', 'ineligible'],
      ['invalid', 'invalid'], ['unavailable', 'unavailable'],
    ]) {
      const { subject } = setup({ command: { create: vi.fn().mockResolvedValue({ outcome }) } });
      await expect(subject.confirm(request, passportId, body)).rejects.toMatchObject({ code });
    }
    const response = { status: vi.fn().mockReturnThis(), header: vi.fn().mockReturnThis(), json: vi.fn() };
    const host = { switchToHttp: () => ({ getResponse: () => response }) };
    new AdminAllowanceExceptionFilter().catch(new AdminAllowanceHttpError('conflict'), host as never);
    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.json).toHaveBeenCalledWith({ code: 'ALLOWANCE_CONFLICT', message: expect.any(String) });
    new AdminAllowanceExceptionFilter().catch(new ForbiddenException(), host as never);
    expect(response.status).toHaveBeenLastCalledWith(403);
    expect(response.json).toHaveBeenLastCalledWith({ code: 'ACCESS_DENIED', message: 'Access denied' });
  });
});
