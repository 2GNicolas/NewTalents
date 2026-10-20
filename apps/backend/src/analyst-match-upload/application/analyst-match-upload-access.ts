import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';

const validatedUploadScope: unique symbol = Symbol('validated analyst match upload scope');

export type AuthorizedUploadMatch = Readonly<{
  id: string;
  passportId: string;
  playerId: string;
  state: 'WAITING' | 'LOADED' | 'CANCELED';
  unitState: 'RESERVED' | 'USED' | 'RELEASED';
  version: number;
  sourceKind: 'FIRST_MATCH';
}>;

export type AnalystUploadScope = Readonly<{
  actorIdentityId: string;
  match: AuthorizedUploadMatch;
  tx: Prisma.TransactionClient;
  [validatedUploadScope]: true;
}>;

export class AnalystMatchUploadAccessError extends Error {
  constructor(readonly kind: 'FORBIDDEN' | 'NOT_FOUND') {
    super('Resource unavailable');
  }
}

@Injectable()
export class AnalystMatchUploadAccess {
  constructor(private readonly prisma: PrismaService) {}

  readMatch<T>(actorIdentityId: string, matchId: string,
    project: (scope: AnalystUploadScope) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const match = await this.requireMatchInTransaction(tx, actorIdentityId, matchId);
      return project({ actorIdentityId, match, tx, [validatedUploadScope]: true });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  /** Reuse only inside a caller-owned transaction; the caller must lock before a write. */
  async requireMatchInTransaction(tx: Prisma.TransactionClient, actorIdentityId: string,
    matchId: string): Promise<AuthorizedUploadMatch> {
    const identity = await tx.identity.findUnique({
      where: { id: actorIdentityId },
      select: {
        status: true,
        roleAssignments: { where: { role: 'ANALYST', status: 'ACTIVE' }, select: { role: true } },
        analystOperationalProfile: { select: { identityId: true } },
      },
    });
    if (identity?.status !== 'ACTIVE' || !identity.analystOperationalProfile || identity.roleAssignments.length === 0) {
      throw new AnalystMatchUploadAccessError('FORBIDDEN');
    }
    const match = await tx.firstMatch.findFirst({
      where: {
        id: matchId,
        state: { in: ['WAITING', 'LOADED'] },
        passport: { state: 'ACTIVE', custody: { currentAnalystIdentityId: actorIdentityId } },
      },
      select: { id: true, passportId: true, playerId: true, state: true, unitState: true, version: true },
    });
    if (!match) throw new AnalystMatchUploadAccessError('NOT_FOUND');
    return { ...match, sourceKind: 'FIRST_MATCH' };
  }
}
