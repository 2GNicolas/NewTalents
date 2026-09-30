import { Injectable } from '@nestjs/common';

import { AUTHORIZATION_CONTRACT_VERSION, type AuthorizationDecision, type DenialCategory, type ResourceFacts } from '../../authorization/authorization.contract.js';
import { AuthorizationService } from '../../authorization/authorization.service.js';
import { permissionCatalog, type Permission } from '../../authorization/permission-catalog.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { FunctionalRole } from '../../identity/role-assignment.service.js';

export type RegistrationPermission = Extract<Permission, `registration.${string}`>;

export type RegistrationAuthorizationRequest = Readonly<{
  identityId: string;
  permission: RegistrationPermission;
  requestId?: string;
  academyId?: string;
  expectedVersion?: number;
  academyResponsibleAuthority?: boolean;
  evidenceCompleteAndClean?: boolean;
  ageRouteCompatible?: boolean;
  representationComplete?: boolean;
  duplicateConflictAbsent?: boolean;
  manualDossierConfirmed?: boolean;
  deletionState?: ResourceFacts['deletionState'];
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class RegistrationAuthorizationAdapter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService = new AuthorizationService(),
  ) {}

  async authorize(input: RegistrationAuthorizationRequest): Promise<AuthorizationDecision> {
    if (!UUID_PATTERN.test(input.identityId) || !(input.permission in permissionCatalog) || !input.permission.startsWith('registration.')) return this.deny('invalid-context');
    if (input.requestId && !UUID_PATTERN.test(input.requestId)) return this.deny('insufficient-resource-facts');
    if (input.academyId && !UUID_PATTERN.test(input.academyId)) return this.deny('insufficient-resource-facts');

    const identity = await this.prisma.identity.findUnique({
      where: { id: input.identityId },
      select: {
        status: true,
        roleAssignments: { where: { status: 'ACTIVE' }, select: { role: true } },
        registrationApplicantAccesses: { where: { status: 'PENDING_ONBOARDING' }, select: { requestId: true, status: true } },
      },
    });
    if (!identity) return this.deny('insufficient-resource-facts');

    const request = input.requestId ? await this.prisma.registrationRequest.findUnique({
      where: { id: input.requestId },
      select: { id: true, ownerIdentityId: true, academyContextId: true, type: true, status: true, version: true },
    }) : null;
    if (input.requestId && !request) return this.deny('insufficient-resource-facts');

    const rule = permissionCatalog[input.permission];
    const academyScoped = rule.academy || Boolean(request?.academyContextId && input.permission.startsWith('registration.request.own.'));
    const requestedAcademyId = request?.academyContextId ?? input.academyId;
    const membership = academyScoped ? await this.prisma.academyMembership.findFirst({
      where: { identityId: input.identityId, status: 'ACTIVE', ...(requestedAcademyId ? { academyId: requestedAcademyId } : {}), identity: { status: 'ACTIVE' } },
      select: { academyId: true, status: true },
    }) : null;
    const academy = academyScoped && requestedAcademyId ? await this.prisma.academy.findUnique({ where: { id: requestedAcademyId }, select: { id: true } }) : null;
    const pendingAccess = identity.registrationApplicantAccesses.find((access) => access.requestId === input.requestId);
    const isPending = Boolean(pendingAccess) && identity.roleAssignments.length === 0;

    const resource: ResourceFacts = {
      classification: 'protected',
      ...(request ? {
        resourceId: request.id,
        requestOwner: request.ownerIdentityId === input.identityId,
        requestStatus: request.status,
        requestVersionCurrent: input.expectedVersion === undefined || request.version === input.expectedVersion,
      } : {}),
      ...(requestedAcademyId ? {
        academyId: requestedAcademyId,
        academyContextMatches: membership?.academyId === requestedAcademyId,
        academyApproved: Boolean(academy),
        academyMembershipActive: membership?.status === 'ACTIVE',
      } : {}),
      ...(input.academyResponsibleAuthority === undefined ? {} : { academyResponsibleAuthority: input.academyResponsibleAuthority }),
      ...(input.evidenceCompleteAndClean === undefined ? {} : { evidenceCompleteAndClean: input.evidenceCompleteAndClean }),
      ...(input.ageRouteCompatible === undefined ? {} : { ageRouteCompatible: input.ageRouteCompatible }),
      ...(input.representationComplete === undefined ? {} : { representationComplete: input.representationComplete }),
      ...(input.duplicateConflictAbsent === undefined ? {} : { duplicateConflictAbsent: input.duplicateConflictAbsent }),
      ...(input.manualDossierConfirmed === undefined ? {} : { manualDossierConfirmed: input.manualDossierConfirmed }),
      ...(input.deletionState === undefined ? {} : { deletionState: input.deletionState }),
      administratorCapability: input.permission.startsWith('registration.review.'),
    };

    return this.authorization.evaluate({
      version: AUTHORIZATION_CONTRACT_VERSION,
      permission: input.permission,
      resource,
      subject: {
        kind: 'authenticated',
        identityId: input.identityId,
        status: isPending ? 'PENDING_ONBOARDING' : identity.status,
        roles: identity.roleAssignments.map((assignment) => ({ role: assignment.role as FunctionalRole, active: true })),
        ...(pendingAccess ? { pendingAccess: { active: true, requestId: pendingAccess.requestId } } : {}),
        ...(membership ? { academyMembership: { active: membership.status === 'ACTIVE', academyId: membership.academyId } } : {}),
      },
    });
  }

  async projectCapabilities(input: Omit<RegistrationAuthorizationRequest, 'permission'>, permissions: readonly RegistrationPermission[]): Promise<RegistrationPermission[]> {
    const decisions = await Promise.all(permissions.map(async (permission) => ({ permission, decision: await this.authorize({ ...input, permission }) })));
    return decisions.filter(({ decision }) => decision.allowed).map(({ permission }) => permission);
  }

  private deny(reason: DenialCategory): AuthorizationDecision {
    return { allowed: false, reason, policyVersion: AUTHORIZATION_CONTRACT_VERSION };
  }
}
