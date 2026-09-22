import { describe, expect, it, vi } from 'vitest';

import { PassportTransitionService } from './passport-transition.service.js';

const passportId = '44444444-4444-4444-8444-444444444444';
const actorIdentityId = '11111111-1111-4111-8111-111111111111';
const analystIdentityId = '55555555-5555-4555-8555-555555555555';

describe('PassportTransitionService', () => {
  it('edits profile fields only in editable states and records an EDITED trace without changing state', async () => {
    const transaction = {
      playerPassport: {
        findFirst: vi.fn().mockResolvedValue({ id: passportId, playerId: 'player-1', state: 'DRAFT', version: 2 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ id: passportId, state: 'DRAFT', version: 3 }),
      },
      passportReviewReturn: { create: vi.fn() },
    };
    const traceService = { record: vi.fn().mockResolvedValue({ id: 'event-1' }) };
    const service = new PassportTransitionService(traceService as never);

    await expect(service.edit(transaction as never, {
      passportId,
      actorIdentityId,
      profile: { position: 'Volante', dominantFoot: 'RIGHT' },
    })).resolves.toEqual({
      outcome: 'applied',
      passportId,
      state: 'DRAFT',
      version: 3,
    });

    expect(transaction.playerPassport.findFirst).toHaveBeenCalledWith({
      where: {
        id: passportId,
        state: { in: ['DRAFT', 'RETURNED_FOR_CORRECTION'] },
      },
      select: { id: true, state: true, version: true },
    });
    expect(transaction.playerPassport.updateMany).toHaveBeenCalledWith({
      where: {
        id: passportId,
        state: { in: ['DRAFT', 'RETURNED_FOR_CORRECTION'] },
      },
      data: { position: 'Volante', dominantFoot: 'RIGHT', version: { increment: 1 } },
    });
    expect(traceService.record).toHaveBeenCalledWith(transaction, expect.objectContaining({
      action: 'EDITED',
      priorState: 'DRAFT',
      resultingState: 'DRAFT',
    }));
  });

  it('rejects edits while En revisión without writing or tracing', async () => {
    const transaction = {
      playerPassport: {
        findFirst: vi.fn().mockResolvedValue({ id: passportId, playerId: 'player-1', state: 'IN_REVIEW', version: 4 }),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
      },
      passportReviewReturn: { create: vi.fn() },
    };
    const traceService = { record: vi.fn() };
    const service = new PassportTransitionService(traceService as never);

    await expect(service.edit(transaction as never, {
      passportId,
      actorIdentityId,
      profile: { position: 'Delantero' },
    })).resolves.toEqual({ outcome: 'invalid-state' });
    expect(transaction.playerPassport.updateMany).not.toHaveBeenCalled();
    expect(traceService.record).not.toHaveBeenCalled();
  });

  it('submits a Borrador and records a SUBMITTED trace', async () => {
    const transaction = {
      playerPassport: {
        findFirst: vi.fn().mockResolvedValue({ id: passportId, playerId: 'player-1', state: 'DRAFT', version: 1 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ id: passportId, state: 'IN_REVIEW', version: 2 }),
      },
      passportReviewReturn: { create: vi.fn() },
    };
    const traceService = { record: vi.fn().mockResolvedValue({ id: 'event-1' }) };
    const service = new PassportTransitionService(traceService as never);

    await expect(service.submit(transaction as never, { passportId, actorIdentityId })).resolves.toEqual({
      outcome: 'applied',
      passportId,
      state: 'IN_REVIEW',
      version: 2,
    });
    expect(transaction.playerPassport.updateMany).toHaveBeenCalledWith({
      where: {
        id: passportId,
        state: { in: ['DRAFT', 'RETURNED_FOR_CORRECTION'] },
      },
      data: { state: 'IN_REVIEW', version: { increment: 1 } },
    });
    expect(traceService.record).toHaveBeenCalledWith(transaction, expect.objectContaining({
      action: 'SUBMITTED',
      priorState: 'DRAFT',
      resultingState: 'IN_REVIEW',
    }));
  });

  it('returns an En revisión passport with a creator-safe reason and records a return', async () => {
    const transaction = {
      playerPassport: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: passportId, state: 'IN_REVIEW', version: 5 })
          .mockResolvedValueOnce({ id: passportId, state: 'RETURNED_FOR_CORRECTION', version: 6 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      passportReviewReturn: { create: vi.fn().mockResolvedValue({ id: 'return-1' }) },
    };
    const traceService = { record: vi.fn().mockResolvedValue({ id: 'event-1' }) };
    const service = new PassportTransitionService(traceService as never);

    await expect(service.returnForCorrection(transaction as never, {
      passportId,
      analystIdentityId,
      reason: 'Corrige la categoría declarada',
    })).resolves.toEqual({
      outcome: 'applied',
      passportId,
      state: 'RETURNED_FOR_CORRECTION',
      version: 6,
    });
    expect(transaction.passportReviewReturn.create).toHaveBeenCalledWith({
      data: { passportId, analystIdentityId, reason: 'Corrige la categoría declarada' },
    });
    expect(traceService.record).toHaveBeenCalledWith(transaction, expect.objectContaining({
      action: 'RETURNED_FOR_CORRECTION',
      priorState: 'IN_REVIEW',
      resultingState: 'RETURNED_FOR_CORRECTION',
      details: { reason: 'Corrige la categoría declarada' },
    }));
  });

  it('resubmits a returned passport from Devuelto para corrección', async () => {
    const transaction = {
      playerPassport: {
        findFirst: vi.fn().mockResolvedValue({ id: passportId, playerId: 'player-1', state: 'RETURNED_FOR_CORRECTION', version: 6 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ id: passportId, state: 'IN_REVIEW', version: 7 }),
      },
      passportReviewReturn: { create: vi.fn() },
    };
    const traceService = { record: vi.fn().mockResolvedValue({ id: 'event-1' }) };
    const service = new PassportTransitionService(traceService as never);

    await expect(service.resubmit(transaction as never, { passportId, actorIdentityId })).resolves.toEqual({
      outcome: 'applied',
      passportId,
      state: 'IN_REVIEW',
      version: 7,
    });
    expect(traceService.record).toHaveBeenCalledWith(transaction, expect.objectContaining({
      action: 'SUBMITTED',
      priorState: 'RETURNED_FOR_CORRECTION',
      resultingState: 'IN_REVIEW',
    }));
  });
});
