import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { errorCode } from '../../passport-match-allowance/persistence/allowance-transaction.runner.js';
import { parseCancelCommand, parseRescheduleCommand, parseScheduleCommand, validPassportId,
  type CancelFields, type RescheduleFields, type ScheduleFields } from '../domain/first-match-validation.js';
import { FirstMatchRepository } from '../persistence/first-match.repository.js';
import { FirstMatchAccess } from './first-match-access.js';

export type ScheduleInput = ScheduleFields & Readonly<{ passportId: string; actorIdentityId: string }>;
export type RescheduleInput = RescheduleFields & Readonly<{ passportId: string; matchId: string; actorIdentityId: string }>;
export type CancelInput = CancelFields & Readonly<{ passportId: string; matchId: string; actorIdentityId: string }>;
export type ScheduleResult = Readonly<{ outcome: 'applied' | 'idempotent'; matchId: string }>
  | Readonly<{ outcome: 'invalid' | 'not-found' | 'ineligible' | 'conflict' | 'no-allowance' | 'allowance-full' | 'unavailable' }>;

@Injectable()
export class FirstMatchCommand {
  constructor(private readonly repository: FirstMatchRepository, private readonly access: FirstMatchAccess) {}

  async schedule(input: ScheduleInput): Promise<ScheduleResult> {
    if (!validPassportId(input.passportId) || !validPassportId(input.actorIdentityId)) return { outcome: 'not-found' };
    const { passportId, actorIdentityId, ...candidate } = input;
    const parsed = parseScheduleCommand(candidate);
    if (!parsed.ok) return { outcome: 'invalid' };
    const fields = parsed.value;
    const opponent = fields.opponent.trim();
    const competition = fields.competition.trim();
    const venue = fields.venue.trim();
    const digest = createHash('sha256').update(JSON.stringify({ actorIdentityId, expectedVersion: fields.expectedVersion,
      matchDate: fields.matchDate, matchTime: fields.matchTime, opponent, competition, venue })).digest('hex');
    try {
      return await this.repository.executeLocked(passportId, async (transaction): Promise<ScheduleResult> => {
        const passport = await this.access.responsiblePassport(transaction, passportId, actorIdentityId);
        if (!passport) return { outcome: 'not-found' };
        if (passport.state !== 'ACTIVE') return { outcome: 'ineligible' };

        const replay = await transaction.firstMatchIntent.findUnique({
          where: { passportId_idempotencyKey: { passportId, idempotencyKey: fields.idempotencyKey } },
          select: { action: true, intentDigest: true, actorIdentityId: true, matchId: true },
        });
        if (replay) {
          return replay.action === 'SCHEDULE' && replay.intentDigest === digest
            && replay.actorIdentityId === actorIdentityId && replay.matchId
            ? { outcome: 'idempotent', matchId: replay.matchId } : { outcome: 'conflict' };
        }
        if (await this.repository.findCurrent(transaction, passportId)) return { outcome: 'conflict' };
        const source = await this.repository.loadAllowanceSource(transaction, passportId);
        const capacity = await this.repository.countPeriod(transaction, source, fields.matchDate);
        if (!capacity) return { outcome: 'no-allowance' };
        if (capacity.reserved + capacity.used + 1 > capacity.matchLimit) return { outcome: 'allowance-full' };

        const match = await transaction.firstMatch.create({
          data: { passportId, playerId: passport.playerId, matchDate: new Date(`${fields.matchDate}T00:00:00.000Z`),
            matchTime: fields.matchTime, opponent, competition, venue, scheduledByIdentityId: actorIdentityId,
            state: 'WAITING', unitState: 'RESERVED' },
          select: { id: true },
        });
        await transaction.firstMatchIntent.create({
          data: { passportId, matchId: match.id, idempotencyKey: fields.idempotencyKey, action: 'SCHEDULE',
            intentDigest: digest, actorIdentityId, outcome: 'APPLIED', resultVersion: 1 },
        });
        return { outcome: 'applied', matchId: match.id };
      });
    } catch (error) {
      const code = errorCode(error);
      return { outcome: code === 'P2002' || code === 'P2034' ? 'conflict' : 'unavailable' };
    }
  }

  async reschedule(input: RescheduleInput): Promise<ScheduleResult> {
    if (!validPassportId(input.passportId) || !validPassportId(input.matchId) || !validPassportId(input.actorIdentityId))
      return { outcome: 'not-found' };
    const { passportId, matchId, actorIdentityId, ...candidate } = input;
    const parsed = parseRescheduleCommand(candidate);
    if (!parsed.ok) return { outcome: 'invalid' };
    const fields = parsed.value;
    const opponent = fields.opponent.trim();
    const competition = fields.competition.trim();
    const venue = fields.venue.trim();
    const digest = createHash('sha256').update(JSON.stringify({ actorIdentityId, matchId,
      expectedVersion: fields.expectedVersion, matchDate: fields.matchDate, matchTime: fields.matchTime,
      opponent, competition, venue })).digest('hex');
    try {
      return await this.repository.executeLocked(passportId, async (transaction): Promise<ScheduleResult> => {
        const passport = await this.access.responsiblePassport(transaction, passportId, actorIdentityId);
        if (!passport) return { outcome: 'not-found' };
        if (passport.state !== 'ACTIVE') return { outcome: 'ineligible' };
        const match = await transaction.firstMatch.findFirst({ where: { id: matchId, passportId } });
        if (!match) return { outcome: 'not-found' };
        const replay = await transaction.firstMatchIntent.findUnique({
          where: { passportId_idempotencyKey: { passportId, idempotencyKey: fields.idempotencyKey } },
          select: { action: true, intentDigest: true, actorIdentityId: true, matchId: true },
        });
        if (replay) return replay.action === 'RESCHEDULE' && replay.intentDigest === digest
          && replay.actorIdentityId === actorIdentityId && replay.matchId === matchId
          ? { outcome: 'idempotent', matchId } : { outcome: 'conflict' };
        if (match.state !== 'WAITING' || match.unitState !== 'RESERVED' || match.version !== fields.expectedVersion)
          return { outcome: 'conflict' };
        const source = await this.repository.loadAllowanceSource(transaction, passportId);
        const destination = await this.repository.countPeriod(transaction, source, fields.matchDate);
        if (!destination) return { outcome: 'no-allowance' };
        const original = source ? await this.repository.countPeriod(transaction, source, match.matchDate.toISOString().slice(0, 10)) : null;
        const samePeriod = original?.period.start === destination.period.start
          && original?.period.endExclusive === destination.period.endExclusive;
        if (destination.reserved + destination.used + (samePeriod ? 0 : 1) > destination.matchLimit)
          return { outcome: 'allowance-full' };
        await transaction.firstMatch.update({ where: { id: matchId }, data: {
          matchDate: new Date(`${fields.matchDate}T00:00:00.000Z`), matchTime: fields.matchTime,
          opponent, competition, venue, version: { increment: 1 },
        } });
        await transaction.firstMatchIntent.create({ data: { passportId, matchId,
          idempotencyKey: fields.idempotencyKey, action: 'RESCHEDULE', intentDigest: digest,
          actorIdentityId, outcome: 'APPLIED', resultVersion: match.version + 1 } });
        return { outcome: 'applied', matchId };
      });
    } catch (error) {
      const code = errorCode(error);
      return { outcome: code === 'P2002' || code === 'P2034' ? 'conflict' : 'unavailable' };
    }
  }

  async cancel(input: CancelInput): Promise<ScheduleResult> {
    if (!validPassportId(input.passportId) || !validPassportId(input.matchId) || !validPassportId(input.actorIdentityId))
      return { outcome: 'not-found' };
    const { passportId, matchId, actorIdentityId, ...candidate } = input;
    const parsed = parseCancelCommand(candidate);
    if (!parsed.ok) return { outcome: 'invalid' };
    const fields = parsed.value;
    const digest = createHash('sha256').update(JSON.stringify({ actorIdentityId, matchId,
      expectedVersion: fields.expectedVersion })).digest('hex');
    try {
      return await this.repository.executeLocked(passportId, async (transaction): Promise<ScheduleResult> => {
        const passport = await this.access.responsiblePassport(transaction, passportId, actorIdentityId);
        if (!passport) return { outcome: 'not-found' };
        if (passport.state !== 'ACTIVE') return { outcome: 'ineligible' };
        const match = await transaction.firstMatch.findFirst({ where: { id: matchId, passportId } });
        if (!match) return { outcome: 'not-found' };
        const replay = await transaction.firstMatchIntent.findUnique({
          where: { passportId_idempotencyKey: { passportId, idempotencyKey: fields.idempotencyKey } },
          select: { action: true, intentDigest: true, actorIdentityId: true, matchId: true },
        });
        if (replay) return replay.action === 'CANCEL' && replay.intentDigest === digest
          && replay.actorIdentityId === actorIdentityId && replay.matchId === matchId
          ? { outcome: 'idempotent', matchId } : { outcome: 'conflict' };
        if (match.state !== 'WAITING' || match.unitState !== 'RESERVED' || match.version !== fields.expectedVersion)
          return { outcome: 'conflict' };
        await transaction.firstMatch.update({ where: { id: matchId }, data: {
          state: 'CANCELED', unitState: 'RELEASED', canceledByIdentityId: actorIdentityId,
          canceledAt: new Date(), version: { increment: 1 },
        } });
        await transaction.firstMatchIntent.create({ data: { passportId, matchId,
          idempotencyKey: fields.idempotencyKey, action: 'CANCEL', intentDigest: digest,
          actorIdentityId, outcome: 'APPLIED', resultVersion: match.version + 1 } });
        return { outcome: 'applied', matchId };
      });
    } catch (error) {
      const code = errorCode(error);
      return { outcome: code === 'P2002' || code === 'P2034' ? 'conflict' : 'unavailable' };
    }
  }
}
