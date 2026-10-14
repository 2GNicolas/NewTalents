import { Injectable } from '@nestjs/common';

import { parseMatchDate, validPassportId } from '../domain/first-match-validation.js';
import { FirstMatchRepository } from '../persistence/first-match.repository.js';
import { FirstMatchAccess } from './first-match-access.js';

type ReadInput = Readonly<{ passportId: string; actorIdentityId: string }>;

function summary(match: Awaited<ReturnType<FirstMatchRepository['findCurrent']>>) {
  if (!match) return undefined;
  return { id: match.id, version: match.version, matchDate: match.matchDate.toISOString().slice(0, 10),
    matchTime: match.matchTime, opponent: match.opponent, competition: match.competition, venue: match.venue,
    state: match.state as 'WAITING' | 'LOADED' };
}

@Injectable()
export class FirstMatchQuery {
  constructor(private readonly repository: FirstMatchRepository, private readonly access: FirstMatchAccess) {}

  async get(input: ReadInput) {
    if (!validPassportId(input.passportId) || !validPassportId(input.actorIdentityId)) return { outcome: 'not-found' as const };
    try {
      return await this.repository.executeLocked(input.passportId, async (transaction) => {
        const passport = await this.access.responsiblePassport(transaction, input.passportId, input.actorIdentityId);
        if (!passport) return { outcome: 'not-found' as const };
        if (passport.state !== 'ACTIVE') return { outcome: 'ok' as const, flow: {
          passportId: input.passportId, state: 'RESTRICTED' as const, allowedActions: [] as string[],
        } };
        const match = await this.repository.findCurrent(transaction, input.passportId);
        if (!match) return { outcome: 'ok' as const, flow: {
          passportId: input.passportId, state: 'INVITATION' as const, allowedActions: ['SCHEDULE'],
        } };
        return { outcome: 'ok' as const, flow: {
          passportId: input.passportId, state: match.state, match: summary(match),
          allowedActions: match.state === 'WAITING' ? ['RESCHEDULE', 'CANCEL'] : [] as string[],
        } };
      });
    } catch { return { outcome: 'unavailable' as const }; }
  }

  async preview(input: ReadInput & Readonly<{ matchDate: string }>) {
    if (!validPassportId(input.passportId) || !validPassportId(input.actorIdentityId)) return { outcome: 'not-found' as const };
    const matchDate = parseMatchDate(input.matchDate);
    if (!matchDate) return { outcome: 'invalid' as const };
    try {
      return await this.repository.executeLocked(input.passportId, async (transaction) => {
        const passport = await this.access.responsiblePassport(transaction, input.passportId, input.actorIdentityId);
        if (!passport || passport.state !== 'ACTIVE') return { outcome: 'not-found' as const };
        const source = await this.repository.loadAllowanceSource(transaction, input.passportId);
        const period = await this.repository.countPeriod(transaction, source, matchDate);
        if (!period) return { outcome: 'ok' as const, availability: { configured: false, matchDate } };
        return { outcome: 'ok' as const, availability: {
          configured: true, matchDate, periodStart: period.period.start,
          periodEndExclusive: period.period.endExclusive, cadence: period.cadence,
          limit: period.matchLimit, reserved: period.reserved, used: period.used, available: period.available,
        } };
      });
    } catch { return { outcome: 'unavailable' as const }; }
  }
}
