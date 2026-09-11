import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import type { AuthorizationRequest } from '../authorization/authorization.contract.js';
import { PrismaService } from '../database/prisma.service.js';
import { ChangeAuditService } from './change-audit.service.js';

export type PrivilegedChangeResult = Readonly<{ outcome: 'applied' | 'denied' | 'invalid' | 'conflict' | 'unavailable' }>;
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const roles = ['ADMINISTRATOR', 'ANALYST', 'TUTOR', 'ACADEMY_USER'] as const;

@Injectable()
export class PrivilegedChangesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(ChangeAuditService) private readonly audit = new ChangeAuditService(),
  ) {}
  async assignRole(actor: AuthorizationRequest, targetId: unknown, role: unknown): Promise<PrivilegedChangeResult> {
    return this.execute(actor, targetId, 'foundation.privileged.role-change', 'ROLE_ASSIGNED', async (tx, target) => {
      if (!(roles as readonly unknown[]).includes(role)) return false;
      const identity = await tx.identity.findUnique({ where: { id: target }, select: { status: true } });
      if (identity?.status !== 'ACTIVE') return false;
      await tx.roleAssignment.create({ data: { identityId: target, role: role as (typeof roles)[number], assignedByIdentityId: actor.subject.kind === 'authenticated' ? actor.subject.identityId : target } }); return true;
    });
  }
  async revokeRole(actor: AuthorizationRequest, assignmentId: unknown, targetId: unknown): Promise<PrivilegedChangeResult> {
    return this.execute(actor, targetId, 'foundation.privileged.role-change', 'ROLE_REVOKED', async (tx) => { if (!uuid(assignmentId)) return false; const row = await tx.roleAssignment.findFirst({ where: { id: assignmentId, status: 'ACTIVE' }, select: { id: true } }); if (!row) return false; await tx.roleAssignment.update({ where: { id: row.id }, data: { status: 'REVOKED', revokedAt: new Date() } }); return true; });
  }
  async assignMembership(actor: AuthorizationRequest, targetId: unknown, academyId: unknown): Promise<PrivilegedChangeResult> {
    return this.execute(actor, targetId, 'foundation.privileged.membership-change', 'MEMBERSHIP_ASSIGNED', async (tx, target) => { if (!uuid(academyId)) return false; const identity = await tx.identity.findUnique({ where: { id: target }, select: { status: true } }); const academy = await tx.academy.findUnique({ where: { id: academyId }, select: { id: true } }); if (identity?.status !== 'ACTIVE' || !academy) return false; await tx.academyMembership.create({ data: { identityId: target, academyId, assignedByIdentityId: actor.subject.kind === 'authenticated' ? actor.subject.identityId : target } }); return true; });
  }
  async changeMembership(actor: AuthorizationRequest, targetId: unknown, academyId: unknown): Promise<PrivilegedChangeResult> {
    return this.execute(actor, targetId, 'foundation.privileged.membership-change', 'MEMBERSHIP_CHANGED', async (tx, target) => { if (!uuid(academyId) || !await tx.academy.findUnique({ where: { id: academyId }, select: { id: true } })) return false; const current = await tx.academyMembership.findFirst({ where: { identityId: target, status: 'ACTIVE' }, select: { id: true, academyId: true } }); if (!current || current.academyId === academyId) return false; await tx.academyMembership.update({ where: { id: current.id }, data: { status: 'ENDED', endedAt: new Date() } }); await tx.academyMembership.create({ data: { identityId: target, academyId, assignedByIdentityId: actor.subject.kind === 'authenticated' ? actor.subject.identityId : target } }); return true; });
  }
  async revokeMembership(actor: AuthorizationRequest, membershipId: unknown, targetId: unknown): Promise<PrivilegedChangeResult> {
    return this.execute(actor, targetId, 'foundation.privileged.membership-change', 'MEMBERSHIP_REVOKED', async (tx) => { if (!uuid(membershipId)) return false; const current = await tx.academyMembership.findFirst({ where: { id: membershipId, status: 'ACTIVE' }, select: { id: true } }); if (!current) return false; await tx.academyMembership.update({ where: { id: current.id }, data: { status: 'ENDED', endedAt: new Date() } }); return true; });
  }
  private async execute(actor: AuthorizationRequest, targetId: unknown, permission: string, operation: string, mutation: (tx: Prisma.TransactionClient, target: string) => Promise<boolean>): Promise<PrivilegedChangeResult> {
    if (!uuid(targetId) || actor.subject.kind !== 'authenticated') return { outcome: 'invalid' };
    const decision = this.authorization.evaluate({ ...actor, permission, resource: { classification: 'protected' } });
    const actorId = actor.subject.identityId;
    if (!decision.allowed) { try { await this.prisma.$transaction((tx) => this.audit.record(tx, actorId, targetId, operation, 'DENIED', decision.reason)); } catch {} return { outcome: 'denied' }; }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try { return await this.prisma.$transaction(async (tx) => { const changed = await mutation(tx, targetId); if (!changed) { await this.audit.record(tx, actorId, targetId, operation, 'DENIED', 'invalid-context'); return { outcome: 'denied' } as const; } await this.audit.record(tx, actorId, targetId, operation, 'APPLIED', 'none'); return { outcome: 'applied' } as const; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
      catch (error) { const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined; if (code !== 'P2034') return code === 'P2002' ? { outcome: 'conflict' } : { outcome: 'unavailable' }; if (attempt === 2) return { outcome: 'conflict' }; await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 50 : 100)); }
    }
    return { outcome: 'conflict' };
  }
}
