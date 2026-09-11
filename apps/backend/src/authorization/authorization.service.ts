import { AUTHORIZATION_CONTRACT_VERSION, type AuthorizationDecision, type AuthorizationRequest, type DenialCategory } from './authorization.contract.js';
import { isPermission, permissionCatalog } from './permission-catalog.js';

const deny = (reason: DenialCategory): AuthorizationDecision => ({ allowed: false, reason, policyVersion: AUTHORIZATION_CONTRACT_VERSION });
const allow = (): AuthorizationDecision => ({ allowed: true, policyVersion: AUTHORIZATION_CONTRACT_VERSION });

export class AuthorizationService {
  evaluate(request: unknown): AuthorizationDecision {
    if (!this.valid(request)) return deny('invalid-context');
    if (!isPermission(request.permission)) return deny('absent-permission');
    const rule = permissionCatalog[request.permission];
    if (request.subject.kind === 'anonymous') {
      if (!rule.anonymous) return deny('anonymous-protected');
      return request.resource.classification === 'public' && request.resource.publicAuthorized === true && request.resource.minorPublicAuthorized === true
        ? allow() : deny(request.resource.classification === 'sensitive' ? 'sensitive-data-restriction' : 'anonymous-protected');
    }
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

  private valid(request: unknown): request is AuthorizationRequest {
    if (typeof request !== 'object' || request === null) return false;
    const candidate = request as Partial<AuthorizationRequest>;
    if (candidate.version !== AUTHORIZATION_CONTRACT_VERSION || typeof candidate.permission !== 'string' || !candidate.resource || !candidate.subject) return false;
    if (!['public', 'protected', 'sensitive'].includes(candidate.resource.classification)) return false;
    if (candidate.subject.kind === 'anonymous') return true;
    return candidate.subject.kind === 'authenticated' && typeof candidate.subject.identityId === 'string' && ['ACTIVE', 'INACTIVE'].includes(candidate.subject.status) && Array.isArray(candidate.subject.roles) && candidate.subject.roles.every((role) => typeof role === 'object' && role !== null && typeof role.active === 'boolean' && typeof role.role === 'string');
  }
}
