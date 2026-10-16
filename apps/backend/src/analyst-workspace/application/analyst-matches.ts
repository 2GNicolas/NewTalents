import { Inject, Injectable } from '@nestjs/common';

import { AnalystWorkspaceAccess, AnalystWorkspaceAccessError, type AnalystReadScope } from './analyst-workspace-access.js';
import { ANALYST_WORKSPACE_NAME_DECRYPTOR, type AnalystWorkspaceNameDecryptor } from './analyst-overview.js';
import { Feature009ConfirmedMatchSource, type ConfirmedMatch } from '../persistence/confirmed-match-source.js';

export type AnalystMatchDetail = ConfirmedMatch & Readonly<{ maskedReference: string; playerName: string }>;
export type AnalystMatchPage = Readonly<{ data: AnalystMatchDetail[]; pagination: Readonly<{ hasMore: boolean; nextCursor?: string }> }>;

@Injectable()
export class AnalystMatches {
  constructor(private readonly access: AnalystWorkspaceAccess, private readonly source: Feature009ConfirmedMatchSource,
    @Inject(ANALYST_WORKSPACE_NAME_DECRYPTOR) private readonly names: AnalystWorkspaceNameDecryptor) {}

  list(actorIdentityId: string, options: { limit: number; cursor?: string }): Promise<AnalystMatchPage> {
    return this.access.readCollection(actorIdentityId, async (scope) => {
      const page = await this.source.list(scope, options);
      const names = await this.authorizedNames(scope, page.items.map((match) => match.passportId));
      return { data: page.items.map((match) => this.project(match, names)), pagination: {
        hasMore: Boolean(page.nextCursor), ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
      } };
    });
  }

  detail(actorIdentityId: string, matchId: string): Promise<AnalystMatchDetail> {
    return this.access.readCollection(actorIdentityId, async (scope) => {
      const match = await this.source.find(scope, matchId);
      if (!match) throw new AnalystWorkspaceAccessError('NOT_FOUND');
      const names = await this.authorizedNames(scope, [match.passportId]);
      return this.project(match, names);
    });
  }

  private async authorizedNames(scope: AnalystReadScope, passportIds: readonly string[]): Promise<Map<string, string>> {
    if (!passportIds.length) return new Map();
    const rows = await scope.tx.playerPassport.findMany({
      where: { id: { in: [...new Set(passportIds)] }, state: 'ACTIVE', custody: { currentAnalystIdentityId: scope.actorIdentityId } },
      select: { id: true, player: { select: { privateIdentity: { select: { encryptedLegalName: true } } } } },
    });
    return new Map(rows.map((row) => {
      const encrypted = row.player.privateIdentity?.encryptedLegalName;
      if (!encrypted) throw new Error('Authorized player name unavailable');
      const name = this.names.decrypt(encrypted).trim();
      if (!name) throw new Error('Authorized player name empty');
      return [row.id, name] as const;
    }));
  }

  private project(match: ConfirmedMatch, names: Map<string, string>): AnalystMatchDetail {
    const playerName = names.get(match.passportId);
    if (!playerName) throw new AnalystWorkspaceAccessError('NOT_FOUND');
    return { ...match, maskedReference: `PAS-••••-${match.passportId.slice(-4).toUpperCase()}`, playerName };
  }
}
