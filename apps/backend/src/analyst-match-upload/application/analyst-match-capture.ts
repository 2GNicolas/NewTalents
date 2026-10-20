import { Injectable } from '@nestjs/common';

import { AnalystMatchUploadAccess, AnalystMatchUploadAccessError } from './analyst-match-upload-access.js';
import { ConfirmedUploadSources } from './confirmed-upload-source.js';
import { ReadAnalystMatchUpload } from './read-analyst-match-upload.js';

@Injectable()
export class AnalystMatchCapture {
  constructor(private readonly access: AnalystMatchUploadAccess, private readonly sources: ConfirmedUploadSources,
    private readonly uploads: ReadAnalystMatchUpload) {}

  get(actorIdentityId: string, matchId: string) {
    return this.access.readMatch(actorIdentityId, matchId, async (scope) => {
      const { match } = scope;
      const eligibility = this.sources.forMatch(match);
      if (!eligibility) throw new AnalystMatchUploadAccessError('NOT_FOUND');
      const upload = eligibility.availability === 'UNAVAILABLE' ? await this.uploads.read(scope) : null;
      return { matchId: match.id, sourceKind: 'FIRST_MATCH' as const, passportId: match.passportId,
        availability: upload ? 'CONFIRMED' as const : eligibility.availability,
        ...(eligibility.expectedVersion === undefined ? {} : { expectedVersion: eligibility.expectedVersion }),
        ...(upload ? { upload } : {}) };
    });
  }
}
