import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';

export type Membership = Readonly<{ id: string; academyId: string; status: 'ACTIVE' | 'ENDED' }>;
export type MembershipResult = Readonly<{ outcome: 'created' | 'ended' | 'conflict' | 'unknown-identity' | 'inactive-identity' | 'unknown-academy' | 'invalid' | 'not-found' | 'unavailable' }>;

export const opaqueId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

@Injectable()
export class AcademyMembershipService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(identityId: unknown, academyId: unknown, assignedByIdentityId: unknown): Promise<MembershipResult> {
    if (!opaqueId(identityId) || !opaqueId(academyId) || !opaqueId(assignedByIdentityId)) return { outcome: 'invalid' };
    try {
      const identity = await this.prisma.identity.findUnique({ where: { id: identityId }, select: { status: true } });
      if (!identity) return { outcome: 'unknown-identity' };
      if (identity.status !== 'ACTIVE') return { outcome: 'inactive-identity' };
      if (!await this.prisma.academy.findUnique({ where: { id: academyId }, select: { id: true } })) return { outcome: 'unknown-academy' };
      await this.prisma.academyMembership.create({ data: { identityId, academyId, assignedByIdentityId } });
      return { outcome: 'created' };
    } catch (error) {
      return this.code(error) === 'P2002' ? { outcome: 'conflict' } : this.code(error) === 'P2003' ? { outcome: 'unknown-identity' } : { outcome: 'unavailable' };
    }
  }

  async current(identityId: unknown): Promise<Membership | null> {
    if (!opaqueId(identityId)) return null;
    try {
      const membership = await this.prisma.academyMembership.findFirst({ where: { identityId, status: 'ACTIVE', identity: { status: 'ACTIVE' } }, select: { id: true, academyId: true, status: true } });
      return membership ? { ...membership } : null;
    } catch { return null; }
  }

  async history(identityId: unknown): Promise<Membership[]> {
    if (!opaqueId(identityId)) return [];
    try {
      const memberships = await this.prisma.academyMembership.findMany({ where: { identityId }, orderBy: { startedAt: 'asc' }, select: { id: true, academyId: true, status: true } });
      return memberships.map((membership) => ({ ...membership }));
    } catch { return []; }
  }

  async end(membershipId: unknown): Promise<MembershipResult> {
    if (!opaqueId(membershipId)) return { outcome: 'invalid' };
    try {
      const membership = await this.prisma.academyMembership.findFirst({ where: { id: membershipId, status: 'ACTIVE' }, select: { id: true } });
      if (!membership) return { outcome: 'not-found' };
      await this.prisma.academyMembership.update({ where: { id: membership.id }, data: { status: 'ENDED', endedAt: new Date() } });
      return { outcome: 'ended' };
    } catch { return { outcome: 'unavailable' }; }
  }

  private code(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  }
}
