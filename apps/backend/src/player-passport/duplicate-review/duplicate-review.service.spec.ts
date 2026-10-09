import { describe, expect, it, vi } from 'vitest';

import { DuplicateReviewService } from './duplicate-review.service.js';

const passportId = '44444444-4444-4444-8444-444444444444';
const playerId = '33333333-3333-4333-8333-333333333333';
const signalId = '66666666-6666-4666-8666-666666666666';
const analystIdentityId = '55555555-5555-4555-8555-555555555555';

describe('DuplicateReviewService', () => {
  it('creates a private possible-duplicate signal only when a matching name/DOB fingerprint exists', async () => {
    const transaction = {
      playerPrivateIdentity: { findFirst: vi.fn().mockResolvedValue({ id: 'other-identity' }) },
      passportPossibleDuplicateSignal: { create: vi.fn().mockResolvedValue({ id: signalId }) },
    };
    const traceService = { record: vi.fn() };
    const transitionService = { returnForCorrection: vi.fn() };
    const service = new DuplicateReviewService(traceService as never, transitionService as never);

    await expect(service.createSignal(transaction as never, {
      passportId,
      playerId,
      nameDobFingerprint: 'b'.repeat(64),
    })).resolves.toEqual({ outcome: 'created' });
    expect(transaction.playerPrivateIdentity.findFirst).toHaveBeenCalledWith({
      where: { nameDobFingerprint: 'b'.repeat(64), playerId: { not: playerId } },
      select: { id: true },
    });
    expect(transaction.passportPossibleDuplicateSignal.create).toHaveBeenCalledWith({ data: { passportId } });
    expect(traceService.record).not.toHaveBeenCalled();
  });

  it('resolves DIFFERENT_PLAYERS without changing the lifecycle state', async () => {
    const transaction = {
      playerPassport: { findUnique: vi.fn().mockResolvedValue({ id: passportId, state: 'IN_REVIEW' }) },
      passportPossibleDuplicateSignal: {
        findFirst: vi.fn().mockResolvedValue({ id: signalId, status: 'UNRESOLVED' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const traceService = { record: vi.fn().mockResolvedValue({ id: 'event-1' }) };
    const transitionService = { returnForCorrection: vi.fn() };
    const service = new DuplicateReviewService(traceService as never, transitionService as never);

    await expect(service.resolve(transaction as never, {
      passportId,
      signalId,
      analystIdentityId,
      resolution: 'DIFFERENT_PLAYERS',
    })).resolves.toEqual({
      outcome: 'resolved',
      passportId,
      resolution: 'DIFFERENT_PLAYERS',
      state: 'IN_REVIEW',
    });
    expect(transaction.passportPossibleDuplicateSignal.updateMany).toHaveBeenCalledWith({
      where: { id: signalId, passportId, status: 'UNRESOLVED' },
      data: {
        status: 'RESOLVED',
        resolution: 'DIFFERENT_PLAYERS',
        resolvedByIdentityId: analystIdentityId,
        resolvedAt: expect.any(Date),
      },
    });
    expect(transitionService.returnForCorrection).not.toHaveBeenCalled();
    expect(traceService.record).toHaveBeenCalledWith(transaction, expect.objectContaining({
      action: 'POSSIBLE_DUPLICATE_RESOLVED',
      priorState: 'IN_REVIEW',
      resultingState: 'IN_REVIEW',
      details: { resolution: 'DIFFERENT_PLAYERS' },
    }));
  });

  it('resolves CORRECTABLE by using the existing return transition with a disclosure-safe reason', async () => {
    const transaction = {
      playerPassport: { findUnique: vi.fn().mockResolvedValue({ id: passportId, state: 'IN_REVIEW' }) },
      passportPossibleDuplicateSignal: {
        findFirst: vi.fn().mockResolvedValue({ id: signalId, status: 'UNRESOLVED' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const traceService = { record: vi.fn().mockResolvedValue({ id: 'event-1' }) };
    const transitionService = {
      returnForCorrection: vi.fn().mockResolvedValue({
        outcome: 'applied',
        passportId,
        state: 'RETURNED_FOR_CORRECTION',
        version: 8,
      }),
    };
    const service = new DuplicateReviewService(traceService as never, transitionService as never);

    await expect(service.resolve(transaction as never, {
      passportId,
      signalId,
      analystIdentityId,
      resolution: 'CORRECTABLE',
      correctionReason: 'Corrige el nombre legal',
    })).resolves.toEqual({
      outcome: 'resolved',
      passportId,
      resolution: 'CORRECTABLE',
      state: 'RETURNED_FOR_CORRECTION',
    });
    expect(transitionService.returnForCorrection).toHaveBeenCalledWith(transaction, {
      passportId,
      analystIdentityId,
      reason: 'Corrige el nombre legal',
    });
    expect(traceService.record).toHaveBeenCalledWith(transaction, expect.objectContaining({
      action: 'POSSIBLE_DUPLICATE_RESOLVED',
      priorState: 'IN_REVIEW',
      resultingState: 'RETURNED_FOR_CORRECTION',
      details: { resolution: 'CORRECTABLE' },
    }));
  });

  it('resolves CONFIRMED_EXISTING_PLAYER without approving, activating, or changing state', async () => {
    const transaction = {
      playerPassport: { findUnique: vi.fn().mockResolvedValue({ id: passportId, state: 'IN_REVIEW' }) },
      passportPossibleDuplicateSignal: {
        findFirst: vi.fn().mockResolvedValue({ id: signalId, status: 'UNRESOLVED' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const traceService = { record: vi.fn().mockResolvedValue({ id: 'event-1' }) };
    const transitionService = { returnForCorrection: vi.fn() };
    const service = new DuplicateReviewService(traceService as never, transitionService as never);

    await expect(service.resolve(transaction as never, {
      passportId,
      signalId,
      analystIdentityId,
      resolution: 'CONFIRMED_EXISTING_PLAYER',
    })).resolves.toEqual({
      outcome: 'resolved',
      passportId,
      resolution: 'CONFIRMED_EXISTING_PLAYER',
      state: 'IN_REVIEW',
    });
    expect(transitionService.returnForCorrection).not.toHaveBeenCalled();
    expect(traceService.record).toHaveBeenCalledWith(transaction, expect.objectContaining({
      details: { resolution: 'CONFIRMED_EXISTING_PLAYER' },
    }));
  });

  it('blocks approval while an unresolved possible-duplicate signal remains', async () => {
    const transaction = {
      playerPassport: { findUnique: vi.fn().mockResolvedValue({ id: passportId, state: 'IN_REVIEW' }) },
      passportPossibleDuplicateSignal: { count: vi.fn().mockResolvedValue(1) },
    };
    const traceService = { record: vi.fn() };
    const transitionService = { returnForCorrection: vi.fn() };
    const service = new DuplicateReviewService(traceService as never, transitionService as never);

    await expect(service.approvalStatus(transaction as never, passportId)).resolves.toEqual({ outcome: 'unresolved' });
  });

  it('allows approval once all possible-duplicate signals are resolved', async () => {
    const transaction = {
      playerPassport: { findUnique: vi.fn().mockResolvedValue({ id: passportId, state: 'IN_REVIEW' }) },
      passportPossibleDuplicateSignal: { count: vi.fn().mockResolvedValue(0) },
    };
    const traceService = { record: vi.fn() };
    const transitionService = { returnForCorrection: vi.fn() };
    const service = new DuplicateReviewService(traceService as never, transitionService as never);

    await expect(service.approvalStatus(transaction as never, passportId)).resolves.toEqual({ outcome: 'allowed' });
  });
});
