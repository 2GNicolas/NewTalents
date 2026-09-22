import { Injectable } from '@nestjs/common';

import {
  PassportLifecycleAction,
  PassportLifecycleOutcome,
  PassportLifecycleState,
  Prisma,
  type DominantFoot,
} from '../../generated/prisma/client.js';
import { PassportTraceService } from './passport-trace.service.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PassportProfilePatch = Readonly<{
  position?: string;
  ageCategory?: string;
  city?: string;
  country?: string;
  dominantFoot?: DominantFoot;
}>;

export type EditPassportInput = Readonly<{
  passportId: string;
  actorIdentityId: string;
  profile: PassportProfilePatch;
}>;

export type SubmitPassportInput = Readonly<{
  passportId: string;
  actorIdentityId: string;
  expectedVersion?: number;
}>;

export type ReturnPassportInput = Readonly<{
  passportId: string;
  analystIdentityId: string;
  reason: string;
  expectedVersion?: number;
}>;

export type PassportTransitionResult =
  | Readonly<{ outcome: 'applied'; passportId: string; state: PassportLifecycleState; version: number }>
  | Readonly<{ outcome: 'not-found' }>
  | Readonly<{ outcome: 'invalid' }>
  | Readonly<{ outcome: 'invalid-state' }>
  | Readonly<{ outcome: 'unavailable' }>;

export type PassportApprovalResult =
  | Readonly<{ outcome: 'applied'; passportId: string; state: PassportLifecycleState; version: number }>
  | Readonly<{ outcome: 'not-found' }>
  | Readonly<{ outcome: 'invalid' }>
  | Readonly<{ outcome: 'invalid-state' }>
  | Readonly<{ outcome: 'unresolved-duplicate' }>
  | Readonly<{ outcome: 'unavailable' }>;

export type PassportActivationResult =
  | Readonly<{ outcome: 'applied'; passportId: string; state: PassportLifecycleState; version: number }>
  | Readonly<{ outcome: 'not-found' }>
  | Readonly<{ outcome: 'invalid' }>
  | Readonly<{ outcome: 'invalid-state' }>
  | Readonly<{ outcome: 'unavailable' }>;

type PassportSelect = Readonly<{ id: string; state: PassportLifecycleState; version: number }>;

const editableStates: readonly PassportLifecycleState[] = [
  PassportLifecycleState.DRAFT,
  PassportLifecycleState.RETURNED_FOR_CORRECTION,
];

@Injectable()
export class PassportTransitionService {
  constructor(private readonly traceService: PassportTraceService) {}

  async edit(transaction: Prisma.TransactionClient, input: EditPassportInput): Promise<PassportTransitionResult> {
    if (!UUID_PATTERN.test(input.passportId) || !UUID_PATTERN.test(input.actorIdentityId) || !this.hasProfileValue(input.profile)) {
      return { outcome: 'invalid' };
    }

    const passport = await transaction.playerPassport.findFirst({
      where: {
        id: input.passportId,
        state: { in: [...editableStates] },
      },
      select: { id: true, state: true, version: true },
    });
    if (!passport) {
      const owned = await transaction.playerPassport.findFirst({
        where: {
          id: input.passportId,
        },
        select: { id: true, state: true, version: true },
      });
      return owned ? { outcome: 'invalid-state' } : { outcome: 'not-found' };
    }
    if (!editableStates.includes(passport.state)) return { outcome: 'invalid-state' };

    const data = this.profileData(input.profile);
    data.version = { increment: 1 };
    const updated = await transaction.playerPassport.updateMany({
      where: {
        id: input.passportId,
        state: { in: [...editableStates] },
      },
      data,
    });
    if (updated.count !== 1) return { outcome: 'invalid-state' };

    const current = await this.findCurrent(transaction, input.passportId);
    if (!current) return { outcome: 'invalid-state' };

    await this.traceService.record(transaction, {
      passportId: input.passportId,
      actorIdentityId: input.actorIdentityId,
      action: PassportLifecycleAction.EDITED,
      outcome: PassportLifecycleOutcome.APPLIED,
      priorState: passport.state,
      resultingState: current.state,
    });

    return { outcome: 'applied', passportId: current.id, state: current.state, version: current.version };
  }

  async submit(transaction: Prisma.TransactionClient, input: SubmitPassportInput): Promise<PassportTransitionResult> {
    if (!UUID_PATTERN.test(input.passportId) || !UUID_PATTERN.test(input.actorIdentityId)) return { outcome: 'invalid' };

    const passport = await transaction.playerPassport.findFirst({
      where: {
        id: input.passportId,
        state: { in: [...editableStates] },
      },
      select: { id: true, state: true, version: true },
    });
    if (!passport) {
      const owned = await transaction.playerPassport.findFirst({
        where: {
          id: input.passportId,
        },
        select: { id: true, state: true, version: true },
      });
      return owned ? { outcome: 'invalid-state' } : { outcome: 'not-found' };
    }
    if (!editableStates.includes(passport.state)) return { outcome: 'invalid-state' };
    if (input.expectedVersion !== undefined && passport.version !== input.expectedVersion) return { outcome: 'invalid-state' };

    const updated = await transaction.playerPassport.updateMany({
      where: {
        id: input.passportId,
        state: { in: [...editableStates] },
        ...(input.expectedVersion === undefined ? {} : { version: input.expectedVersion }),
      },
      data: { state: PassportLifecycleState.IN_REVIEW, version: { increment: 1 } },
    });
    if (updated.count !== 1) return { outcome: 'invalid-state' };

    const current = await this.findCurrent(transaction, input.passportId);
    if (!current) return { outcome: 'invalid-state' };

    await this.traceService.record(transaction, {
      passportId: input.passportId,
      actorIdentityId: input.actorIdentityId,
      action: PassportLifecycleAction.SUBMITTED,
      outcome: PassportLifecycleOutcome.APPLIED,
      priorState: passport.state,
      resultingState: current.state,
    });

    return { outcome: 'applied', passportId: current.id, state: current.state, version: current.version };
  }

  async resubmit(transaction: Prisma.TransactionClient, input: SubmitPassportInput): Promise<PassportTransitionResult> {
    return this.submit(transaction, input);
  }

  async returnForCorrection(transaction: Prisma.TransactionClient, input: ReturnPassportInput): Promise<PassportTransitionResult> {
    if (!UUID_PATTERN.test(input.passportId) || !UUID_PATTERN.test(input.analystIdentityId) || input.reason.trim().length === 0) {
      return { outcome: 'invalid' };
    }

    const passport = await transaction.playerPassport.findUnique({
      where: { id: input.passportId },
      select: { id: true, state: true, version: true },
    });
    if (!passport) return { outcome: 'not-found' };
    if (passport.state !== PassportLifecycleState.IN_REVIEW) return { outcome: 'invalid-state' };
    if (input.expectedVersion !== undefined && passport.version !== input.expectedVersion) return { outcome: 'invalid-state' };

    const updated = await transaction.playerPassport.updateMany({
      where: { id: input.passportId, state: PassportLifecycleState.IN_REVIEW, ...(input.expectedVersion === undefined ? {} : { version: input.expectedVersion }) },
      data: { state: PassportLifecycleState.RETURNED_FOR_CORRECTION, version: { increment: 1 } },
    });
    if (updated.count !== 1) return { outcome: 'invalid-state' };

    await transaction.passportReviewReturn.create({
      data: {
        passportId: input.passportId,
        analystIdentityId: input.analystIdentityId,
        reason: input.reason,
      },
    });

    const current = await this.findCurrent(transaction, input.passportId);
    if (!current) return { outcome: 'invalid-state' };

    await this.traceService.record(transaction, {
      passportId: input.passportId,
      actorIdentityId: input.analystIdentityId,
      action: PassportLifecycleAction.RETURNED_FOR_CORRECTION,
      outcome: PassportLifecycleOutcome.APPLIED,
      priorState: passport.state,
      resultingState: current.state,
      details: { reason: input.reason },
    });

    return { outcome: 'applied', passportId: current.id, state: current.state, version: current.version };
  }

  async approve(transaction: Prisma.TransactionClient, input: Readonly<{ passportId: string; analystIdentityId: string; expectedVersion?: number }>): Promise<PassportApprovalResult> {
    if (!UUID_PATTERN.test(input.passportId) || !UUID_PATTERN.test(input.analystIdentityId)) return { outcome: 'invalid' };

    const passport = await transaction.playerPassport.findUnique({
      where: { id: input.passportId },
      select: { id: true, state: true, version: true },
    });
    if (!passport) return { outcome: 'not-found' };
    if (passport.state !== PassportLifecycleState.IN_REVIEW) return { outcome: 'invalid-state' };
    if (input.expectedVersion !== undefined && passport.version !== input.expectedVersion) return { outcome: 'invalid-state' };

    const unresolved = await transaction.passportPossibleDuplicateSignal.count({
      where: { passportId: input.passportId, status: 'UNRESOLVED' },
    });
    if (unresolved > 0) return { outcome: 'unresolved-duplicate' };

    const confirmedExisting = await transaction.passportPossibleDuplicateSignal.count({
      where: { passportId: input.passportId, resolution: 'CONFIRMED_EXISTING_PLAYER' },
    });
    if (confirmedExisting > 0) return { outcome: 'invalid-state' };

    const updated = await transaction.playerPassport.updateMany({
      where: { id: input.passportId, state: PassportLifecycleState.IN_REVIEW, ...(input.expectedVersion === undefined ? {} : { version: input.expectedVersion }) },
      data: { state: PassportLifecycleState.APPROVED, version: { increment: 1 } },
    });
    if (updated.count !== 1) return { outcome: 'invalid-state' };

    const current = await this.findCurrent(transaction, input.passportId);
    if (!current) return { outcome: 'invalid-state' };

    await this.traceService.record(transaction, {
      passportId: input.passportId,
      actorIdentityId: input.analystIdentityId,
      action: PassportLifecycleAction.APPROVED,
      outcome: PassportLifecycleOutcome.APPLIED,
      priorState: passport.state,
      resultingState: current.state,
    });

    return { outcome: 'applied', passportId: current.id, state: current.state, version: current.version };
  }

  async activate(transaction: Prisma.TransactionClient, input: Readonly<{ passportId: string; administratorIdentityId: string; expectedVersion?: number }>): Promise<PassportActivationResult> {
    if (!UUID_PATTERN.test(input.passportId) || !UUID_PATTERN.test(input.administratorIdentityId)) return { outcome: 'invalid' };

    const passport = await transaction.playerPassport.findUnique({
      where: { id: input.passportId },
      select: { id: true, state: true, version: true },
    });
    if (!passport) return { outcome: 'not-found' };
    if (passport.state !== PassportLifecycleState.APPROVED) return { outcome: 'invalid-state' };
    if (input.expectedVersion !== undefined && passport.version !== input.expectedVersion) return { outcome: 'invalid-state' };

    const updated = await transaction.playerPassport.updateMany({
      where: { id: input.passportId, state: PassportLifecycleState.APPROVED, ...(input.expectedVersion === undefined ? {} : { version: input.expectedVersion }) },
      data: { state: PassportLifecycleState.ACTIVE, version: { increment: 1 } },
    });
    if (updated.count !== 1) return { outcome: 'invalid-state' };

    const current = await this.findCurrent(transaction, input.passportId);
    if (!current) return { outcome: 'invalid-state' };

    await this.traceService.record(transaction, {
      passportId: input.passportId,
      actorIdentityId: input.administratorIdentityId,
      action: PassportLifecycleAction.ACTIVATED,
      outcome: PassportLifecycleOutcome.APPLIED,
      priorState: passport.state,
      resultingState: current.state,
    });

    return { outcome: 'applied', passportId: current.id, state: current.state, version: current.version };
  }

  private hasProfileValue(profile: PassportProfilePatch): boolean {
    return profile.position !== undefined
      || profile.ageCategory !== undefined
      || profile.city !== undefined
      || profile.country !== undefined
      || profile.dominantFoot !== undefined;
  }

  private profileData(profile: PassportProfilePatch): Prisma.PlayerPassportUpdateManyMutationInput {
    const data: Prisma.PlayerPassportUpdateManyMutationInput = {};
    if (profile.position !== undefined) data.position = profile.position;
    if (profile.ageCategory !== undefined) data.ageCategory = profile.ageCategory;
    if (profile.city !== undefined) data.city = profile.city;
    if (profile.country !== undefined) data.country = profile.country;
    if (profile.dominantFoot !== undefined) data.dominantFoot = profile.dominantFoot;
    return data;
  }

  private async findCurrent(transaction: Prisma.TransactionClient, passportId: string): Promise<PassportSelect | null> {
    return transaction.playerPassport.findUnique({
      where: { id: passportId },
      select: { id: true, state: true, version: true },
    });
  }
}
