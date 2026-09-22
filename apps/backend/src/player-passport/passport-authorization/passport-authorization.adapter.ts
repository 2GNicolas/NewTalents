import { Injectable } from '@nestjs/common';

import { AUTHORIZATION_CONTRACT_VERSION, type AuthorizationDecision, type DenialCategory } from '../../authorization/authorization.contract.js';
import { AuthorizationService } from '../../authorization/authorization.service.js';
import { permissionCatalog, type Permission } from '../../authorization/permission-catalog.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { FunctionalRole } from '../../identity/role-assignment.service.js';

export type PassportPermission =
  | 'passport.tutor.create'
  | 'passport.particular.create'
  | 'passport.particular.manage'
  | 'passport.academy.create'
  | 'passport.tutor.manage'
  | 'passport.academy.manage'
  | 'passport.review'
  | 'passport.activate'
  | 'passport.history.tutor'
  | 'passport.history.particular'
  | 'passport.history.academy'
  | 'passport.history.internal';

export type PassportAuthorizationRequest = Readonly<{
  identityId: string;
  permission: PassportPermission;
  passportId?: string;
  academyId?: string;
}>;

type ResourceFacts = {
  classification: 'protected';
  academyId?: string;
  resourceId?: string;
};

type ActiveMembership = Readonly<{ academyId: string; status: 'ACTIVE' | 'ENDED' }>;
type InitialResponsibility = Readonly<{ playerId: string; tutorIdentityId: string }>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PASSPORT_PERMISSIONS = new Set<Permission>([
  'passport.tutor.create',
  'passport.particular.create',
  'passport.particular.manage',
  'passport.academy.create',
  'passport.tutor.manage',
  'passport.academy.manage',
  'passport.review',
  'passport.activate',
  'passport.history.tutor',
  'passport.history.particular',
  'passport.history.academy',
  'passport.history.internal',
]);

const OWNER_RESTRICTED_PERMISSIONS = new Set<PassportPermission>([
  'passport.tutor.manage',
  'passport.academy.manage',
  'passport.history.tutor',
  'passport.history.academy',
]);

@Injectable()
export class PassportAuthorizationAdapter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async authorize(request: PassportAuthorizationRequest): Promise<AuthorizationDecision> {
    if (!UUID_PATTERN.test(request.identityId) || !PASSPORT_PERMISSIONS.has(request.permission as Permission)) {
      return this.deny('invalid-context');
    }

    const identity = await this.prisma.identity.findUnique({
      where: { id: request.identityId },
      select: {
        status: true,
        roleAssignments: { where: { status: 'ACTIVE' }, select: { role: true } },
      },
    });
    if (!identity) return this.deny('inactive-identity');

    const rule = permissionCatalog[request.permission as Permission];
    let academyMembership: ActiveMembership | null = null;
    if (rule.academy) {
      const membership = await this.prisma.academyMembership.findFirst({
        where: { identityId: request.identityId, status: 'ACTIVE', identity: { status: 'ACTIVE' } },
        select: { academyId: true, status: true },
      });
      academyMembership = membership as ActiveMembership | null;
    }

    const resource: ResourceFacts = { classification: 'protected' };
    let tutorRelationship: Readonly<{ active: true; resourceId: string }> | undefined;
    let passport: Readonly<{ playerId: string; originAcademyId: string | null; createdByIdentityId: string; responsibilities: ReadonlyArray<{ kind: string; academyId: string | null }> }> | null = null;

    if (request.passportId && (rule.tutor || rule.academy || ('particular' in rule && rule.particular))) {
      if (!UUID_PATTERN.test(request.passportId)) return this.deny('insufficient-resource-facts');
      const found = await this.prisma.playerPassport.findUnique({
        where: { id: request.passportId },
        select: {
          id: true,
          playerId: true,
          originKind: true,
          originAcademyId: true,
          createdByIdentityId: true,
          responsibilities: { select: { kind: true, academyId: true } },
        },
      });
      if (!found) return this.deny('insufficient-resource-facts');
      passport = found;

      if (OWNER_RESTRICTED_PERMISSIONS.has(request.permission) && passport.createdByIdentityId !== request.identityId && !rule.academy) return this.deny('missing-tutor-relationship');

      if (rule.tutor) {
        const responsibility = await this.prisma.initialTutorResponsibility.findUnique({
          where: { playerId: passport.playerId },
          select: { playerId: true, tutorIdentityId: true },
        });
        if (!responsibility || responsibility.tutorIdentityId !== request.identityId) {
          return this.deny('missing-tutor-relationship');
        }
        resource.resourceId = responsibility.playerId;
        tutorRelationship = { active: true, resourceId: responsibility.playerId };
      }

      if (rule.academy) {
        if (!passport.originAcademyId) return this.deny('inactive-academy-membership');
        const originAcademyId = passport.originAcademyId;
        if (!passport.responsibilities.some((item) => item.kind === 'ACADEMY' && item.academyId === originAcademyId)) return this.deny('inactive-academy-membership');
        resource.academyId = originAcademyId;
      }
      if ('particular' in rule && rule.particular) {
        const responsibility = await this.prisma.passportResponsibility.findFirst({ where: { passportId: request.passportId, identityId: request.identityId, kind: { in: ['SELF', 'LEGAL_REPRESENTATIVE'] } }, select: { identityId: true } });
        if (!responsibility) return this.deny('missing-tutor-relationship');
        resource.resourceId = passport.playerId;
      }
    } else if (rule.academy) {
      const academyId = request.academyId ?? academyMembership?.academyId;
      if (!academyId) return this.deny('inactive-academy-membership');
      resource.academyId = academyId;
    }

    return this.authorization.evaluate({
      version: AUTHORIZATION_CONTRACT_VERSION,
      permission: request.permission,
      resource,
      subject: {
        kind: 'authenticated',
        identityId: request.identityId,
        status: identity.status,
        roles: identity.roleAssignments.map((assignment) => ({ role: assignment.role as FunctionalRole, active: true })),
        ...(academyMembership ? { academyMembership: { active: true, academyId: academyMembership.academyId } } : {}),
        ...(tutorRelationship ? { tutorRelationship } : {}),
      },
    });
  }

  async activeAcademyId(identityId: string): Promise<string | null> {
    if (!UUID_PATTERN.test(identityId)) return null;
    const membership = await this.prisma.academyMembership.findFirst({
      where: { identityId, status: 'ACTIVE', identity: { status: 'ACTIVE' } },
      select: { academyId: true },
    });
    return membership?.academyId ?? null;
  }

  private deny(reason: DenialCategory): AuthorizationDecision {
    return { allowed: false, reason, policyVersion: AUTHORIZATION_CONTRACT_VERSION };
  }
}
