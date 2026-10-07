import { HEADERS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { PassportCustodyController } from './passport-custody.controller.js';
import { PassportCustodyHttpError } from './passport-custody-exception.filter.js';

const administratorId = '11111111-1111-4111-8111-111111111111';
const passportId = '22222222-2222-4222-8222-222222222222';
const analystId = '33333333-3333-4333-8333-333333333333';
const request = { actor: { identityId: administratorId, sessionId: 'session-1' } };

const allowed = { allowed: true as const, policyVersion: '1' as const };
const denied = { allowed: false as const, reason: 'no-active-role' as const, policyVersion: '1' as const };

function controller(overrides: Readonly<{ query?: object; command?: object; authorization?: object }> = {}) {
  return new PassportCustodyController(
    (overrides.query ?? {
      listAnalysts: vi.fn().mockResolvedValue({ items: [{ identityId: analystId, displayLabel: 'Analista A', activeCustodyCount: 2 }] }),
      listPassports: vi.fn().mockResolvedValue({ items: [{ passportId }] }),
    }) as never,
    (overrides.command ?? { assign: vi.fn().mockResolvedValue({ outcome: 'applied', passportId, eventId: 'event-1', custody: { state: 'ASSIGNED', version: 1, analystIdentityId: analystId, assignedAt: '2026-09-30T16:00:00.000Z' } }) }) as never,
    (overrides.authorization ?? { authorizeAdministrator: vi.fn().mockResolvedValue(allowed) }) as never,
  );
}

describe('PassportCustodyController initial assignment API', () => {
  it('exposes the three US2 routes with no-store responses', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PassportCustodyController)).toBe('admin/passport-custody');
    expect(Reflect.getMetadata(PATH_METADATA, PassportCustodyController.prototype.analysts)).toBe('analysts');
    expect(Reflect.getMetadata(METHOD_METADATA, PassportCustodyController.prototype.analysts)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, PassportCustodyController.prototype.passports)).toBe('passports');
    expect(Reflect.getMetadata(PATH_METADATA, PassportCustodyController.prototype.assign)).toBe('passports/:passportId/assign');
    expect(Reflect.getMetadata(METHOD_METADATA, PassportCustodyController.prototype.assign)).toBe(RequestMethod.POST);
    for (const handler of [PassportCustodyController.prototype.analysts, PassportCustodyController.prototype.passports, PassportCustodyController.prototype.assign]) {
      expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
    }
  });

  it('lists authorized Analysts and passports with closed stable pagination queries', async () => {
    const query = {
      listAnalysts: vi.fn().mockResolvedValue({ items: [{ identityId: analystId, displayLabel: 'Analista A', activeCustodyCount: 2 }], nextCursor: 'next-a' }),
      listPassports: vi.fn().mockResolvedValue({ items: [{ passportId }], nextCursor: 'next-p' }),
    };
    const authorization = { authorizeAdministrator: vi.fn().mockResolvedValue(allowed) };
    const subject = controller({ query, authorization });

    await expect(subject.analysts(request, { query: 'ana', limit: '10' })).resolves.toEqual({ data: [{ identityId: analystId, displayLabel: 'Analista A', activeCustodyCount: 2 }], pagination: { hasMore: true, nextCursor: 'next-a' } });
    await expect(subject.passports(request, { assignment: 'UNASSIGNED', analystId, limit: '20' })).resolves.toEqual({ data: [{ passportId }], pagination: { hasMore: true, nextCursor: 'next-p' } });
    expect(authorization.authorizeAdministrator).toHaveBeenCalledWith(administratorId, 'passport.custody.list-analysts');
    expect(authorization.authorizeAdministrator).toHaveBeenCalledWith(administratorId, 'passport.custody.list');
    await expect(subject.analysts(request, { unexpected: 'value' })).rejects.toMatchObject({ code: 'validation' });
    await expect(subject.passports(request, { limit: '51' })).rejects.toMatchObject({ code: 'validation' });
  });

  it('denies collections without querying protected rows', async () => {
    const query = { listAnalysts: vi.fn(), listPassports: vi.fn() };
    const subject = controller({ query, authorization: { authorizeAdministrator: vi.fn().mockResolvedValue(denied) } });
    await expect(subject.analysts(request, {})).rejects.toMatchObject({ code: 'forbidden' });
    await expect(subject.passports(request, {})).rejects.toMatchObject({ code: 'forbidden' });
    expect(query.listAnalysts).not.toHaveBeenCalled();
    expect(query.listPassports).not.toHaveBeenCalled();
  });

  it('accepts only a closed assignment command and returns applied or idempotent current custody', async () => {
    const command = { assign: vi.fn().mockResolvedValue({ outcome: 'idempotent', passportId, eventId: 'event-1', custody: { state: 'ASSIGNED', version: 1, analystIdentityId: analystId, assignedAt: '2026-09-30T16:00:00.000Z' } }) };
    const subject = controller({ command });
    const body = { expectedVersion: 0, idempotencyKey: '44444444-4444-4444-8444-444444444444', analystIdentityId: analystId };

    await expect(subject.assign(request, passportId, body)).resolves.toEqual({ data: { passportId, eventId: 'event-1', custody: { state: 'ASSIGNED', version: 1, analystIdentityId: analystId, assignedAt: '2026-09-30T16:00:00.000Z' } }, idempotent: true });
    expect(command.assign).toHaveBeenCalledWith({ passportId, administratorIdentityId: administratorId, ...body });
    for (const invalid of [{ ...body, extra: true }, { ...body, expectedVersion: -1 }, { ...body, reason: 'No permitido' }, { ...body, analystIdentityId: 'not-uuid' }]) {
      await expect(subject.assign(request, passportId, invalid)).rejects.toMatchObject({ code: 'validation' });
    }
  });

  it('maps safe missing/denied, stale or ineligible state, invalid command, and storage failure', async () => {
    await expect(controller({ authorization: { authorizeAdministrator: vi.fn().mockResolvedValue(denied) } }).assign(request, passportId, validBody())).rejects.toMatchObject({ code: 'not-found' });
    for (const outcome of ['conflict', 'ineligible-passport', 'ineligible-analyst']) {
      await expect(controller({ command: { assign: vi.fn().mockResolvedValue({ outcome }) } }).assign(request, passportId, validBody())).rejects.toMatchObject({ code: 'conflict' });
    }
    await expect(controller({ command: { assign: vi.fn().mockResolvedValue({ outcome: 'idempotency-conflict' }) } }).assign(request, passportId, validBody())).rejects.toMatchObject({ code: 'idempotency-conflict' });
    await expect(controller({ command: { assign: vi.fn().mockResolvedValue({ outcome: 'not-found' }) } }).assign(request, passportId, validBody())).rejects.toMatchObject({ code: 'not-found' });
    await expect(controller({ command: { assign: vi.fn().mockResolvedValue({ outcome: 'invalid' }) } }).assign(request, passportId, validBody())).rejects.toMatchObject({ code: 'validation' });
    await expect(controller({ command: { assign: vi.fn().mockResolvedValue({ outcome: 'unavailable' }) } }).assign(request, passportId, validBody())).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('uses a privacy-minimum error type', () => {
    expect(new PassportCustodyHttpError('not-found')).toMatchObject({ code: 'not-found', message: 'not-found' });
  });
});

function validBody() {
  return { expectedVersion: 0, idempotencyKey: '44444444-4444-4444-8444-444444444444', analystIdentityId: analystId };
}
