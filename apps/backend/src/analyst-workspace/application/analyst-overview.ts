import { Inject, Injectable } from '@nestjs/common';

import { AnalystWorkspaceAccess } from './analyst-workspace-access.js';
import { Feature009ConfirmedMatchSource, type ConfirmedMatch } from '../persistence/confirmed-match-source.js';

export const ANALYST_WORKSPACE_NAME_DECRYPTOR = Symbol('ANALYST_WORKSPACE_NAME_DECRYPTOR');
export const ANALYST_OVERVIEW_CLOCK = Symbol('ANALYST_OVERVIEW_CLOCK');
export type AnalystWorkspaceNameDecryptor = Readonly<{ decrypt: (ciphertext: string) => string }>;
export type OverviewMatch = ConfirmedMatch & Readonly<{ maskedReference: string; playerName: string }>;
export type OverviewSection = Readonly<{ availability: 'AVAILABLE'; data: readonly OverviewMatch[]; hasMore: boolean }>;
export type OverviewResult = Readonly<{ timeZone: 'America/Bogota'; analystLabel: string; pending: OverviewSection; upcoming: OverviewSection;
  completed: Readonly<{ availability: 'UNAVAILABLE' }> }>;

const bogotaFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function bogotaLocalMinute(now: Date): string {
  const parts = Object.fromEntries(bogotaFormatter.formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function classifyOverview<T extends ConfirmedMatch>(matches: readonly T[], now: Date): Readonly<{ pending: T[]; upcoming: T[] }> {
  const currentMinute = bogotaLocalMinute(now);
  const pending: T[] = [];
  const upcoming: T[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const key = `${match.sourceKind}:${match.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (match.state !== 'WAITING') continue;
    const scheduledMinute = `${match.matchDate}T${match.matchTime}`;
    if (scheduledMinute > currentMinute) upcoming.push(match);
    else pending.push(match);
  }
  return { pending, upcoming };
}

@Injectable()
export class AnalystOverview {
  constructor(
    private readonly access: AnalystWorkspaceAccess,
    private readonly source: Feature009ConfirmedMatchSource,
    @Inject(ANALYST_WORKSPACE_NAME_DECRYPTOR) private readonly names: AnalystWorkspaceNameDecryptor,
    @Inject(ANALYST_OVERVIEW_CLOCK) private readonly now: () => Date,
  ) {}

  get(actorIdentityId: string): Promise<OverviewResult> {
    return this.access.readCollection(actorIdentityId, async (scope) => {
      const profile = await scope.tx.analystOperationalProfile.findUnique({
        where: { identityId: actorIdentityId }, select: { displayLabel: true },
      });
      const analystLabel = profile?.displayLabel.trim();
      if (!analystLabel) throw new Error('Authorized analyst label unavailable');
      const page = await this.source.list(scope, { limit: 50 });
      const classified = classifyOverview(page.items, this.now());
      const visible = [...classified.pending, ...classified.upcoming];
      const passportIds = [...new Set(visible.map((match) => match.passportId))];
      const passports = passportIds.length ? await scope.tx.playerPassport.findMany({
        where: { id: { in: passportIds }, state: 'ACTIVE', custody: { currentAnalystIdentityId: actorIdentityId } },
        select: { id: true, player: { select: { privateIdentity: { select: { encryptedLegalName: true } } } } },
      }) : [];
      const names = new Map(passports.map((passport) => {
        const encrypted = passport.player.privateIdentity?.encryptedLegalName;
        if (!encrypted) throw new Error('Authorized passport lacks a player name');
        const name = this.names.decrypt(encrypted).trim();
        if (!name) throw new Error('Authorized passport has an empty player name');
        return [passport.id, name] as const;
      }));
      const project = (match: ConfirmedMatch): OverviewMatch => {
        const playerName = names.get(match.passportId);
        if (!playerName) throw new Error('Authorized match passport unavailable');
        return { ...match, playerName, maskedReference: `PAS-••••-${match.passportId.slice(-4).toUpperCase()}` };
      };
      // Both previews may be incomplete if the source had a further page; neither reports a global total.
      const hasMore = Boolean(page.nextCursor);
      return {
        timeZone: 'America/Bogota',
        analystLabel,
        pending: { availability: 'AVAILABLE', data: classified.pending.map(project), hasMore },
        upcoming: { availability: 'AVAILABLE', data: classified.upcoming.map(project), hasMore },
        completed: { availability: 'UNAVAILABLE' },
      };
    });
  }
}
