import { Injectable } from '@nestjs/common';

import type { AnalystUploadScope } from './analyst-match-upload-access.js';
import { AnalystMatchUploadRepository } from '../persistence/analyst-match-upload.repository.js';

/** Project only the authorized sporting record, never the persistence/analyst identity fields. */
@Injectable()
export class ReadAnalystMatchUpload {
  constructor(private readonly uploads: AnalystMatchUploadRepository) {}

  async read(scope: AnalystUploadScope) {
    if (scope.match.state !== 'LOADED' || scope.match.unitState !== 'USED') return null;
    const row = await this.uploads.findByMatch(scope.tx, scope.match.id);
    if (!row) return null;
    return {
      matchId: row.firstMatchId, sourceKind: 'FIRST_MATCH' as const,
      participation: row.participation, totalMinutesPlayed: row.totalMinutesPlayed,
      youtubeUrl: row.youtubeUrl, confirmedAt: row.confirmedAt.toISOString(), outcome: 'APPLIED' as const,
      events: row.events.map((event) => ({
        sequence: event.sequence, eventType: event.eventType,
        ...(event.variant ? { variant: event.variant } : {}), result: event.result,
        videoMinute: event.videoMinute,
        ...(event.period ? { period: event.period } : {}),
        ...(event.addedTime === null ? {} : { addedTime: event.addedTime }),
        context: event.context, complexity: event.complexity,
        ...(event.goalkeeperDetail === null ? {} : { goalkeeperDetail: event.goalkeeperDetail }),
        ...(event.observation === null ? {} : { observation: event.observation }),
      })),
    };
  }
}
