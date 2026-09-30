import { AUTHORIZATION_CONTRACT_VERSION, type AuthorizationDecision, type AuthorizationRequest, type DenialCategory } from './authorization.contract.js';
import { isPermission, permissionCatalog } from './permission-catalog.js';

const deny = (reason: DenialCategory): AuthorizationDecision => ({ allowed: false, reason, policyVersion: AUTHORIZATION_CONTRACT_VERSION });
const allow = (): AuthorizationDecision => ({ allowed: true, policyVersion: AUTHORIZATION_CONTRACT_VERSION });

export class AuthorizationService {
  evaluate(request: unknown): AuthorizationDecision {
    if (!this.valid(request)) return deny('invalid-context');
    if (!isPermission(request.permission)) return deny('absent-permission');
    const rule = permissionCatalog[request.permission];
    const registrationPolicy = 'registrationPolicy' in rule ? rule.registrationPolicy : undefined;
    if (request.subject.kind === 'anonymous') {
      if (!rule.anonymous) return deny('anonymous-protected');
      if (registrationPolicy === 'public-create') {
        return request.resource.classification === 'public' && request.resource.supportedRegistrationType === true ? allow() : deny('anonymous-protected');
      }
      return request.resource.classification === 'public' && request.resource.publicAuthorized === true && request.resource.minorPublicAuthorized === true
        ? allow() : deny(request.resource.classification === 'sensitive' ? 'sensitive-data-restriction' : 'anonymous-protected');
    }
    if (registrationPolicy) return this.evaluateRegistration(request as AuthorizationRequest & { subject: Extract<AuthorizationRequest['subject'], { kind: 'authenticated' }> }, rule.roles as readonly string[], registrationPolicy);
    if (request.subject.status === 'PENDING_ONBOARDING') return deny('pending-access-restriction');
    if (request.subject.status !== 'ACTIVE') return deny('inactive-identity');
    if (request.resource.classification === 'sensitive') return deny('sensitive-data-restriction');
    if (!request.subject.roles.some((assignment) => assignment.active && (rule.roles as readonly string[]).includes(assignment.role))) return deny('no-active-role');
    if (rule.academy) {
      const membership = request.subject.academyMembership;
      if (!membership || !request.resource.academyId || !membership.active || membership.academyId !== request.resource.academyId) return deny('inactive-academy-membership');
    }
    if (rule.tutor) {
      const relationship = request.subject.tutorRelationship;
      if (!relationship || !request.resource.resourceId || !relationship.active || relationship.resourceId !== request.resource.resourceId) return deny('missing-tutor-relationship');
    }
    return allow();
  }

  private evaluateRegistration(
    request: AuthorizationRequest & { subject: Extract<AuthorizationRequest['subject'], { kind: 'authenticated' }> },
    roles: readonly string[],
    policy: string,
  ): AuthorizationDecision {
    const { resource, subject } = request;
    if (resource.classification === 'sensitive') return deny('sensitive-data-restriction');
    if (subject.status === 'INACTIVE') return deny('inactive-identity');

    if (policy.startsWith('own-')) {
      const pendingOwner = subject.pendingAccess?.active === true && subject.pendingAccess.requestId === resource.resourceId;
      const academyOwner = subject.status === 'ACTIVE'
        && subject.roles.some((assignment) => assignment.active && assignment.role === 'ACADEMY_USER')
        && subject.academyMembership?.active === true
        && subject.academyMembership.academyId === resource.academyId
        && resource.academyContextMatches === true
        && resource.academyMembershipActive === true
        && resource.academyApproved === true;
      if ((!pendingOwner && !academyOwner) || !resource.resourceId || resource.requestOwner !== true) return deny('insufficient-resource-facts');
      if (policy === 'own-view') return allow();
      if (resource.requestVersionCurrent !== true) return deny('insufficient-resource-facts');
      if (policy === 'own-draft') return resource.requestStatus === 'DRAFT' ? allow() : deny('insufficient-resource-facts');
      if (policy === 'own-correction') return resource.requestStatus === 'REQUIRES_CORRECTION' ? allow() : deny('insufficient-resource-facts');
      if (policy === 'own-editable') return resource.requestStatus === 'DRAFT' || resource.requestStatus === 'REQUIRES_CORRECTION' ? allow() : deny('insufficient-resource-facts');
      const correctState = policy === 'own-submit' ? resource.requestStatus === 'DRAFT' : resource.requestStatus === 'REQUIRES_CORRECTION';
      return correctState && resource.evidenceCompleteAndClean === true && resource.ageRouteCompatible === true && resource.representationComplete === true ? allow() : deny('insufficient-resource-facts');
    }

    if (subject.status !== 'ACTIVE') return deny('pending-access-restriction');
    if (!subject.roles.some((assignment) => assignment.active && roles.includes(assignment.role))) return deny('no-active-role');

    if (policy.startsWith('academy-')) {
      const membership = subject.academyMembership;
      if (!membership || !resource.academyId || !membership.active || membership.academyId !== resource.academyId || resource.academyMembershipActive !== true || resource.academyApproved !== true || resource.academyContextMatches !== true) return deny('inactive-academy-membership');
      return policy !== 'academy-responsible-create' || resource.academyResponsibleAuthority === true ? allow() : deny('insufficient-resource-facts');
    }

    if (resource.administratorCapability !== true) return deny('insufficient-resource-facts');
    if (policy === 'admin-view') return allow();
    if (policy === 'admin-retry-deletion') return resource.deletionState === 'RECOVERY_REQUIRED' ? allow() : deny('insufficient-resource-facts');
    if (resource.requestStatus !== 'SUBMITTED' || resource.requestVersionCurrent !== true) return deny('insufficient-resource-facts');
    if (policy === 'admin-evidence') return resource.evidenceCompleteAndClean === true ? allow() : deny('insufficient-resource-facts');
    if (policy === 'admin-dossier') return resource.evidenceCompleteAndClean === true && resource.duplicateConflictAbsent === true ? allow() : deny('insufficient-resource-facts');
    if (policy === 'admin-approve') {
      return resource.manualDossierConfirmed === true && resource.deletionState === 'COMPLETED' && resource.duplicateConflictAbsent === true && resource.ageRouteCompatible === true && resource.representationComplete === true ? allow() : deny('insufficient-resource-facts');
    }
    return allow();
  }

  private valid(request: unknown): request is AuthorizationRequest {
    if (typeof request !== 'object' || request === null) return false;
    const candidate = request as Partial<AuthorizationRequest>;
    if (candidate.version !== AUTHORIZATION_CONTRACT_VERSION || typeof candidate.permission !== 'string' || !candidate.resource || !candidate.subject) return false;
    if (!['public', 'protected', 'sensitive'].includes(candidate.resource.classification)) return false;
    if (candidate.subject.kind === 'anonymous') return true;
    return candidate.subject.kind === 'authenticated' && typeof candidate.subject.identityId === 'string' && ['ACTIVE', 'INACTIVE', 'PENDING_ONBOARDING'].includes(candidate.subject.status) && Array.isArray(candidate.subject.roles) && candidate.subject.roles.every((role) => typeof role === 'object' && role !== null && typeof role.active === 'boolean' && typeof role.role === 'string');
  }
}
