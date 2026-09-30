import type { FunctionalRole } from '../identity/role-assignment.service.js';

export const AUTHORIZATION_CONTRACT_VERSION = '1' as const;
export type DenialCategory = 'invalid-context' | 'anonymous-protected' | 'inactive-identity' | 'no-active-role' | 'absent-permission' | 'inactive-academy-membership' | 'missing-tutor-relationship' | 'insufficient-resource-facts' | 'sensitive-data-restriction' | 'pending-access-restriction';
export type RegistrationRequestState = 'DRAFT' | 'SUBMITTED' | 'REQUIRES_CORRECTION' | 'APPROVED' | 'REJECTED';
export type RegistrationDeletionState = 'NONE' | 'PENDING' | 'COMPLETED' | 'RECOVERY_REQUIRED';
export type ResourceFacts = Readonly<{
  classification: 'public' | 'protected' | 'sensitive';
  academyId?: string;
  resourceId?: string;
  publicAuthorized?: boolean;
  minorPublicAuthorized?: boolean;
  supportedRegistrationType?: boolean;
  requestOwner?: boolean;
  requestStatus?: RegistrationRequestState;
  requestVersionCurrent?: boolean;
  academyContextMatches?: boolean;
  academyApproved?: boolean;
  academyMembershipActive?: boolean;
  academyResponsibleAuthority?: boolean;
  evidenceCompleteAndClean?: boolean;
  ageRouteCompatible?: boolean;
  representationComplete?: boolean;
  duplicateConflictAbsent?: boolean;
  manualDossierConfirmed?: boolean;
  deletionState?: RegistrationDeletionState;
  administratorCapability?: boolean;
}>;
type ActiveRole = Readonly<{ role: FunctionalRole; active: boolean }>;
export type AuthorizationRequest = Readonly<{
  version: typeof AUTHORIZATION_CONTRACT_VERSION; permission: string; resource: ResourceFacts;
  subject: Readonly<{ kind: 'anonymous' }> | Readonly<{ kind: 'authenticated'; identityId: string; status: 'ACTIVE' | 'INACTIVE' | 'PENDING_ONBOARDING'; roles: readonly ActiveRole[]; academyMembership?: Readonly<{ active: boolean; academyId: string }>; tutorRelationship?: Readonly<{ active: boolean; resourceId: string }>; pendingAccess?: Readonly<{ active: boolean; requestId: string }> }>;
}>;
export type AuthorizationDecision = Readonly<{ allowed: true; policyVersion: typeof AUTHORIZATION_CONTRACT_VERSION }> | Readonly<{ allowed: false; reason: DenialCategory; policyVersion: typeof AUTHORIZATION_CONTRACT_VERSION }>;
