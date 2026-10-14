import { RequestMethod } from '@nestjs/common';
import { HEADERS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';

import { FirstMatchController } from '../../src/first-match/http/first-match.controller.js';
import { parseScheduleCommand, parseMatchDate, validPassportId } from '../../src/first-match/http/first-match.dto.js';
import { FirstMatchExceptionFilter, FirstMatchHttpError } from '../../src/first-match/http/first-match-exception.filter.js';

const passportId = '22222222-2222-4222-8222-222222222222';
const actorIdentityId = '11111111-1111-4111-8111-111111111111';
const request = { actor: { identityId: actorIdentityId, sessionId: 'session' } };
const body = {
  expectedVersion: 0, idempotencyKey: '33333333-3333-4333-8333-333333333333',
  matchDate: '2026-10-18', matchTime: '10:00', opponent: 'Academia Norte',
  competition: 'Liga de formacion', venue: 'Cancha Norte',
};
const flow = { passportId, state: 'INVITATION', allowedActions: ['SCHEDULE'] };

function setup(commandOutcome: object = { outcome: 'applied', matchId: '44444444-4444-4444-8444-444444444444' },
  readOutcome: object = { outcome: 'ok', flow }) {
  const query = { get: vi.fn().mockResolvedValue(readOutcome), preview: vi.fn().mockResolvedValue({ outcome: 'ok', availability: {
    configured: true, matchDate: body.matchDate, periodStart: '2026-10-09', periodEndExclusive: '2026-11-09',
    cadence: 'MONTHLY', limit: 4, reserved: 0, used: 0, available: 4,
  } }) };
  const command = { schedule: vi.fn().mockResolvedValue(commandOutcome) };
  return { subject: new FirstMatchController(query as never, command as never), query, command };
}

describe('Feature 009 first-match HTTP contract', () => {
  it('registers only flow, date preview and scheduling with no-store responses', () => {
    expect(Reflect.getMetadata(PATH_METADATA, FirstMatchController)).toBe('passports/:passportId/first-match');
    for (const [handler, path, method] of [
      [FirstMatchController.prototype.get, '/', RequestMethod.GET],
      [FirstMatchController.prototype.preview, 'allowance', RequestMethod.GET],
      [FirstMatchController.prototype.schedule, '/', RequestMethod.POST],
    ] as const) {
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
      expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
    }
    expect(validPassportId(passportId)).toBe(true);
    expect(validPassportId('bad')).toBe(false);
  });

  it('accepts only the closed versioned form and real Colombia date/time values', () => {
    expect(parseScheduleCommand(body)).toEqual({ ok: true, value: body });
    expect(parseMatchDate('2026-02-28')).toBe('2026-02-28');
    for (const invalid of [
      { ...body, matchDate: '2026-02-30' }, { ...body, matchTime: '24:00' },
      { ...body, opponent: ' ' }, { ...body, venue: 'x'.repeat(161) },
      { ...body, expectedVersion: 1 }, { ...body, extra: true },
      { ...body, idempotencyKey: 'not-a-key' },
    ]) expect(parseScheduleCommand(invalid)).toEqual({ ok: false });
    expect(parseMatchDate('2026-02-30')).toBeNull();
  });

  it('delegates authorized reads and scheduling without leaking internal fields', async () => {
    const { subject, command, query } = setup();
    await expect(subject.get(request, passportId)).resolves.toEqual(flow);
    await expect(subject.preview(request, passportId, body.matchDate)).resolves.toMatchObject({
      configured: true, reserved: 0, used: 0, available: 4,
    });
    await expect(subject.schedule(request, passportId, body)).resolves.toEqual(flow);
    expect(command.schedule).toHaveBeenCalledWith({ ...body, passportId, actorIdentityId });
    expect(query.get).toHaveBeenCalledWith({ passportId, actorIdentityId });
    expect(JSON.stringify(flow)).not.toMatch(/scheduledByIdentityId|loadedByAnalystIdentityId|playerId|evidence/);
  });

  it('maps missing/unauthorized IDs identically and returns safe refreshable conflicts', async () => {
    for (const [outcome, status, code] of [
      ['not-found', 404, 'FIRST_MATCH_NOT_FOUND'], ['conflict', 409, 'FIRST_MATCH_CONFLICT'],
      ['invalid', 422, 'INVALID_MATCH'], ['no-allowance', 422, 'NO_ALLOWANCE'],
      ['allowance-full', 422, 'ALLOWANCE_FULL'], ['ineligible', 422, 'PASSPORT_INELIGIBLE'],
      ['unavailable', 503, 'FIRST_MATCH_UNAVAILABLE'],
    ] as const) {
      const { subject } = setup({ outcome });
      const error = await subject.schedule(request, passportId, body).catch((reason: unknown) => reason);
      expect(error).toBeInstanceOf(FirstMatchHttpError);
      if (!(error instanceof FirstMatchHttpError)) throw new Error('Expected first-match HTTP error');
      const response = { status: vi.fn().mockReturnThis(), header: vi.fn().mockReturnThis(), json: vi.fn() };
      new FirstMatchExceptionFilter().catch(error, { switchToHttp: () => ({ getResponse: () => response }) } as never);
      expect(response.status).toHaveBeenCalledWith(status);
      expect(response.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(response.json).toHaveBeenCalledWith({ code, message: expect.any(String) });
      expect(JSON.stringify(response.json.mock.calls)).not.toContain(actorIdentityId);
    }
    const { subject } = setup();
    await expect(subject.get(request, 'bad-id')).rejects.toMatchObject({ outcome: 'not-found' });
    await expect(subject.schedule(request, passportId, { ...body, matchDate: '2026-02-30' })).rejects.toMatchObject({ outcome: 'invalid' });
  });
});
