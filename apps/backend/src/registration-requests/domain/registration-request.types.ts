export const REGISTRATION_REQUEST_TYPES = Object.freeze([
  'PERSONAL_ADULT', 'REPRESENTED_MINOR', 'FORMAL_ACADEMY', 'NATURAL_PERSON_ACADEMY',
  'ADDITIONAL_ACADEMY_ACCOUNT', 'ACADEMY_ADULT_PLAYER', 'ACADEMY_MINOR_PLAYER',
] as const);

export type RegistrationRequestType = typeof REGISTRATION_REQUEST_TYPES[number];
export type RegistrationRequestStatus = 'DRAFT' | 'SUBMITTED' | 'REQUIRES_CORRECTION' | 'APPROVED' | 'REJECTED';
export type ApprovalExecutionStatus = 'NONE' | 'PREPARED' | 'DELETING_EVIDENCE' | 'READY_TO_FINALIZE' | 'FINALIZED' | 'RECOVERY_REQUIRED';
export type EvidenceStatus = 'QUARANTINED' | 'SCANNING' | 'CLEAN' | 'REJECTED' | 'REPLACED' | 'DELETION_PENDING' | 'DELETED';
export type EvidenceDeletionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'RECOVERY_REQUIRED';

export type PersonalAdultDetail = Readonly<{ type: 'PERSONAL_ADULT'; applicantId: string; playerId: string; actingForSelf: true }>;
export type RepresentedMinorDetail = Readonly<{ type: 'REPRESENTED_MINOR'; applicantId: string; playerId: string; relationship: 'MOTHER' | 'FATHER' | 'LEGAL_GUARDIAN'; authorityDeclared: true }>;
export type FormalAcademyDetail = Readonly<{ type: 'FORMAL_ACADEMY'; responsibleApplicantId: string; authorityDeclared: true }>;
export type NaturalPersonAcademyDetail = Readonly<{ type: 'NATURAL_PERSON_ACADEMY'; responsibleApplicantId: string; operationDeclared: true; proofCategories: readonly string[] }>;
export type AdditionalAcademyAccountDetail = Readonly<{ type: 'ADDITIONAL_ACADEMY_ACCOUNT'; applicantId: string; responsibleAuthorization: true }>;
export type AcademyAdultPlayerDetail = Readonly<{ type: 'ACADEMY_ADULT_PLAYER'; playerId: string; adultAuthorization: true }>;
export type AcademyMinorPlayerDetail = Readonly<{ type: 'ACADEMY_MINOR_PLAYER'; playerId: string; representativeId: string; authorityDeclared: true }>;

export type RegistrationRequestDetail =
  | PersonalAdultDetail | RepresentedMinorDetail | FormalAcademyDetail | NaturalPersonAcademyDetail
  | AdditionalAcademyAccountDetail | AcademyAdultPlayerDetail | AcademyMinorPlayerDetail;

export type RegistrationRequestSnapshot = Readonly<{
  id: string;
  type: RegistrationRequestType;
  status: RegistrationRequestStatus;
  version: number;
  approvalExecutionStatus: ApprovalExecutionStatus;
}>;

export type RegistrationRequestAction =
  | 'UPDATE' | 'SUBMIT' | 'REQUEST_CORRECTION' | 'RESUBMIT' | 'REJECT' | 'PREPARE_APPROVAL' | 'FINALIZE_APPROVAL';

export type RegistrationRequestCommand = Readonly<{
  action: RegistrationRequestAction;
  expectedVersion: number;
  actorId: string;
  safeCategory?: string;
}>;

export type RegistrationRequestSafeEvent = Readonly<{
  actorId: string;
  action: 'UPDATED' | 'SUBMITTED' | 'CORRECTION_REQUESTED' | 'RESUBMITTED' | 'REJECTED' | 'APPROVAL_PREPARED' | 'APPROVED';
  outcome: 'APPLIED';
  priorStatus: RegistrationRequestStatus;
  resultingStatus: RegistrationRequestStatus;
  requestVersion: number;
  safeCategory?: string;
}>;

export type RegistrationTransitionResult = Readonly<{
  snapshot: RegistrationRequestSnapshot;
  event: RegistrationRequestSafeEvent;
}>;
