import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { ConfirmedLoadError, ConfirmedLoadService } from '../../first-match/application/confirmed-load.service.js';
import { FirstMatchRepository } from '../../first-match/persistence/first-match.repository.js';
import { AnalystMatchUploadAccess, AnalystMatchUploadAccessError } from './analyst-match-upload-access.js';
import { validateConfirmUpload } from '../domain/confirm-upload-validation.js';
import { AnalystMatchUploadRepository, uploadIntentDigest } from '../persistence/analyst-match-upload.repository.js';

export class ConfirmAnalystMatchUploadError extends Error {
  constructor(readonly kind: 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT') { super('Upload unavailable'); }
}

@Injectable()
export class ConfirmAnalystMatchUpload {
  constructor(private readonly prisma: PrismaService, private readonly access: AnalystMatchUploadAccess,
    private readonly uploads: AnalystMatchUploadRepository, private readonly firstMatches: FirstMatchRepository,
    private readonly confirmedLoad: ConfirmedLoadService) {}

  async confirm(actorIdentityId: string, matchId: string, loadId: string, body: unknown) {
    // The match ID only locates its immutable passport; no sporting data is returned before authorization.
    const locator = await this.prisma.firstMatch.findUnique({ where: { id: matchId }, select: { passportId: true } });
    if (!locator) throw new ConfirmAnalystMatchUploadError('NOT_FOUND');
    try {
      return await this.firstMatches.executeLocked(locator.passportId, async (tx) => {
        let match;
        try { match = await this.access.requireMatchInTransaction(tx, actorIdentityId, matchId); }
        catch (error) {
          if (error instanceof AnalystMatchUploadAccessError) throw new ConfirmAnalystMatchUploadError(error.kind);
          throw error;
        }
        if (match.passportId !== locator.passportId) throw new ConfirmAnalystMatchUploadError('CONFLICT');
        const input = validateConfirmUpload(body);
        const digest = uploadIntentDigest(matchId, input);
        const existing = await this.uploads.findByMatch(tx, matchId);
        if (existing) {
          if (match.state !== 'LOADED' || match.unitState !== 'USED' || existing.loadId !== loadId
            || existing.intentDigest !== digest || existing.expectedMatchVersion !== input.expectedVersion
            || match.version !== input.expectedVersion + 1) throw new ConfirmAnalystMatchUploadError('CONFLICT');
          return { matchId, sourceKind: 'FIRST_MATCH' as const, participation: input.participation,
            totalMinutesPlayed: input.totalMinutesPlayed, youtubeUrl: input.youtubeUrl,
            events: input.events, confirmedAt: existing.confirmedAt.toISOString(), outcome: 'IDEMPOTENT' as const };
        }
        if (match.state !== 'WAITING' || match.unitState !== 'RESERVED' || match.version !== input.expectedVersion)
          throw new ConfirmAnalystMatchUploadError('CONFLICT');
        const confirmedAt = new Date();
        await this.uploads.insert(tx, { loadId, firstMatchId: matchId, analystIdentityId: actorIdentityId },
          input, digest, confirmedAt);
        await this.confirmedLoad.confirmFirstMatchDataLoad(tx, {
          passportId: match.passportId, matchId, analystIdentityId: actorIdentityId, loadId,
          expectedVersion: input.expectedVersion, confirmedAt,
        }, (transaction, identity) => this.uploads.verifyConfirmedData(transaction, identity));
        return { matchId, sourceKind: 'FIRST_MATCH' as const, participation: input.participation,
          totalMinutesPlayed: input.totalMinutesPlayed, youtubeUrl: input.youtubeUrl,
          events: input.events, confirmedAt: confirmedAt.toISOString(), outcome: 'APPLIED' as const };
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
        throw new ConfirmAnalystMatchUploadError('CONFLICT');
      if (error instanceof ConfirmedLoadError) {
        throw new ConfirmAnalystMatchUploadError(error.outcome === 'unauthorized' ? 'FORBIDDEN'
          : error.outcome === 'not-found' ? 'NOT_FOUND' : 'CONFLICT');
      }
      throw error;
    }
  }
}
