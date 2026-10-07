import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { PassportCustodyQueryService, type CustodyPassportSummary } from './passport-custody-query.service.js';

type AnalystPage = Readonly<{ items: readonly CustodyPassportSummary[]; nextCursor?: string }>;
type AnalystQueryFailure = Readonly<{ outcome: 'forbidden' | 'invalid-cursor' | 'unavailable' }>;

@Injectable()
export class AnalystPassportsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly custody: PassportCustodyQueryService,
  ) {}

  async list(input: Readonly<{ identityId: string; cursor?: string; limit: number }>): Promise<AnalystPage | AnalystQueryFailure> {
    const identity = await this.prisma.identity.findUnique({
      where: { id: input.identityId },
      select: { status: true, roleAssignments: { where: { status: 'ACTIVE' }, select: { role: true } }, analystOperationalProfile: { select: { identityId: true } } },
    });
    if (!identity || identity.status !== 'ACTIVE' || !identity.analystOperationalProfile || !identity.roleAssignments.some((assignment) => assignment.role === 'ANALYST')) {
      return { outcome: 'forbidden' };
    }
    return this.custody.listPassports({
      assignment: 'ASSIGNED',
      analystId: input.identityId,
      limit: input.limit,
      ...(input.cursor ? { cursor: input.cursor } : {}),
    });
  }
}
