import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';

const validatedScope: unique symbol = Symbol('validated analyst workspace read');

export type AnalystReadScope = Readonly<{
  actorIdentityId: string;
  passportId?: string;
  tx: Prisma.TransactionClient;
  [validatedScope]: true;
}>;

export class AnalystWorkspaceAccessError extends Error {
  constructor(readonly kind: 'FORBIDDEN' | 'NOT_FOUND') {
    super('Resource unavailable');
  }
}

@Injectable()
export class AnalystWorkspaceAccess {
  constructor(private readonly prisma: PrismaService) {}

  readCollection<T>(actorIdentityId: string, project: (scope: AnalystReadScope) => Promise<T>): Promise<T> {
    return this.read(actorIdentityId, undefined, project);
  }

  readPassport<T>(actorIdentityId: string, passportId: string, project: (scope: AnalystReadScope) => Promise<T>): Promise<T> {
    return this.read(actorIdentityId, passportId, project);
  }

  private async read<T>(actorIdentityId: string, passportId: string | undefined, project: (scope: AnalystReadScope) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const identity = await tx.identity.findUnique({
        where: { id: actorIdentityId },
        select: {
          status: true,
          roleAssignments: { where: { role: 'ANALYST', status: 'ACTIVE' }, select: { role: true } },
          analystOperationalProfile: { select: { identityId: true } },
        },
      });
      if (identity?.status !== 'ACTIVE' || !identity.analystOperationalProfile || identity.roleAssignments.length === 0) {
        throw new AnalystWorkspaceAccessError('FORBIDDEN');
      }
      if (passportId) {
        const passport = await tx.playerPassport.findFirst({
          where: { id: passportId, state: 'ACTIVE', custody: { currentAnalystIdentityId: actorIdentityId } },
          select: { id: true },
        });
        if (!passport) throw new AnalystWorkspaceAccessError('NOT_FOUND');
      }
      return project({ actorIdentityId, ...(passportId ? { passportId } : {}), tx, [validatedScope]: true });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
