import { createHash, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import type { ConfirmUploadInput } from '../domain/confirm-upload-validation.js';
import { OBSERVED_EVENT_CATALOG_VERSION } from '../domain/observed-event-validation.js';

export type UploadTransaction = Prisma.TransactionClient;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  return JSON.stringify(value);
}

export function uploadIntentDigest(matchId: string, input: ConfirmUploadInput): string {
  return createHash('sha256').update(canonical({ matchId, ...input })).digest('hex');
}

@Injectable()
export class AnalystMatchUploadRepository {
  findByMatch(tx: UploadTransaction, firstMatchId: string) {
    return tx.analystMatchUpload.findUnique({ where: { firstMatchId }, include: { events: { orderBy: { sequence: 'asc' } } } });
  }

  async insert(tx: UploadTransaction, identity: { loadId: string; firstMatchId: string; analystIdentityId: string },
    input: ConfirmUploadInput, intentDigest: string, confirmedAt: Date): Promise<void> {
    await tx.analystMatchUpload.create({ data: {
      ...identity, expectedMatchVersion: input.expectedVersion, intentDigest,
      participation: input.participation, totalMinutesPlayed: input.totalMinutesPlayed,
      youtubeUrl: input.youtubeUrl, confirmedAt,
      events: { create: input.events.map((event) => ({
        id: randomUUID(), sequence: event.sequence, catalogVersion: OBSERVED_EVENT_CATALOG_VERSION, eventType: event.eventType,
        variant: event.variant ?? null, result: event.result, videoMinute: event.videoMinute,
        period: event.period ?? null, addedTime: event.addedTime ?? null,
        context: event.context as Prisma.InputJsonValue,
        complexity: event.complexity as Prisma.InputJsonValue,
        ...(event.goalkeeperDetail ? { goalkeeperDetail: event.goalkeeperDetail as Prisma.InputJsonValue } : {}),
        observation: event.observation ?? null,
      })) },
    } });
  }

  async verifyConfirmedData(tx: UploadTransaction, identity: { matchId: string; loadId: string }) {
    const proof = await tx.analystMatchUpload.findFirst({ where: {
      firstMatchId: identity.matchId, loadId: identity.loadId,
    }, select: { firstMatchId: true, loadId: true } });
    return proof ? { matchId: proof.firstMatchId, loadId: proof.loadId } : null;
  }
}
