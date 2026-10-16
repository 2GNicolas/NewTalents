import { Injectable } from '@nestjs/common';

import type { AnalystReadScope } from '../application/analyst-workspace-access.js';
import type { AnalystWorkspaceNameDecryptor } from '../application/analyst-overview.js';
import { Feature009ConfirmedMatchSource } from './confirmed-match-source.js';

export type PassportCard = Readonly<{
  passportId: string; maskedReference: string; playerName: string;
  lifecycleState: 'ACTIVE'; custodyState: 'ASSIGNED_TO_ACTOR';
  nextMatch?: Readonly<{ id: string; matchDate: string; matchTime: string; opponent: string; venue: string }>;
}>;
export type PassportPage = Readonly<{ data: PassportCard[]; pagination: Readonly<{ hasMore: boolean; nextCursor?: string }> }>;

const localFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function localMinute(now: Date): string {
  const parts = Object.fromEntries(localFormatter.formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

@Injectable()
export class AnalystPassportReadRepository {
  constructor(private readonly matches: Feature009ConfirmedMatchSource, private readonly names: AnalystWorkspaceNameDecryptor) {}

  async list(scope: AnalystReadScope, options: { limit: number; cursor?: string }, now: Date): Promise<PassportPage> {
    const rows = await scope.tx.playerPassport.findMany({
      where: { state: 'ACTIVE', custody: { currentAnalystIdentityId: scope.actorIdentityId },
        ...(options.cursor ? { id: { gt: options.cursor } } : {}) },
      select: { id: true, player: { select: { privateIdentity: { select: { encryptedLegalName: true } } } } },
      orderBy: { id: 'asc' }, take: options.limit + 1,
    });
    const visible = rows.slice(0, options.limit);
    const data = await Promise.all(visible.map((row) => this.project(scope, row, now)));
    return { data, pagination: { hasMore: rows.length > options.limit,
      ...(rows.length > options.limit ? { nextCursor: visible[visible.length - 1]!.id } : {}) } };
  }

  async detail(scope: AnalystReadScope, now: Date): Promise<PassportCard> {
    if (!scope.passportId) throw new Error('Passport read scope required');
    const row = await scope.tx.playerPassport.findFirst({
      where: { id: scope.passportId, state: 'ACTIVE', custody: { currentAnalystIdentityId: scope.actorIdentityId } },
      select: { id: true, player: { select: { privateIdentity: { select: { encryptedLegalName: true } } } } },
    });
    if (!row) throw new Error('Authorized passport unavailable');
    return this.project(scope, row, now);
  }

  private async project(scope: AnalystReadScope, row: { id: string; player: { privateIdentity: { encryptedLegalName: string } | null } }, now: Date): Promise<PassportCard> {
    const encrypted = row.player.privateIdentity?.encryptedLegalName;
    if (!encrypted) throw new Error('Authorized player name unavailable');
    const playerName = this.names.decrypt(encrypted).trim();
    if (!playerName) throw new Error('Authorized player name empty');
    const current = localMinute(now);
    const page = await this.matches.list(scope, { limit: 50, passportId: row.id });
    const next = page.items.filter((match) => match.state === 'WAITING' && `${match.matchDate}T${match.matchTime}` > current)
      .sort((a, b) => `${a.matchDate}T${a.matchTime}`.localeCompare(`${b.matchDate}T${b.matchTime}`))[0];
    return {
      passportId: row.id, maskedReference: `PAS-••••-${row.id.slice(-4).toUpperCase()}`, playerName,
      lifecycleState: 'ACTIVE', custodyState: 'ASSIGNED_TO_ACTOR',
      ...(next ? { nextMatch: { id: next.id, matchDate: next.matchDate, matchTime: next.matchTime,
        opponent: next.opponent, venue: next.venue } } : {}),
    };
  }
}
