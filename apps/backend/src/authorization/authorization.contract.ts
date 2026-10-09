import type { FunctionalRole } from '../identity/role-assignment.service.js';

export const AUTHORIZATION_CONTRACT_VERSION = '1' as const;
export type DenialCategory = 'invalid-context' | 'anonymous-protected' | 'inactive-identity' | 'no-active-role' | 'absent-permission' | 'inactive-academy-membership' | 'missing-tutor-relationship' | 'insufficient-resource-facts' | 'sensitive-data-restriction';
type ResourceFacts = Readonly<{ classification: 'public' | 'protected' | 'sensitive'; academyId?: string; resourceId?: string; publicAuthorized?: boolean; minorPublicAuthorized?: boolean }>;
type ActiveRole = Readonly<{ role: FunctionalRole; active: boolean }>;
export type AuthorizationRequest = Readonly<{
  version: typeof AUTHORIZATION_CONTRACT_VERSION; permission: string; resource: ResourceFacts;
  subject: Readonly<{ kind: 'anonymous' }> | Readonly<{ kind: 'authenticated'; identityId: string; status: 'ACTIVE' | 'INACTIVE'; roles: readonly ActiveRole[]; academyMembership?: Readonly<{ active: boolean; academyId: string }>; tutorRelationship?: Readonly<{ active: boolean; resourceId: string }> }>;
}>;
export type AuthorizationDecision = Readonly<{ allowed: true; policyVersion: typeof AUTHORIZATION_CONTRACT_VERSION }> | Readonly<{ allowed: false; reason: DenialCategory; policyVersion: typeof AUTHORIZATION_CONTRACT_VERSION }>;
