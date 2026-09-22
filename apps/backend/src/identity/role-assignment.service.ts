import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';

export const functionalRoles = ['ADMINISTRATOR', 'ANALYST', 'USER', 'TUTOR', 'ACADEMY_USER'] as const;
export type FunctionalRole = (typeof functionalRoles)[number];
export type RoleAssignmentResult = Readonly<{ outcome: 'assigned' | 'revoked' | 'duplicate-active-role' | 'unknown-identity' | 'inactive-identity' | 'invalid' | 'not-found' | 'unavailable' }>;

const opaqueIdentityId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const validRole = (value: unknown): value is FunctionalRole =>
  typeof value === 'string' && (functionalRoles as readonly string[]).includes(value);

@Injectable()
export class RoleAssignmentService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assign(identityId: unknown, role: unknown, assignedByIdentityId: unknown): Promise<RoleAssignmentResult> {
    if (!opaqueIdentityId(identityId) || !opaqueIdentityId(assignedByIdentityId) || !validRole(role)) {
      return { outcome: 'invalid' };
    }

    try {
      const identity = await this.prisma.identity.findUnique({
        where: { id: identityId },
        select: { status: true },
      });
      if (!identity) return { outcome: 'unknown-identity' };
      if (identity.status !== 'ACTIVE') return { outcome: 'inactive-identity' };

      await this.prisma.roleAssignment.create({
        data: { identityId, role, assignedByIdentityId },
      });
      return { outcome: 'assigned' };
    } catch (error: unknown) {
      if (this.prismaErrorCode(error) === 'P2002') return { outcome: 'duplicate-active-role' };
      if (this.prismaErrorCode(error) === 'P2003') return { outcome: 'unknown-identity' };
      return { outcome: 'unavailable' };
    }
  }

  async revoke(roleAssignmentId: unknown): Promise<RoleAssignmentResult> {
    if (!opaqueIdentityId(roleAssignmentId)) return { outcome: 'invalid' };

    try {
      const assignment = await this.prisma.roleAssignment.findFirst({
        where: { id: roleAssignmentId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!assignment) return { outcome: 'not-found' };
      await this.prisma.roleAssignment.update({
        where: { id: assignment.id },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      return { outcome: 'revoked' };
    } catch {
      return { outcome: 'unavailable' };
    }
  }

  async findActiveRoles(identityId: unknown): Promise<FunctionalRole[]> {
    if (!opaqueIdentityId(identityId)) return [];

    try {
      const assignments = await this.prisma.roleAssignment.findMany({
        where: { identityId, status: 'ACTIVE', identity: { status: 'ACTIVE' } },
        select: { role: true },
      });
      return assignments.map((assignment) => assignment.role as FunctionalRole);
    } catch {
      return [];
    }
  }

  private prismaErrorCode(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
    return typeof error.code === 'string' ? error.code : undefined;
  }
}
