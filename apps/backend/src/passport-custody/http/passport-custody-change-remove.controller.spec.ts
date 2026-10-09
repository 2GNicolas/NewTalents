import { HEADERS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { PassportCustodyController } from './passport-custody.controller.js';

const administratorId = '11111111-1111-4111-8111-111111111111';
const passportId = '22222222-2222-4222-8222-222222222222';
const analystId = '33333333-3333-4333-8333-333333333333';
const idempotencyKey = '44444444-4444-4444-8444-444444444444';
const request = { actor: { identityId: administratorId, sessionId: 'session-1' } };
const allowed = { allowed: true as const, policyVersion: '1' as const };
const denied = { allowed: false as const, reason: 'no-active-role' as const, policyVersion: '1' as const };

function controller(command: object, authorization: object = { authorizeAdministrator: vi.fn().mockResolvedValue(allowed) }) {
  return new PassportCustodyController({} as never, command as never, authorization as never);
}

describe('PassportCustodyController change/remove API', () => {
  it('exposes POST change/remove with no-store and no DELETE semantics', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PassportCustodyController.prototype.change)).toBe('passports/:passportId/change');
    expect(Reflect.getMetadata(METHOD_METADATA, PassportCustodyController.prototype.change)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(PATH_METADATA, PassportCustodyController.prototype.remove)).toBe('passports/:passportId/remove');
    expect(Reflect.getMetadata(METHOD_METADATA, PassportCustodyController.prototype.remove)).toBe(RequestMethod.POST);
    for (const handler of [PassportCustodyController.prototype.change, PassportCustodyController.prototype.remove]) {
      expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
    }
  });

  it('dispatches closed change/remove bodies through action-specific capabilities', async () => {
    const command = {
      change: vi.fn().mockResolvedValue({ outcome: 'applied', passportId, eventId: 'event-change', custody: { state: 'ASSIGNED', version: 2, analystIdentityId: analystId, assignedAt: '2026-10-01T10:00:00.000Z' } }),
      remove: vi.fn().mockResolvedValue({ outcome: 'applied', passportId, eventId: 'event-remove', custody: { state: 'UNASSIGNED', version: 3 } }),
    };
    const authorization = { authorizeAdministrator: vi.fn().mockResolvedValue(allowed) };
    const subject = controller(command, authorization);
    const changeBody = { expectedVersion: 1, idempotencyKey, reason: 'Cambio operativo', analystIdentityId: analystId };
    const removeBody = { expectedVersion: 2, idempotencyKey, reason: 'Retiro operativo' };

    await expect(subject.change(request, passportId, changeBody)).resolves.toMatchObject({ data: { eventId: 'event-change', custody: { state: 'ASSIGNED', version: 2 } }, idempotent: false });
    await expect(subject.remove(request, passportId, removeBody)).resolves.toMatchObject({ data: { eventId: 'event-remove', custody: { state: 'UNASSIGNED', version: 3 } }, idempotent: false });
    expect(authorization.authorizeAdministrator).toHaveBeenCalledWith(administratorId, 'passport.custody.change');
    expect(authorization.authorizeAdministrator).toHaveBeenCalledWith(administratorId, 'passport.custody.remove');
    expect(command.change).toHaveBeenCalledWith({ passportId, administratorIdentityId: administratorId, ...changeBody });
    expect(command.remove).toHaveBeenCalledWith({ passportId, administratorIdentityId: administratorId, ...removeBody });

    await expect(subject.change(request, passportId, { ...changeBody, extra: true })).rejects.toMatchObject({ code: 'validation' });
    await expect(subject.remove(request, passportId, { ...removeBody, analystIdentityId: analystId })).rejects.toMatchObject({ code: 'validation' });
  });

  it('makes denied and missing resources indistinguishable and performs no command when denied', async () => {
    const deniedCommands = { change: vi.fn(), remove: vi.fn() };
    const deniedSubject = controller(deniedCommands, { authorizeAdministrator: vi.fn().mockResolvedValue(denied) });
    await expect(deniedSubject.change(request, passportId, validChange())).rejects.toMatchObject({ code: 'not-found' });
    await expect(deniedSubject.remove(request, passportId, validRemove())).rejects.toMatchObject({ code: 'not-found' });
    expect(deniedCommands.change).not.toHaveBeenCalled();
    expect(deniedCommands.remove).not.toHaveBeenCalled();

    const missingSubject = controller({ change: vi.fn().mockResolvedValue({ outcome: 'not-found' }), remove: vi.fn().mockResolvedValue({ outcome: 'not-found' }) });
    await expect(missingSubject.change(request, passportId, validChange())).rejects.toMatchObject({ code: 'not-found' });
    await expect(missingSubject.remove(request, passportId, validRemove())).rejects.toMatchObject({ code: 'not-found' });
  });

  it('preserves the prior state behind safe conflicts and maps invalid/unavailable outcomes', async () => {
    for (const outcome of ['conflict', 'ineligible-passport', 'ineligible-analyst']) {
      const subject = controller({ change: vi.fn().mockResolvedValue({ outcome }), remove: vi.fn().mockResolvedValue({ outcome }) });
      await expect(subject.change(request, passportId, validChange())).rejects.toMatchObject({ code: 'conflict' });
      await expect(subject.remove(request, passportId, validRemove())).rejects.toMatchObject({ code: 'conflict' });
    }
    const idempotency = controller({ change: vi.fn().mockResolvedValue({ outcome: 'idempotency-conflict' }), remove: vi.fn().mockResolvedValue({ outcome: 'idempotency-conflict' }) });
    await expect(idempotency.change(request, passportId, validChange())).rejects.toMatchObject({ code: 'idempotency-conflict' });
    await expect(idempotency.remove(request, passportId, validRemove())).rejects.toMatchObject({ code: 'idempotency-conflict' });
    for (const outcome of ['invalid', 'unavailable'] as const) {
      const subject = controller({ change: vi.fn().mockResolvedValue({ outcome }), remove: vi.fn().mockResolvedValue({ outcome }) });
      await expect(subject.change(request, passportId, validChange())).rejects.toMatchObject({ code: outcome === 'invalid' ? 'validation' : 'unavailable' });
      await expect(subject.remove(request, passportId, validRemove())).rejects.toMatchObject({ code: outcome === 'invalid' ? 'validation' : 'unavailable' });
    }
  });
});

function validChange() { return { expectedVersion: 1, idempotencyKey, reason: 'Cambio operativo', analystIdentityId: analystId }; }
function validRemove() { return { expectedVersion: 1, idempotencyKey, reason: 'Retiro operativo' }; }
