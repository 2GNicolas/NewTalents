import { RequestMethod } from '@nestjs/common';
import { HEADERS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';

import { FirstMatchController } from '../../src/first-match/http/first-match.controller.js';
import { parseCancelCommand, parseRescheduleCommand } from '../../src/first-match/http/first-match.dto.js';
import { FirstMatchExceptionFilter, FirstMatchHttpError } from '../../src/first-match/http/first-match-exception.filter.js';

const passportId = '22222222-2222-4222-8222-222222222222';
const actorIdentityId = '11111111-1111-4111-8111-111111111111';
const matchId = '44444444-4444-4444-8444-444444444444';
const request = { actor: { identityId: actorIdentityId, sessionId: 'session' } };
const mutation = { expectedVersion: 1, idempotencyKey: '33333333-3333-4333-8333-333333333333' };
const fields = { matchDate: '2026-10-18', matchTime: '10:00', opponent: 'Rival', competition: 'Liga', venue: 'Cancha' };

function setup(outcome: object = { outcome: 'applied', matchId }) {
  const flow = { passportId, state: 'WAITING', allowedActions: ['RESCHEDULE', 'CANCEL'] };
  const query = { get: vi.fn().mockResolvedValue({ outcome: 'ok', flow }), preview: vi.fn() };
  const command = { schedule: vi.fn(), reschedule: vi.fn().mockResolvedValue(outcome), cancel: vi.fn().mockResolvedValue(outcome) };
  return { subject: new FirstMatchController(query as never, command as never), query, command, flow };
}

describe('Feature 009 correction HTTP contract', () => {
  it('registers versioned correction routes with no-store', () => {
    for (const [handler, path, method] of [
      [FirstMatchController.prototype.reschedule, ':matchId', RequestMethod.PUT],
      [FirstMatchController.prototype.cancel, ':matchId/cancel', RequestMethod.POST],
    ] as const) {
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
      expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
    }
  });

  it('requires closed versioned payloads and bounded valid fields', () => {
    expect(parseRescheduleCommand({ ...mutation, ...fields })).toEqual({ ok: true, value: { ...mutation, ...fields } });
    expect(parseCancelCommand(mutation)).toEqual({ ok: true, value: mutation });
    for (const bad of [
      { ...mutation, ...fields, expectedVersion: 0 }, { ...mutation, ...fields, matchDate: '2026-02-30' },
      { ...mutation, ...fields, matchTime: '24:00' }, { ...mutation, ...fields, opponent: ' ' },
      { ...mutation, ...fields, competition: 'x'.repeat(161) }, { ...mutation, ...fields, extra: true },
    ]) expect(parseRescheduleCommand(bad)).toEqual({ ok: false });
    for (const bad of [{ ...mutation, expectedVersion: -1 }, { ...mutation, extra: true },
      { ...mutation, idempotencyKey: 'bad' }]) expect(parseCancelCommand(bad)).toEqual({ ok: false });
  });

  it('delegates corrections and returns the refreshed authorized flow', async () => {
    const { subject, command, query, flow } = setup();
    await expect(subject.reschedule(request, passportId, matchId, { ...mutation, ...fields })).resolves.toEqual(flow);
    await expect(subject.cancel(request, passportId, matchId, mutation)).resolves.toEqual(flow);
    expect(command.reschedule).toHaveBeenCalledWith({ passportId, matchId, actorIdentityId, ...mutation, ...fields });
    expect(command.cancel).toHaveBeenCalledWith({ passportId, matchId, actorIdentityId, ...mutation });
    expect(query.get).toHaveBeenCalledTimes(2);
  });

  it('hides foreign IDs and maps post-load, stale, invalid and unavailable results safely', async () => {
    for (const [outcome, status, code] of [
      ['not-found', 404, 'FIRST_MATCH_NOT_FOUND'], ['conflict', 409, 'FIRST_MATCH_CONFLICT'],
      ['invalid', 422, 'INVALID_MATCH'], ['allowance-full', 422, 'ALLOWANCE_FULL'],
      ['no-allowance', 422, 'NO_ALLOWANCE'], ['unavailable', 503, 'FIRST_MATCH_UNAVAILABLE'],
    ] as const) {
      const { subject } = setup({ outcome });
      for (const action of [() => subject.reschedule(request, passportId, matchId, { ...mutation, ...fields }),
        () => subject.cancel(request, passportId, matchId, mutation)]) {
        const error = await action().catch((reason: unknown) => reason);
        expect(error).toBeInstanceOf(FirstMatchHttpError);
        const response = { status: vi.fn().mockReturnThis(), header: vi.fn().mockReturnThis(), json: vi.fn() };
        new FirstMatchExceptionFilter().catch(error as FirstMatchHttpError,
          { switchToHttp: () => ({ getResponse: () => response }) } as never);
        expect(response.status).toHaveBeenCalledWith(status);
        expect(response.json).toHaveBeenCalledWith({ code, message: expect.any(String) });
        expect(JSON.stringify(response.json.mock.calls)).not.toContain(actorIdentityId);
      }
    }
    const { subject } = setup();
    await expect(subject.cancel(request, passportId, 'bad', mutation)).rejects.toMatchObject({ outcome: 'not-found' });
    await expect(subject.reschedule(request, passportId, matchId, { ...mutation, ...fields, venue: '' }))
      .rejects.toMatchObject({ outcome: 'invalid' });
  });
});
