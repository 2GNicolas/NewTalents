import { Injectable } from '@nestjs/common';

import { AUTHORIZATION_CONTRACT_VERSION, type AuthorizationDecision } from '../../authorization/authorization.contract.js';
import { AuthorizationService } from '../../authorization/authorization.service.js';
import type { Permission } from '../../authorization/permission-catalog.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { FunctionalRole } from '../../identity/role-assignment.service.js';

export type PassportCustodyAdministratorPermission = Extract<Permission, `passport.custody.${string}`>;

@Injectable()
export class PassportCustodyAuthorizationAdapter {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService) {}

  async authorizeAdministrator(identityId: string, permission: PassportCustodyAdministratorPermission): Promise<AuthorizationDecision> {
    const identity = await this.prisma.identity.findUnique({
      where: { id: identityId },
      select: { status: true, roleAssignments: { where: { status: 'ACTIVE' }, select: { role: true } } },
    });
    if (!identity) return { allowed: false, reason: 'insufficient-resource-facts', policyVersion: AUTHORIZATION_CONTRACT_VERSION };
    return this.authorization.evaluate({
      version: AUTHORIZATION_CONTRACT_VERSION,
      permission,
      subject: {
        kind: 'authenticated',
        identityId,
        status: identity.status,
        roles: identity.roleAssignments.map(({ role }) => ({ role: role as FunctionalRole, active: true })),
      },
      resource: {
        classification: 'protected',
        administratorCapability: true,
        passportBasicActive: true,
        custodyVersionCurrent: true,
        custodyAssigned: permission !== 'passport.custody.assign',
        targetAnalystEligible: true,
      },
    });
  }
}
