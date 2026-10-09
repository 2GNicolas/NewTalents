import { describe, expect, it, vi } from 'vitest';

import { PassportLifecycleService } from './passport-lifecycle.service.js';

const actorIdentityId = '11111111-1111-4111-8111-111111111111';
const academyId = '22222222-2222-4222-8222-222222222222';
const playerId = '33333333-3333-4333-8333-333333333333';
const passportId = '44444444-4444-4444-8444-444444444444';

const storedPrivateIdentity = {
  encryptedLegalName: 'encrypted-legal-name',
  encryptedDateOfBirth: 'encrypted-date-of-birth',
  encryptedDocumentType: 'encrypted-document-type',
  encryptedDocumentNumber: 'encrypted-document-number',
  documentFingerprint: 'a'.repeat(64),
  nameDobFingerprint: 'b'.repeat(64),
};

const profile = {
  position: 'Delantero',
  ageCategory: 'Sub-13',
  city: 'Medellín',
  country: 'Colombia',
  dominantFoot: 'LEFT',
} as const;

const privateIdentity = {
  legalName: 'Mateo González',
  dateOfBirth: '2026-09-16',
  documentType: 'CC',
  documentNumber: '123-456',
};

describe('PassportLifecycleService', () => {
  it('creates a Tutor draft atomically with private identity, passport, initial responsibility, and both creation trace events', async () => {
    const transaction = {
      academy: { findUnique: vi.fn() },
      player: { create: vi.fn().mockResolvedValue({ id: playerId }) },
      playerPrivateIdentity: { create: vi.fn().mockResolvedValue({ id: 'private-identity-1' }) },
      playerPassport: { create: vi.fn().mockResolvedValue({ id: passportId }) },
      initialTutorResponsibility: { create: vi.fn().mockResolvedValue({ id: 'responsibility-1' }) },
    };
    const privateIdentityService = { createPrivateIdentity: vi.fn().mockReturnValue(storedPrivateIdentity) };
    const traceService = { record: vi.fn().mockResolvedValue({ id: 'event-1' }) };
    const duplicateReviewService = { createSignal: vi.fn().mockResolvedValue({ outcome: 'none' }) };
    const transactionRunner = { execute: async (operation: (tx: unknown) => Promise<unknown>) => operation(transaction) };

    const service = new PassportLifecycleService(
      privateIdentityService as never,
      traceService as never,
      duplicateReviewService as never,
      transactionRunner as never,
    );

    await expect(service.createDraft({
      actorIdentityId,
      origin: 'TUTOR',
      privateIdentity,
      profile,
    })).resolves.toEqual({
      outcome: 'created',
      passportId,
      playerId,
      state: 'DRAFT',
      origin: 'TUTOR',
    });

    expect(privateIdentityService.createPrivateIdentity).toHaveBeenCalledWith(privateIdentity);
    expect(transaction.player.create).toHaveBeenCalledWith({ data: {} });
    expect(transaction.playerPrivateIdentity.create).toHaveBeenCalledWith({
      data: { playerId, ...storedPrivateIdentity },
    });
    expect(transaction.playerPassport.create).toHaveBeenCalledWith({
      data: {
        playerId,
        state: 'DRAFT',
        originKind: 'TUTOR',
        position: 'Delantero',
        ageCategory: 'Sub-13',
        city: 'Medellín',
        country: 'Colombia',
        dominantFoot: 'LEFT',
        createdByIdentityId: actorIdentityId,
        originAcademyId: null,
      },
    });
    expect(transaction.initialTutorResponsibility.create).toHaveBeenCalledWith({
      data: { playerId, tutorIdentityId: actorIdentityId },
    });
    expect(traceService.record).toHaveBeenNthCalledWith(1, transaction, expect.objectContaining({ action: 'CREATED' }));
    expect(traceService.record).toHaveBeenNthCalledWith(2, transaction, expect.objectContaining({
      action: 'INITIAL_TUTOR_RESPONSIBILITY_ESTABLISHED',
    }));
    expect(duplicateReviewService.createSignal).toHaveBeenCalledWith(transaction, {
      passportId,
      playerId,
      nameDobFingerprint: storedPrivateIdentity.nameDobFingerprint,
    });
  });

  it('creates an Academy draft with origin only and no initial Tutor responsibility', async () => {
    const transaction = {
      academy: { findUnique: vi.fn().mockResolvedValue({ id: academyId }) },
      player: { create: vi.fn().mockResolvedValue({ id: playerId }) },
      playerPrivateIdentity: { create: vi.fn().mockResolvedValue({ id: 'private-identity-1' }) },
      playerPassport: { create: vi.fn().mockResolvedValue({ id: passportId }) },
      initialTutorResponsibility: { create: vi.fn() },
    };
    const privateIdentityService = { createPrivateIdentity: vi.fn().mockReturnValue(storedPrivateIdentity) };
    const traceService = { record: vi.fn().mockResolvedValue({ id: 'event-1' }) };
    const duplicateReviewService = { createSignal: vi.fn().mockResolvedValue({ outcome: 'none' }) };
    const transactionRunner = { execute: async (operation: (tx: unknown) => Promise<unknown>) => operation(transaction) };

    const service = new PassportLifecycleService(
      privateIdentityService as never,
      traceService as never,
      duplicateReviewService as never,
      transactionRunner as never,
    );

    await expect(service.createDraft({
      actorIdentityId,
      origin: 'ACADEMY',
      academyId,
      privateIdentity,
      profile,
    })).resolves.toEqual({
      outcome: 'created',
      passportId,
      playerId,
      state: 'DRAFT',
      origin: 'ACADEMY',
    });

    expect(transaction.academy.findUnique).toHaveBeenCalledWith({ where: { id: academyId }, select: { id: true } });
    expect(transaction.playerPassport.create).toHaveBeenCalledWith({
      data: {
        playerId,
        state: 'DRAFT',
        originKind: 'ACADEMY',
        position: 'Delantero',
        ageCategory: 'Sub-13',
        city: 'Medellín',
        country: 'Colombia',
        dominantFoot: 'LEFT',
        createdByIdentityId: actorIdentityId,
        originAcademyId: academyId,
      },
    });
    expect(transaction.initialTutorResponsibility.create).not.toHaveBeenCalled();
    expect(traceService.record).toHaveBeenCalledTimes(1);
    expect(traceService.record).toHaveBeenCalledWith(transaction, expect.objectContaining({ action: 'CREATED' }));
  });
});
