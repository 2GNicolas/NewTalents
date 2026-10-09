import { Injectable } from '@nestjs/common';

import {
  PassportLifecycleAction,
  PassportLifecycleOutcome,
  PassportLifecycleState,
  PassportOrigin,
  Prisma,
  type DominantFoot,
} from '../../generated/prisma/client.js';
import { DuplicateReviewService } from '../duplicate-review/duplicate-review.service.js';
import { PrivateIdentityService, type PrivateIdentityInput } from '../player-private-identity/private-identity.service.js';
import { PassportTraceService } from './passport-trace.service.js';
import { PassportTransactionRunner } from './transaction-runner.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PassportProfileInput = Readonly<{
  position: string;
  ageCategory: string;
  city: string;
  country: string;
  dominantFoot: DominantFoot;
}>;

export type CreatePassportDraftInput = Readonly<{
  actorIdentityId: string;
  origin: PassportOrigin;
  academyId?: string | null;
  privateIdentity: PrivateIdentityInput;
  profile: PassportProfileInput;
}>;

export type PassportCreationResult =
  | Readonly<{ outcome: 'created'; passportId: string; playerId: string; state: PassportLifecycleState; origin: PassportOrigin }>
  | Readonly<{ outcome: 'invalid' }>
  | Readonly<{ outcome: 'duplicate-document' }>
  | Readonly<{ outcome: 'unavailable' }>;

@Injectable()
export class PassportLifecycleService {
  constructor(
    private readonly privateIdentityService: PrivateIdentityService,
    private readonly traceService: PassportTraceService,
    private readonly duplicateReviewService: DuplicateReviewService,
    private readonly transactionRunner: PassportTransactionRunner,
  ) {}

  async createDraft(input: CreatePassportDraftInput): Promise<PassportCreationResult> {
    if (!UUID_PATTERN.test(input.actorIdentityId) || !this.validOrigin(input.origin)) return { outcome: 'invalid' };

    try {
      return await this.transactionRunner.execute((transaction) => this.createInTransaction(transaction, input));
    } catch (error) {
      return this.code(error) === 'P2002' ? { outcome: 'duplicate-document' } : { outcome: 'unavailable' };
    }
  }

  private async createInTransaction(
    transaction: Prisma.TransactionClient,
    input: CreatePassportDraftInput,
  ): Promise<PassportCreationResult> {
    if (input.origin === PassportOrigin.ACADEMY) {
      if (!input.academyId || !UUID_PATTERN.test(input.academyId)) return { outcome: 'invalid' };
      const academy = await transaction.academy.findUnique({ where: { id: input.academyId }, select: { id: true } });
      if (!academy) return { outcome: 'invalid' };
    }

    let stored;
    try {
      stored = this.privateIdentityService.createPrivateIdentity(input.privateIdentity);
    } catch {
      return { outcome: 'invalid' };
    }

    const player = await transaction.player.create({ data: {} });
    await transaction.playerPrivateIdentity.create({ data: { playerId: player.id, ...stored } });
    const passport = await transaction.playerPassport.create({
      data: {
        playerId: player.id,
        state: PassportLifecycleState.DRAFT,
        originKind: input.origin,
        position: input.profile.position,
        ageCategory: input.profile.ageCategory,
        city: input.profile.city,
        country: input.profile.country,
        dominantFoot: input.profile.dominantFoot,
        createdByIdentityId: input.actorIdentityId,
        originAcademyId: input.origin === PassportOrigin.ACADEMY ? input.academyId ?? null : null,
      },
    });

    if (input.origin === PassportOrigin.TUTOR) {
      await transaction.initialTutorResponsibility.create({
        data: { playerId: player.id, tutorIdentityId: input.actorIdentityId },
      });
    }

    await this.traceService.record(transaction, {
      passportId: passport.id,
      actorIdentityId: input.actorIdentityId,
      action: PassportLifecycleAction.CREATED,
      outcome: PassportLifecycleOutcome.APPLIED,
      priorState: null,
      resultingState: PassportLifecycleState.DRAFT,
    });

    if (input.origin === PassportOrigin.TUTOR) {
      await this.traceService.record(transaction, {
        passportId: passport.id,
        actorIdentityId: input.actorIdentityId,
        action: PassportLifecycleAction.INITIAL_TUTOR_RESPONSIBILITY_ESTABLISHED,
        outcome: PassportLifecycleOutcome.APPLIED,
        priorState: null,
        resultingState: PassportLifecycleState.DRAFT,
      });
    }

    const signal = await this.duplicateReviewService.createSignal(transaction, {
      passportId: passport.id,
      playerId: player.id,
      nameDobFingerprint: stored.nameDobFingerprint,
    });
    if (signal.outcome === 'invalid' || signal.outcome === 'unavailable') {
      throw new Error('Possible duplicate signal could not be recorded');
    }

    return { outcome: 'created', passportId: passport.id, playerId: player.id, state: PassportLifecycleState.DRAFT, origin: input.origin };
  }

  private validOrigin(origin: PassportOrigin): boolean {
    return origin === PassportOrigin.TUTOR || origin === PassportOrigin.ACADEMY;
  }

  private code(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  }
}
