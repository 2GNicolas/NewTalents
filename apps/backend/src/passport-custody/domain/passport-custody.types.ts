export const REGISTRATION_ADMIN_REVIEW_STAGES = ['OPENED', 'REVIEWED'] as const;
export type RegistrationAdminReviewStage = (typeof REGISTRATION_ADMIN_REVIEW_STAGES)[number];

export const PASSPORT_CUSTODY_ACTIONS = ['ASSIGNED', 'CHANGED', 'REMOVED'] as const;
export type PassportCustodyAction = (typeof PASSPORT_CUSTODY_ACTIONS)[number];

export type PassportCustodyState = 'UNASSIGNED' | 'ASSIGNED';

export type AnalystOperationalProjection = Readonly<{
  identityId: string;
  displayLabel: string;
  activeCustodyCount: number;
}>;

export type PassportCustodyProjection = Readonly<{
  state: PassportCustodyState;
  version: number;
  analyst: AnalystOperationalProjection | null;
  assignedAt: Date | null;
}>;

export type PassportCustodyEventProjection = Readonly<{
  eventId: string;
  passportId: string;
  sequence: number;
  action: PassportCustodyAction;
  administratorIdentityId: string;
  previousAnalystIdentityId: string | null;
  nextAnalystIdentityId: string | null;
  safeReason: string | null;
  expectedVersion: number;
  resultingVersion: number;
  idempotencyKey: string;
  createdAt: Date;
}>;

export const ABSENT_PASSPORT_CUSTODY: PassportCustodyProjection = Object.freeze({
  state: 'UNASSIGNED',
  version: 0,
  analyst: null,
  assignedAt: null,
});

export function projectAbsentPassportCustody(): PassportCustodyProjection {
  return ABSENT_PASSPORT_CUSTODY;
}
