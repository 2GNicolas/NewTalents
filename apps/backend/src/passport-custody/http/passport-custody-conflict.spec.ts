import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { PassportCustodyController } from './passport-custody.controller.js';
import { PassportCustodyExceptionFilter, PassportCustodyHttpError } from './passport-custody-exception.filter.js';

const administratorId = '11111111-1111-4111-8111-111111111111';
const passportId = '22222222-2222-4222-8222-222222222222';
const analystId = '33333333-3333-4333-8333-333333333333';
const request = { actor: { identityId: administratorId, sessionId: 'session' } };
const body = { expectedVersion: 0, idempotencyKey: '44444444-4444-4444-8444-444444444444', analystIdentityId: analystId };
const current = { state: 'ASSIGNED' as const, version: 1, analystIdentityId: analystId, assignedAt: '2026-10-01T10:00:00.000Z' };

describe('passport custody conflict envelopes', () => {
  it.each([
    ['conflict', 'CUSTODY_CONFLICT'],
    ['idempotency-conflict', 'IDEMPOTENCY_CONFLICT'],
  ] as const)('returns a safe %s envelope with only minimum current state', async (outcome, code) => {
    const subject = controller({ assign: vi.fn().mockResolvedValue({ outcome, current }) });
    const error = await subject.assign(request, passportId, body).catch((value: unknown) => value);
    const response = filter(error);
    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({ code, message: expect.any(String), current });
    expect(JSON.stringify(response.json.mock.calls)).not.toContain(administratorId);
  });

  it('keeps denied and missing resources indistinguishable without current authority', async () => {
    const denied = controller({ assign: vi.fn() }, { allowed: false, reason: 'no-active-role', policyVersion: '1' });
    const missing = controller({ assign: vi.fn().mockResolvedValue({ outcome: 'not-found' }) });
    const deniedResponse = filter(await denied.assign(request, passportId, body).catch((value: unknown) => value));
    const missingResponse = filter(await missing.assign(request, passportId, body).catch((value: unknown) => value));
    expect(deniedResponse.status).toHaveBeenCalledWith(404);
    expect(missingResponse.status).toHaveBeenCalledWith(404);
    expect(deniedResponse.json.mock.calls[0]?.[0]).toEqual(missingResponse.json.mock.calls[0]?.[0]);
    expect(deniedResponse.json.mock.calls[0]?.[0]).not.toHaveProperty('current');
  });
});

function controller(command: object, decision: object = { allowed: true, policyVersion: '1' }) {
  return new PassportCustodyController({} as never, command as never, { authorizeAdministrator: vi.fn().mockResolvedValue(decision) } as never);
}

function filter(error: unknown) {
  expect(error).toBeInstanceOf(PassportCustodyHttpError);
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const host = { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;
  new PassportCustodyExceptionFilter().catch(error, host);
  return response;
}
