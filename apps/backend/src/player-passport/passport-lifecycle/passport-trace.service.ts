import { Injectable } from '@nestjs/common';

import {
  PassportDuplicateResolution,
  Prisma,
  type PassportLifecycleAction,
  type PassportLifecycleOutcome,
  type PassportLifecycleState,
} from '../../generated/prisma/client.js';

export type PassportTraceInput = Readonly<{
  passportId: string;
  actorIdentityId: string;
  action: PassportLifecycleAction;
  outcome: PassportLifecycleOutcome;
  priorState?: PassportLifecycleState | null;
  resultingState?: PassportLifecycleState | null;
  details?: Record<string, unknown>;
}>;

export type RecordedPassportLifecycleEvent = Readonly<{
  id: string;
  action: PassportLifecycleAction;
  outcome: PassportLifecycleOutcome;
  actorIdentityId: string;
  priorState: PassportLifecycleState | null;
  resultingState: PassportLifecycleState | null;
  details: Record<string, unknown>;
  createdAt: Date;
}>;

const RESOLUTION_VALUES = new Set<string>(Object.values(PassportDuplicateResolution));

@Injectable()
export class PassportTraceService {
  async record(
    transaction: Prisma.TransactionClient,
    input: PassportTraceInput,
  ): Promise<RecordedPassportLifecycleEvent> {
    const created = await transaction.passportLifecycleEvent.create({
      data: {
        passportId: input.passportId,
        actorIdentityId: input.actorIdentityId,
        action: input.action,
        outcome: input.outcome,
        priorState: input.priorState ?? null,
        resultingState: input.resultingState ?? null,
        details: this.redactDetails(input.details),
      },
    });

    return created as unknown as RecordedPassportLifecycleEvent;
  }

  private redactDetails(details: Record<string, unknown> | undefined): Prisma.InputJsonObject {
    const redacted: Record<string, string> = {};

    if (details) {
      if (typeof details.reason === 'string' && details.reason.trim().length > 0) {
        redacted.reason = details.reason;
      }
      if (typeof details.resolution === 'string' && RESOLUTION_VALUES.has(details.resolution)) {
        redacted.resolution = details.resolution;
      }
    }

    return redacted as unknown as Prisma.InputJsonObject;
  }
}
