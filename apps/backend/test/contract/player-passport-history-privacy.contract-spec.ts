import { describe, expect, it, vi } from 'vitest';

import { PassportController } from '../../src/player-passport/http/passport.controller.js';

const passportId = '11111111-1111-4111-8111-111111111111';
const ownerId = '22222222-2222-4222-8222-222222222222';
const analystId = '33333333-3333-4333-8333-333333333333';

function response() {
  return {
    setHeader: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  };
}

function controller() {
  const passport = {
    id: passportId,
    playerId: '44444444-4444-4444-8444-444444444444',
    state: 'IN_REVIEW',
    originKind: 'PARTICULAR',
    position: 'Defensa',
    ageCategory: 'Sub-17',
    city: 'Bogotá',
    country: 'Colombia',
    dominantFoot: 'RIGHT',
    createdByIdentityId: ownerId,
    originAcademyId: null,
    version: 1,
    createdAt: new Date('2026-09-20T12:00:00Z'),
    updatedAt: new Date('2026-09-20T12:00:00Z'),
  };
  const events = [
    {
      id: '55555555-5555-4555-8555-555555555555',
      action: 'CREATED',
      outcome: 'APPLIED',
      actorIdentityId: ownerId,
      priorState: null,
      resultingState: 'DRAFT',
      details: { documentNumber: 'protected' },
      createdAt: new Date('2026-09-20T12:00:00Z'),
    },
    {
      id: '66666666-6666-4666-8666-666666666666',
      action: 'POSSIBLE_DUPLICATE_RESOLVED',
      outcome: 'APPLIED',
      actorIdentityId: analystId,
      priorState: 'IN_REVIEW',
      resultingState: 'IN_REVIEW',
      details: {
        resolution: 'DIFFERENT_PLAYERS',
        candidateIdentityId: '77777777-7777-4777-8777-777777777777',
        documentFingerprint: 'protected-fingerprint',
        matchingReason: 'same-name-and-date',
        workflowDetails: 'protected-workflow',
      },
      createdAt: new Date('2026-09-20T13:00:00Z'),
    },
  ];
  const prisma = {
    playerPassport: { findUnique: vi.fn().mockResolvedValue(passport) },
    passportLifecycleEvent: { findMany: vi.fn().mockResolvedValue(events) },
  };
  const authorization = {
    authorize: vi.fn(async ({ identityId, permission }: { identityId: string; permission: string }) => ({
      allowed: identityId === ownerId
        ? permission === 'passport.history.particular'
        : permission === 'passport.history.internal',
    })),
  };
  return new PassportController(
    prisma as never,
    authorization as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('passport history privacy HTTP contract', () => {
  it('omits duplicate detection, resolution and every protected detail from ordinary history', async () => {
    const result = await controller().history({ actor: { identityId: ownerId } } as never, passportId, response());
    expect(result).toEqual({
      passportId,
      events: [expect.objectContaining({ action: 'CREATED', outcome: 'SUCCEEDED' })],
    });
    const serialized = JSON.stringify(result);
    for (const forbidden of ['POSSIBLE_DUPLICATE', 'candidate', 'fingerprint', 'document', 'matchingReason', 'workflow']) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it('retains immutable event identity and redacted resolution only for authorized internal audit', async () => {
    const result = await controller().internalHistory({ actor: { identityId: analystId } } as never, passportId, response());
    expect('events' in result).toBe(true);
    if (!('events' in result)) throw new Error('expected internal history projection');
    expect(result.events[1]).toMatchObject({
      eventId: '66666666-6666-4666-8666-666666666666',
      action: 'POSSIBLE_DUPLICATE_RESOLVED',
      safeInternalResult: 'DIFFERENT_PLAYERS',
      actorIdentityId: analystId,
      previousState: 'IN_REVIEW',
      resultingState: 'IN_REVIEW',
    });
    expect(JSON.stringify(result)).not.toMatch(/candidateIdentityId|documentFingerprint|matchingReason|workflowDetails|protected-/);
  });
});
