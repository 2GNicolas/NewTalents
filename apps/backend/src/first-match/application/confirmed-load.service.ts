import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { validPassportId } from '../domain/first-match-validation.js';
import { FirstMatchRepository, type FirstMatchTransaction } from '../persistence/first-match.repository.js';

export type ConfirmedLoadInput = Readonly<{
  passportId: string; matchId: string; analystIdentityId: string; loadId: string;
  expectedVersion: number; confirmedAt: Date;
}>;
export type ConfirmedLoadProof = Readonly<{ matchId: string; loadId: string }>;
/** Implemented by the future data owner. It must read its durable confirmation using this very transaction. */
export type VerifyConfirmedData = (transaction: FirstMatchTransaction,
  identity: Readonly<{ matchId: string; loadId: string }>) => Promise<ConfirmedLoadProof | null>;
export type ConfirmedLoadResult = Readonly<{ outcome: 'applied' | 'idempotent'; matchId: string }>;
export type ConfirmedLoadFailure = 'invalid' | 'not-found' | 'unauthorized' | 'unconfirmed' | 'conflict';
export class ConfirmedLoadError extends Error {
  constructor(readonly outcome: ConfirmedLoadFailure) { super(`First-match load ${outcome}`); }
}
function reject(outcome: ConfirmedLoadFailure): never { throw new ConfirmedLoadError(outcome); }

/** Internal port only. The caller owns the SERIALIZABLE transaction and its sporting-data write. */
@Injectable()
export class ConfirmedLoadService {
  constructor(private readonly repository: FirstMatchRepository) {}

  async confirmFirstMatchDataLoad(transaction: FirstMatchTransaction, input: ConfirmedLoadInput,
    verifyConfirmedData: VerifyConfirmedData): Promise<ConfirmedLoadResult> {
    if (!validPassportId(input.passportId) || !validPassportId(input.matchId)
      || !validPassportId(input.analystIdentityId) || !validPassportId(input.loadId)
      || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1
      || !(input.confirmedAt instanceof Date) || !Number.isFinite(input.confirmedAt.valueOf())
      || typeof verifyConfirmedData !== 'function') return reject('invalid');

    // Lock order matches scheduling, correction, custody and allowance confirmation.
    if (!await this.repository.lockInTransaction(transaction, input.passportId)) return reject('not-found');
    const match = await transaction.firstMatch.findFirst({ where: { id: input.matchId, passportId: input.passportId } });
    if (!match) return reject('not-found');

    const custody = await transaction.passportCustody.findUnique({ where: { passportId: input.passportId },
      select: { currentAnalystIdentityId: true } });
    if (custody?.currentAnalystIdentityId !== input.analystIdentityId) return reject('unauthorized');
    const analyst = await transaction.analystOperationalProfile.findFirst({ where: {
      identityId: input.analystIdentityId,
      identity: { status: 'ACTIVE', roleAssignments: { some: { role: 'ANALYST', status: 'ACTIVE' } } },
    }, select: { identityId: true } });
    if (!analyst) return reject('unauthorized');

    if (match.state === 'LOADED') return match.loadId === input.loadId
      && match.loadedByAnalystIdentityId === input.analystIdentityId
      && match.version === input.expectedVersion + 1
      ? { outcome: 'idempotent', matchId: match.id } : reject('conflict');
    if (match.state !== 'WAITING' || match.unitState !== 'RESERVED' || match.version !== input.expectedVersion)
      return reject('conflict');

    const proof = await verifyConfirmedData(transaction, { matchId: input.matchId, loadId: input.loadId });
    if (proof?.matchId !== input.matchId || proof.loadId !== input.loadId) return reject('unconfirmed');

    await transaction.firstMatch.update({ where: { id: input.matchId }, data: {
      state: 'LOADED', unitState: 'USED', loadedByAnalystIdentityId: input.analystIdentityId,
      loadId: input.loadId, loadedAt: input.confirmedAt, version: { increment: 1 },
    } });
    const intentDigest = createHash('sha256').update(JSON.stringify({ matchId: input.matchId,
      analystIdentityId: input.analystIdentityId, expectedVersion: input.expectedVersion,
      loadId: input.loadId })).digest('hex');
    await transaction.firstMatchIntent.create({ data: {
      passportId: input.passportId, matchId: input.matchId, idempotencyKey: input.loadId,
      action: 'LOAD_CONFIRMED', intentDigest, actorIdentityId: input.analystIdentityId,
      outcome: 'APPLIED', resultVersion: match.version + 1,
    } });
    return { outcome: 'applied', matchId: input.matchId };
  }
}
