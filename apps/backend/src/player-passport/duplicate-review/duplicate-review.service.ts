import { Injectable } from '@nestjs/common';

import {
  PassportLifecycleAction,
  PassportLifecycleOutcome,
  PassportLifecycleState,
  Prisma,
  type PassportDuplicateResolution,
} from '../../generated/prisma/client.js';
import { PassportTraceService } from '../passport-lifecycle/passport-trace.service.js';
import {
  PassportTransitionService,
  type PassportTransitionResult,
} from '../passport-lifecycle/passport-transition.service.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/i;
const RESOLUTION_VALUES = new Set<PassportDuplicateResolution>([
  'DIFFERENT_PLAYERS',
  'CORRECTABLE',
  'CONFIRMED_EXISTING_PLAYER',
]);

export type CreatePossibleDuplicateSignalInput = Readonly<{
  passportId: string;
  playerId: string;
  nameDobFingerprint: string;
}>;

export type ResolvePossibleDuplicateInput = Readonly<{
  passportId: string;
  signalId: string;
  analystIdentityId: string;
  resolution: PassportDuplicateResolution;
  correctionReason?: string;
  expectedVersion?: number;
}>;

export type DuplicateSignalCreationResult =
  | Readonly<{ outcome: 'created' }>
  | Readonly<{ outcome: 'none' }>
  | Readonly<{ outcome: 'invalid' }>
  | Readonly<{ outcome: 'unavailable' }>;

export type DuplicateResolutionResult =
  | Readonly<{ outcome: 'resolved'; passportId: string; resolution: PassportDuplicateResolution; state: PassportLifecycleState }>
  | Readonly<{ outcome: 'not-found' }>
  | Readonly<{ outcome: 'invalid' }>
  | Readonly<{ outcome: 'invalid-state' }>
  | Readonly<{ outcome: 'missing-reason' }>
  | Readonly<{ outcome: 'unavailable' }>;

export type DuplicateApprovalStatus =
  | Readonly<{ outcome: 'allowed' }>
  | Readonly<{ outcome: 'unresolved' }>
  | Readonly<{ outcome: 'not-found' }>
  | Readonly<{ outcome: 'invalid' }>
  | Readonly<{ outcome: 'invalid-state' }>
  | Readonly<{ outcome: 'unavailable' }>;

@Injectable()
export class DuplicateReviewService {
  constructor(
    private readonly traceService: PassportTraceService,
    private readonly transitionService: PassportTransitionService,
  ) {}

  async createSignal(
    transaction: Prisma.TransactionClient,
    input: CreatePossibleDuplicateSignalInput,
  ): Promise<DuplicateSignalCreationResult> {
    if (!UUID_PATTERN.test(input.passportId) || !UUID_PATTERN.test(input.playerId) || !FINGERPRINT_PATTERN.test(input.nameDobFingerprint)) {
      return { outcome: 'invalid' };
    }

    const match = await transaction.playerPrivateIdentity.findFirst({
      where: { nameDobFingerprint: input.nameDobFingerprint, playerId: { not: input.playerId } },
      select: { id: true },
    });
    if (!match) return { outcome: 'none' };

    await transaction.passportPossibleDuplicateSignal.create({ data: { passportId: input.passportId } });
    return { outcome: 'created' };
  }

  async resolve(
    transaction: Prisma.TransactionClient,
    input: ResolvePossibleDuplicateInput,
  ): Promise<DuplicateResolutionResult> {
    if (
      !UUID_PATTERN.test(input.passportId)
      || !UUID_PATTERN.test(input.signalId)
      || !UUID_PATTERN.test(input.analystIdentityId)
      || !RESOLUTION_VALUES.has(input.resolution)
    ) {
      return { outcome: 'invalid' };
    }

    const passport = await transaction.playerPassport.findUnique({
      where: { id: input.passportId },
      select: { id: true, state: true, version: true },
    });
    if (!passport) return { outcome: 'not-found' };
    if (passport.state !== PassportLifecycleState.IN_REVIEW) return { outcome: 'invalid-state' };
    if (input.expectedVersion !== undefined && passport.version !== input.expectedVersion) return { outcome: 'invalid-state' };

    const signal = await transaction.passportPossibleDuplicateSignal.findFirst({
      where: { id: input.signalId, passportId: input.passportId, status: 'UNRESOLVED' },
      select: { id: true, status: true },
    });
    if (!signal) return { outcome: 'invalid-state' };

    let resultingState: PassportLifecycleState = passport.state;
    if (input.resolution === 'CORRECTABLE') {
      if (!input.correctionReason || input.correctionReason.trim().length === 0) return { outcome: 'missing-reason' };
      const returned = await this.transitionService.returnForCorrection(transaction, {
        passportId: input.passportId,
        analystIdentityId: input.analystIdentityId,
        reason: input.correctionReason,
        ...(input.expectedVersion === undefined ? {} : { expectedVersion: input.expectedVersion }),
      });
      if (returned.outcome !== 'applied') return this.fromTransitionFailure(returned);
      resultingState = returned.state;
    }

    const updated = await transaction.passportPossibleDuplicateSignal.updateMany({
      where: { id: input.signalId, passportId: input.passportId, status: 'UNRESOLVED' },
      data: {
        status: 'RESOLVED',
        resolution: input.resolution,
        resolvedByIdentityId: input.analystIdentityId,
        resolvedAt: new Date(),
      },
    });
    if (updated.count !== 1) return { outcome: 'invalid-state' };

    await this.traceService.record(transaction, {
      passportId: input.passportId,
      actorIdentityId: input.analystIdentityId,
      action: PassportLifecycleAction.POSSIBLE_DUPLICATE_RESOLVED,
      outcome: PassportLifecycleOutcome.APPLIED,
      priorState: passport.state,
      resultingState,
      details: { resolution: input.resolution },
    });

    return { outcome: 'resolved', passportId: input.passportId, resolution: input.resolution, state: resultingState };
  }

  async approvalStatus(transaction: Prisma.TransactionClient, passportId: string): Promise<DuplicateApprovalStatus> {
    if (!UUID_PATTERN.test(passportId)) return { outcome: 'invalid' };

    const passport = await transaction.playerPassport.findUnique({
      where: { id: passportId },
      select: { id: true, state: true },
    });
    if (!passport) return { outcome: 'not-found' };
    if (passport.state !== PassportLifecycleState.IN_REVIEW) return { outcome: 'invalid-state' };

    const unresolved = await transaction.passportPossibleDuplicateSignal.count({
      where: { passportId, status: 'UNRESOLVED' },
    });
    return unresolved > 0 ? { outcome: 'unresolved' } : { outcome: 'allowed' };
  }

  private fromTransitionFailure(result: PassportTransitionResult): DuplicateResolutionResult {
    if (result.outcome === 'not-found') return { outcome: 'not-found' };
    if (result.outcome === 'invalid-state') return { outcome: 'invalid-state' };
    if (result.outcome === 'invalid') return { outcome: 'invalid' };
    return { outcome: 'unavailable' };
  }
}
