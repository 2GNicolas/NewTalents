import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AnalystMatchUploadAccess } from '../../src/analyst-match-upload/application/analyst-match-upload-access.js';
import { ConfirmAnalystMatchUpload } from '../../src/analyst-match-upload/application/confirm-analyst-match-upload.js';
import { AnalystMatchUploadRepository } from '../../src/analyst-match-upload/persistence/analyst-match-upload.repository.js';
import { AnalystOverview } from '../../src/analyst-workspace/application/analyst-overview.js';
import { AnalystWorkspaceAccess } from '../../src/analyst-workspace/application/analyst-workspace-access.js';
import { Feature009ConfirmedMatchSource } from '../../src/analyst-workspace/persistence/confirmed-match-source.js';
import { ConfirmedLoadService } from '../../src/first-match/application/confirmed-load.service.js';
import { FirstMatchRepository } from '../../src/first-match/persistence/first-match.repository.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { AllowanceTransactionRunner } from '../../src/passport-match-allowance/persistence/allowance-transaction.runner.js';
import { createAnalystMatchUploadFixture, seedSyntheticUploadPlayerNames, SYNTHETIC_VIDEO_URL } from '../analyst-match-upload-test-helpers.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const firstMatches = new FirstMatchRepository(new AllowanceTransactionRunner(prisma as never));
const confirm = new ConfirmAnalystMatchUpload(prisma as never, new AnalystMatchUploadAccess(prisma as never),
  new AnalystMatchUploadRepository(), firstMatches, new ConfirmedLoadService(firstMatches));
const overview = new AnalystOverview(new AnalystWorkspaceAccess(prisma as never), new Feature009ConfirmedMatchSource(),
  { decrypt: () => 'Jugador sintético' }, () => new Date('2026-11-10T15:00:00.000Z'));

describe('Feature 011 upload is not a completed FEM evaluation', () => {
  let fixture: Awaited<ReturnType<typeof createAnalystMatchUploadFixture>>;
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature011_test_[a-f0-9]{12}$/);
    const client = await pool.connect();
    try { fixture = await createAnalystMatchUploadFixture(client);
      await seedSyntheticUploadPlayerNames(client, [fixture.playerId, fixture.rescheduled.playerId, fixture.loaded.playerId]);
    } finally { client.release(); }
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('keeps completed unavailable for historic LOADED and after an actual Feature 011 upload', async () => {
    const historical = await overview.get(fixture.analystId);
    expect(historical.completed).toEqual({ availability: 'UNAVAILABLE' });
    expect(JSON.stringify(historical)).not.toMatch(/youtubeUrl|rating|score|evaluation|"completed":\{[^}]*"data"/i);
    await confirm.confirm(fixture.analystId, fixture.waitingMatchId, randomUUID(), {
      expectedVersion: 1, participation: 'DID_NOT_PARTICIPATE', totalMinutesPlayed: 0,
      youtubeUrl: SYNTHETIC_VIDEO_URL, events: [],
    });
    const uploaded = await overview.get(fixture.analystId);
    expect(uploaded.completed).toEqual({ availability: 'UNAVAILABLE' });
    expect(uploaded.pending.data.some((match) => match.id === fixture.waitingMatchId)).toBe(false);
    expect(uploaded.upcoming.data.some((match) => match.id === fixture.waitingMatchId)).toBe(false);
    expect(JSON.stringify(uploaded)).not.toMatch(/youtubeUrl|rating|score|evaluation|"completed":\{[^}]*"data"/i);
    expect(await prisma.analystMatchUpload.count({ where: { firstMatchId: fixture.waitingMatchId } })).toBe(1);
  });
});
