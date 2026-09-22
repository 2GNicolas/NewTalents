import { describe, expect, it, vi } from 'vitest';

import { PassportTraceService } from './passport-trace.service.js';

const passportId = '44444444-4444-4444-8444-444444444444';
const actorIdentityId = '11111111-1111-4111-8111-111111111111';

describe('PassportTraceService', () => {
  it('records actor, action, outcome, prior state, and resulting state without session or passport input echoes', async () => {
    const createdAt = new Date('2026-09-16T00:00:00.000Z');
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'event-1', createdAt, ...data }));
    const transaction = { passportLifecycleEvent: { create } };
    const service = new PassportTraceService();

    await service.record(transaction as never, {
      passportId,
      actorIdentityId,
      action: 'SUBMITTED',
      outcome: 'APPLIED',
      priorState: 'DRAFT',
      resultingState: 'IN_REVIEW',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        passportId,
        actorIdentityId,
        action: 'SUBMITTED',
        outcome: 'APPLIED',
        priorState: 'DRAFT',
        resultingState: 'IN_REVIEW',
        details: {},
      },
    });
  });

  it('redacts identity-document values and candidate details while keeping only safe trace categories', async () => {
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'event-1', createdAt: new Date(), ...data }));
    const transaction = { passportLifecycleEvent: { create } };
    const service = new PassportTraceService();

    await service.record(transaction as never, {
      passportId,
      actorIdentityId,
      action: 'POSSIBLE_DUPLICATE_RESOLVED',
      outcome: 'APPLIED',
      priorState: 'IN_REVIEW',
      resultingState: 'IN_REVIEW',
      details: {
        documentNumber: 'ABC-123-456',
        documentType: 'CC',
        candidatePassportId: '99999999-9999-4999-8999-999999999999',
        nameDobFingerprint: 'f'.repeat(64),
        resolution: 'DIFFERENT_PLAYERS',
      },
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'POSSIBLE_DUPLICATE_RESOLVED',
        details: { resolution: 'DIFFERENT_PLAYERS' },
      }),
    });
    expect(JSON.stringify(create.mock.calls)).not.toContain('ABC-123-456');
    expect(JSON.stringify(create.mock.calls)).not.toContain('99999999-9999-4999-8999-999999999999');
    expect(JSON.stringify(create.mock.calls)).not.toContain('f'.repeat(64));
  });

  it('keeps a creator-safe correction reason in the redacted details', async () => {
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'event-1', createdAt: new Date(), ...data }));
    const transaction = { passportLifecycleEvent: { create } };
    const service = new PassportTraceService();

    await service.record(transaction as never, {
      passportId,
      actorIdentityId,
      action: 'RETURNED_FOR_CORRECTION',
      outcome: 'APPLIED',
      priorState: 'IN_REVIEW',
      resultingState: 'RETURNED_FOR_CORRECTION',
      details: { reason: 'Corrige la categoría declarada' },
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        details: { reason: 'Corrige la categoría declarada' },
      }),
    });
  });
});
