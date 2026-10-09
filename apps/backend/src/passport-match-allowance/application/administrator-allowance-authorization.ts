import { Injectable } from '@nestjs/common';

import { AUTHORIZATION_CONTRACT_VERSION, type AuthorizationDecision } from '../../authorization/authorization.contract.js';
import { AuthorizationService } from '../../authorization/authorization.service.js';
import type { Permission } from '../../authorization/permission-catalog.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { FunctionalRole } from '../../identity/role-assignment.service.js';

export type AllowancePermission = Extract<Permission, `passport.allowance.${string}`>;

@Injectable()
export class AdministratorAllowanceAuthorization {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService) {}

  async authorize(identityId: string, permission: AllowancePermission, passport?: Readonly<{ exists: boolean; active: boolean }>, reader: Prisma.TransactionClient | PrismaService = this.prisma): Promise<AuthorizationDecision> {
    const identity = await reader.identity.findUnique({
      where: { id: identityId },
      select: { status: true, roleAssignments: { where: { status: 'ACTIVE' }, select: { role: true } } },
    });
    if (!identity) return { allowed: false, reason: 'insufficient-resource-facts', policyVersion: AUTHORIZATION_CONTRACT_VERSION };
    return this.authorization.evaluate({
      version: AUTHORIZATION_CONTRACT_VERSION,
      permission,
      subject: { kind: 'authenticated', identityId, status: identity.status,
        roles: identity.roleAssignments.map(({ role }) => ({ role: role as FunctionalRole, active: true })) },
      resource: { classification: 'protected', administratorCapability: true,
        passportExists: passport?.exists, passportActive: passport?.active },
    });
  }
}
