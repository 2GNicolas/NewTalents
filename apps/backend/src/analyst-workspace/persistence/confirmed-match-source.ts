import { Injectable } from '@nestjs/common';

import type { AnalystReadScope } from '../application/analyst-workspace-access.js';

export type ConfirmedMatch = Readonly<{
  id: string;
  sourceKind: string;
  passportId: string;
  matchDate: string;
  matchTime: string;
  opponent: string;
  competition: string;
  venue: string;
  state: 'WAITING' | 'LOADED';
}>;

export type ConfirmedMatchPage = Readonly<{ items: readonly ConfirmedMatch[]; nextCursor?: string }>;
export type MatchReadOptions = Readonly<{ limit: number; cursor?: string; passportId?: string }>;

/** Future authoritative sources implement this read-only shape; none is registered here. */
export interface ConfirmedMatchSource {
  list(scope: AnalystReadScope, options: MatchReadOptions): Promise<ConfirmedMatchPage>;
  find(scope: AnalystReadScope, id: string): Promise<ConfirmedMatch | null>;
}

type MatchRow = Readonly<{
  id: string; passportId: string; matchDate: Date; matchTime: string; opponent: string;
  competition: string; venue: string; state: 'WAITING' | 'LOADED' | 'CANCELED';
}>;

function project(row: MatchRow): ConfirmedMatch {
  if (row.state === 'CANCELED') throw new Error('Canceled match cannot be projected');
  return {
    id: row.id, sourceKind: 'FIRST_MATCH', passportId: row.passportId,
    matchDate: row.matchDate.toISOString().slice(0, 10), matchTime: row.matchTime,
    opponent: row.opponent, competition: row.competition, venue: row.venue, state: row.state,
  };
}

@Injectable()
export class Feature009ConfirmedMatchSource implements ConfirmedMatchSource {
  async list(scope: AnalystReadScope, options: MatchReadOptions): Promise<ConfirmedMatchPage> {
    if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 50) throw new RangeError('Invalid page limit');
    const passportId = scope.passportId ?? options.passportId;
    if (scope.passportId && options.passportId && scope.passportId !== options.passportId) throw new RangeError('Mismatched passport');
    const rows = await scope.tx.firstMatch.findMany({
      where: {
        state: { in: ['WAITING', 'LOADED'] },
        passport: { state: 'ACTIVE', custody: { currentAnalystIdentityId: scope.actorIdentityId } },
        ...(passportId ? { passportId } : {}),
        ...(options.cursor ? { id: { gt: options.cursor } } : {}),
      },
      select: { id: true, passportId: true, matchDate: true, matchTime: true, opponent: true, competition: true, venue: true, state: true },
      orderBy: { id: 'asc' },
      take: options.limit + 1,
    });
    const visible = rows.slice(0, options.limit);
    return {
      items: visible.map(project),
      ...(rows.length > options.limit ? { nextCursor: visible[visible.length - 1]!.id } : {}),
    };
  }

  async find(scope: AnalystReadScope, id: string): Promise<ConfirmedMatch | null> {
    const row = await scope.tx.firstMatch.findFirst({
      where: {
        id, state: { in: ['WAITING', 'LOADED'] },
        passport: { state: 'ACTIVE', custody: { currentAnalystIdentityId: scope.actorIdentityId } },
        ...(scope.passportId ? { passportId: scope.passportId } : {}),
      },
      select: { id: true, passportId: true, matchDate: true, matchTime: true, opponent: true, competition: true, venue: true, state: true },
    });
    return row ? project(row) : null;
  }
}
