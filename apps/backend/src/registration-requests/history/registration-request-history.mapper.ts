import type { RegistrationRequestEventOutcome, RegistrationRequestStatus } from '../../generated/prisma/client.js';

export type RegistrationHistorySource = Readonly<{
  actorIdentityId: string | null;
  action: string;
  priorStatus: RegistrationRequestStatus | null;
  resultingStatus: RegistrationRequestStatus | null;
  outcome: RegistrationRequestEventOutcome;
  safeCategory: string | null;
  createdAt: Date;
}>;

export type RegistrationHistoryProjection = Readonly<{
  actor: string;
  at: string;
  action: string;
  fromStatus?: RegistrationRequestStatus;
  toStatus?: RegistrationRequestStatus;
  result: RegistrationRequestEventOutcome;
  category?: string;
}>;

const SAFE_CATEGORIES = new Set(['PROFILE', 'IDENTITY', 'EVIDENCE', 'SUBMISSION', 'ADMIN_DECISION', 'APPROVAL', 'SYSTEM']);

function map(event: RegistrationHistorySource, actor: string): RegistrationHistoryProjection {
  return Object.freeze({
    actor,
    at: event.createdAt.toISOString(),
    action: event.action,
    ...(event.priorStatus === null ? {} : { fromStatus: event.priorStatus }),
    ...(event.resultingStatus === null ? {} : { toStatus: event.resultingStatus }),
    result: event.outcome,
    ...(event.safeCategory !== null && SAFE_CATEGORIES.has(event.safeCategory) ? { category: event.safeCategory } : {}),
  });
}

export function mapApplicantRegistrationHistory(event: RegistrationHistorySource): RegistrationHistoryProjection {
  return map(event, event.actorIdentityId === null ? 'SYSTEM' : 'AUTHORIZED_ACTOR');
}

export function mapAdministratorRegistrationHistory(event: RegistrationHistorySource): RegistrationHistoryProjection {
  return map(event, event.actorIdentityId ?? 'SYSTEM');
}
