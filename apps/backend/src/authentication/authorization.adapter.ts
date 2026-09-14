import { Injectable } from '@nestjs/common';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { AUTHORIZATION_CONTRACT_VERSION } from '../authorization/authorization.contract.js';
import type { FunctionalRole } from '../identity/role-assignment.service.js';
@Injectable()
export class AuthorizationAdapter {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService) {}
  async administrator(identityId: string): Promise<boolean> {
    const identity = await this.prisma.identity.findUnique({ where: { id: identityId }, include: { roleAssignments: { where: { status: 'ACTIVE' } } } });
    if (!identity) return false;
    return this.authorization.evaluate({ version: AUTHORIZATION_CONTRACT_VERSION, permission: 'foundation.privileged.role-change', resource: { classification: 'protected' }, subject: { kind: 'authenticated', identityId, status: identity.status, roles: identity.roleAssignments.map((r) => ({ role: r.role as FunctionalRole, active: true })) } }).allowed;
  }
}
