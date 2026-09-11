import { Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

import { PrismaService } from '../database/prisma.service.js';
import { opaqueId } from './academy-membership.service.js';

export const MEMBERSHIP_TOTAL_ATTEMPTS = 3;
export const MEMBERSHIP_RETRY_DELAYS_MS = [50, 100] as const;
export type MembershipTransitionResult = Readonly<{ outcome: 'transitioned' | 'conflict' | 'unknown-identity' | 'inactive-identity' | 'unknown-academy' | 'already-current' | 'invalid' | 'unavailable' }>;
type Delay = (milliseconds: number) => Promise<void>;
const wait: Delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
export const MEMBERSHIP_DELAY = Symbol('MEMBERSHIP_DELAY');

@Injectable()
export class MembershipTransitionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(MEMBERSHIP_DELAY) private readonly delay: Delay = wait,
  ) {}

  async transition(identityId: unknown, academyId: unknown, assignedByIdentityId: unknown): Promise<MembershipTransitionResult> {
    if (!opaqueId(identityId) || !opaqueId(academyId) || !opaqueId(assignedByIdentityId)) return { outcome: 'invalid' };
    for (let attempt = 0; attempt < MEMBERSHIP_TOTAL_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (transaction) => this.inTransaction(transaction, identityId, academyId, assignedByIdentityId),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (this.code(error) !== 'P2034') return this.code(error) === 'P2002' || this.code(error) === 'P2003' ? { outcome: 'conflict' } : { outcome: 'unavailable' };
        if (attempt === MEMBERSHIP_TOTAL_ATTEMPTS - 1) return { outcome: 'conflict' };
        await this.delay(MEMBERSHIP_RETRY_DELAYS_MS[attempt]!);
      }
    }
    return { outcome: 'conflict' };
  }

  private async inTransaction(transaction: Prisma.TransactionClient, identityId: string, academyId: string, assignedByIdentityId: string): Promise<MembershipTransitionResult> {
    const identity = await transaction.identity.findUnique({ where: { id: identityId }, select: { status: true } });
    if (!identity) return { outcome: 'unknown-identity' };
    if (identity.status !== 'ACTIVE') return { outcome: 'inactive-identity' };
    if (!await transaction.academy.findUnique({ where: { id: academyId }, select: { id: true } })) return { outcome: 'unknown-academy' };
    const current = await transaction.academyMembership.findFirst({ where: { identityId, status: 'ACTIVE' }, select: { id: true, academyId: true } });
    if (current?.academyId === academyId) return { outcome: 'already-current' };
    if (current) await transaction.academyMembership.update({ where: { id: current.id }, data: { status: 'ENDED', endedAt: new Date() } });
    await transaction.academyMembership.create({ data: { identityId, academyId, assignedByIdentityId } });
    return { outcome: 'transitioned' };
  }

  private code(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  }
}
