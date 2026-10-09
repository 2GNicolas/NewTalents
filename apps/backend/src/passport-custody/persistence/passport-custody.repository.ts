import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';

import { PrismaService } from '../../database/prisma.service.js';

export type PassportCandidateCursor = Readonly<{ createdAt: Date; id: string }>;
export type AnalystCursor = Readonly<{ normalizedLabel: string; identityId: string }>;
export type PassportAssignmentFilter = 'ALL' | 'UNASSIGNED' | 'ASSIGNED';

export type PassportCandidate = Readonly<{
  id: string;
  createdAt: Date;
  state: 'ACTIVE';
  enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT';
  encryptedLegalName: string;
  academyLabel: string | null;
  custody: null | Readonly<{
    version: number;
    assignedAt: Date | null;
    currentAnalyst: null | Readonly<{ identityId: string; displayLabel: string }>;
    activeCustodyCount: number;
  }>;
}>;

export type EligibleAnalystRow = Readonly<{
  identityId: string;
  displayLabel: string;
  normalizedLabel: string;
  activeCustodyCount: number;
}>;

@Injectable()
export class PassportCustodyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPassportCandidates(input: Readonly<{
    state: 'ACTIVE';
    enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT';
    assignment: PassportAssignmentFilter;
    analystId?: string;
    cursor?: PassportCandidateCursor;
    take: number;
  }>): Promise<Readonly<{ rows: readonly PassportCandidate[]; hasMore: boolean }>> {
    const assignmentWhere: Prisma.PlayerPassportWhereInput = input.analystId
      ? { custody: { is: { currentAnalystIdentityId: input.analystId } } }
      : input.assignment === 'UNASSIGNED'
        ? { OR: [{ custody: { is: null } }, { custody: { is: { currentAnalystIdentityId: null } } }] }
        : input.assignment === 'ASSIGNED'
          ? { custody: { is: { currentAnalystIdentityId: { not: null } } } }
          : {};
    const cursorWhere: Prisma.PlayerPassportWhereInput = input.cursor ? {
      OR: [
        { createdAt: { lt: input.cursor.createdAt } },
        { createdAt: input.cursor.createdAt, id: { lt: input.cursor.id } },
      ],
    } : {};
    const rows = await this.prisma.playerPassport.findMany({
      where: {
        state: input.state,
        enrichmentStatus: input.enrichmentStatus,
        player: { privateIdentity: { isNot: null } },
        AND: [assignmentWhere, cursorWhere],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.take + 1,
      select: {
        id: true,
        createdAt: true,
        state: true,
        enrichmentStatus: true,
        player: { select: { privateIdentity: { select: { encryptedLegalName: true } } } },
        originAcademy: { select: { displayName: true } },
        custody: {
          select: {
            version: true,
            assignedAt: true,
            currentAnalyst: { select: { analystOperationalProfile: { select: { identityId: true, displayLabel: true } } } },
          },
        },
      },
    });
    const pageRows = rows.slice(0, input.take);
    const analystIds = [...new Set(pageRows.flatMap((row) => row.custody?.currentAnalyst?.analystOperationalProfile?.identityId ?? []))];
    const counts = analystIds.length ? await this.prisma.passportCustody.groupBy({
      by: ['currentAnalystIdentityId'],
      where: { currentAnalystIdentityId: { in: analystIds } },
      _count: { _all: true },
    }) : [];
    const workload = new Map(counts.map((row) => [row.currentAnalystIdentityId, row._count._all]));
    return {
      hasMore: rows.length > input.take,
      rows: pageRows.flatMap((row): PassportCandidate[] => {
        const encryptedLegalName = row.player.privateIdentity?.encryptedLegalName;
        if (!encryptedLegalName || row.state !== 'ACTIVE' || row.enrichmentStatus !== 'AWAITING_ANALYST_ENRICHMENT') return [];
        const profile = row.custody?.currentAnalyst?.analystOperationalProfile;
        return [{
          id: row.id,
          createdAt: row.createdAt,
          state: row.state,
          enrichmentStatus: row.enrichmentStatus,
          encryptedLegalName,
          academyLabel: row.originAcademy?.displayName ?? null,
          custody: row.custody ? {
            version: row.custody.version,
            assignedAt: row.custody.assignedAt,
            currentAnalyst: profile ? { identityId: profile.identityId, displayLabel: profile.displayLabel } : null,
            activeCustodyCount: profile ? workload.get(profile.identityId) ?? 0 : 0,
          } : null,
        }];
      }),
    };
  }

  async listEligibleAnalysts(input: Readonly<{ query?: string; cursor?: AnalystCursor; take: number }>): Promise<Readonly<{ rows: readonly EligibleAnalystRow[]; hasMore: boolean }>> {
    const rows = await this.prisma.analystOperationalProfile.findMany({
      where: {
        ...(input.query ? { normalizedLabel: { contains: input.query } } : {}),
        identity: { status: 'ACTIVE', roleAssignments: { some: { role: 'ANALYST', status: 'ACTIVE' } } },
        ...(input.cursor ? { OR: [
          { normalizedLabel: { gt: input.cursor.normalizedLabel } },
          { normalizedLabel: input.cursor.normalizedLabel, identityId: { gt: input.cursor.identityId } },
        ] } : {}),
      },
      orderBy: [{ normalizedLabel: 'asc' }, { identityId: 'asc' }],
      take: input.take + 1,
      select: { identityId: true, displayLabel: true, normalizedLabel: true },
    });
    const pageRows = rows.slice(0, input.take);
    const ids = pageRows.map((row) => row.identityId);
    const counts = ids.length ? await this.prisma.passportCustody.groupBy({
      by: ['currentAnalystIdentityId'],
      where: { currentAnalystIdentityId: { in: ids } },
      _count: { _all: true },
    }) : [];
    const workload = new Map(counts.map((row) => [row.currentAnalystIdentityId, row._count._all]));
    return {
      hasMore: rows.length > input.take,
      rows: pageRows.map((row) => ({ ...row, activeCustodyCount: workload.get(row.identityId) ?? 0 })),
    };
  }
}
