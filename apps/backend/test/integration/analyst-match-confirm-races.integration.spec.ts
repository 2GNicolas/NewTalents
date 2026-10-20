import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AnalystMatchUploadAccess } from '../../src/analyst-match-upload/application/analyst-match-upload-access.js';
import { ConfirmAnalystMatchUpload } from '../../src/analyst-match-upload/application/confirm-analyst-match-upload.js';
import { AnalystMatchUploadRepository } from '../../src/analyst-match-upload/persistence/analyst-match-upload.repository.js';
import { ConfirmedLoadService } from '../../src/first-match/application/confirmed-load.service.js';
import { FirstMatchRepository } from '../../src/first-match/persistence/first-match.repository.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { AllowanceTransactionRunner } from '../../src/passport-match-allowance/persistence/allowance-transaction.runner.js';
import { createAnalystMatchUploadFixture, SYNTHETIC_VIDEO_URL } from '../analyst-match-upload-test-helpers.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const firstMatch = new FirstMatchRepository(new AllowanceTransactionRunner(prisma as never));
const service = new ConfirmAnalystMatchUpload(prisma as never, new AnalystMatchUploadAccess(prisma as never),
  new AnalystMatchUploadRepository(), firstMatch, new ConfirmedLoadService(firstMatch));
const body = { expectedVersion: 1, participation: 'PARTICIPATED', totalMinutesPlayed: 12,
  youtubeUrl: SYNTHETIC_VIDEO_URL, events: [{ sequence: 1, eventType: 'GOAL', result: 'NONE', videoMinute: '88', context: {}, complexity: {} }] };

describe('Feature 011 final confirmation replays and races on isolated PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createAnalystMatchUploadFixture>>;
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature011_test_[a-f0-9]{12}$/);
    const client = await pool.connect();
    try { fixture = await createAnalystMatchUploadFixture(client); } finally { client.release(); }
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('replays exact intention after authority check and conflicts on changed content, key or version', async () => {
    const key = randomUUID();
    expect((await service.confirm(fixture.analystId, fixture.waitingMatchId, key, body)).outcome).toBe('APPLIED');
    expect((await service.confirm(fixture.analystId, fixture.waitingMatchId, key, body)).outcome).toBe('IDEMPOTENT');
    for (const [intent, payload] of [[key, { ...body, totalMinutesPlayed: 13 }],
      [key, { ...body, events: [{ ...body.events[0], observation: 'Distinta observación' }] }],
      [randomUUID(), body], [key, { ...body, expectedVersion: 2 }]] as const) {
      await expect(service.confirm(fixture.analystId, fixture.waitingMatchId, intent, payload))
        .rejects.toMatchObject({ kind: 'CONFLICT' });
    }
    expect(await prisma.analystMatchUpload.count({ where: { firstMatchId: fixture.waitingMatchId } })).toBe(1);
    expect(await prisma.firstMatchIntent.count({ where: { matchId: fixture.waitingMatchId, action: 'LOAD_CONFIRMED' } })).toBe(1);
  });

  it('denies a replay after custody revocation without disclosing stored upload', async () => {
    const key = randomUUID();
    await service.confirm(fixture.analystId, fixture.rescheduledMatchId, key, { ...body, expectedVersion: 2 });
    await prisma.passportCustody.update({ where: { passportId: fixture.rescheduled.passportId },
      data: { currentAnalystIdentityId: fixture.otherAnalystId } });
    await expect(service.confirm(fixture.analystId, fixture.rescheduledMatchId, key, { ...body, expectedVersion: 2 }))
      .rejects.toMatchObject({ kind: 'NOT_FOUND' });
    expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: fixture.rescheduledMatchId } }))
      .toMatchObject({ state: 'LOADED', unitState: 'USED', loadId: key });
  });

  it('never confirms canceled or stale matches; concurrent contenders yield one used unit', async () => {
    await expect(service.confirm(fixture.analystId, fixture.canceledMatchId, randomUUID(), body))
      .rejects.toMatchObject({ kind: 'NOT_FOUND' });
    const client = await pool.connect();
    let raceMatchId: string;
    try {
      const fresh = await createAnalystMatchUploadFixture(client);
      await prisma.firstMatch.update({ where: { id: fresh.rescheduledMatchId }, data: { version: 3 } });
      await expect(service.confirm(fresh.analystId, fresh.rescheduledMatchId, randomUUID(),
        { ...body, expectedVersion: 2 })).rejects.toMatchObject({ kind: 'CONFLICT' });
      expect(await prisma.analystMatchUpload.count({ where: { firstMatchId: fresh.rescheduledMatchId } })).toBe(0);
      raceMatchId = fresh.waitingMatchId;
      const two = await Promise.allSettled([
        service.confirm(fresh.analystId, raceMatchId, randomUUID(), body),
        service.confirm(fresh.analystId, raceMatchId, randomUUID(), body),
      ]);
      expect(two.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
      expect(await prisma.analystMatchUpload.count({ where: { firstMatchId: raceMatchId } })).toBe(1);
      expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: raceMatchId } }))
        .toMatchObject({ state: 'LOADED', unitState: 'USED' });
    } finally { client.release(); }
  });
});
