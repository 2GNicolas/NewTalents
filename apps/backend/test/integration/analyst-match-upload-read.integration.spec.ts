import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AnalystMatchUploadAccess } from '../../src/analyst-match-upload/application/analyst-match-upload-access.js';
import { AnalystMatchCapture } from '../../src/analyst-match-upload/application/analyst-match-capture.js';
import { ConfirmAnalystMatchUpload } from '../../src/analyst-match-upload/application/confirm-analyst-match-upload.js';
import { ConfirmedUploadSources } from '../../src/analyst-match-upload/application/confirmed-upload-source.js';
import { ReadAnalystMatchUpload } from '../../src/analyst-match-upload/application/read-analyst-match-upload.js';
import { AnalystMatchUploadRepository } from '../../src/analyst-match-upload/persistence/analyst-match-upload.repository.js';
import { AnalystMatches } from '../../src/analyst-workspace/application/analyst-matches.js';
import { AnalystWorkspaceAccess } from '../../src/analyst-workspace/application/analyst-workspace-access.js';
import { Feature009ConfirmedMatchSource } from '../../src/analyst-workspace/persistence/confirmed-match-source.js';
import { ConfirmedLoadService } from '../../src/first-match/application/confirmed-load.service.js';
import { FirstMatchAccess } from '../../src/first-match/application/first-match-access.js';
import { FirstMatchQuery } from '../../src/first-match/application/first-match-query.js';
import { FirstMatchRepository } from '../../src/first-match/persistence/first-match.repository.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { AllowanceTransactionRunner } from '../../src/passport-match-allowance/persistence/allowance-transaction.runner.js';
import { toPassportPresentationResponse } from '../../src/player-passport/http/passport-presentation-mapper.js';
import { createAnalystMatchUploadFixture, seedSyntheticUploadPlayerNames, SYNTHETIC_VIDEO_URL } from '../analyst-match-upload-test-helpers.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const access = new AnalystMatchUploadAccess(prisma as never);
const uploads = new AnalystMatchUploadRepository();
const capture = new AnalystMatchCapture(access, new ConfirmedUploadSources(), new ReadAnalystMatchUpload(uploads));
const firstMatches = new FirstMatchRepository(new AllowanceTransactionRunner(prisma as never));
const confirm = new ConfirmAnalystMatchUpload(prisma as never, access, uploads, firstMatches, new ConfirmedLoadService(firstMatches));
const ownerView = new FirstMatchQuery(firstMatches, new FirstMatchAccess());
const analystMatches = new AnalystMatches(new AnalystWorkspaceAccess(prisma as never), new Feature009ConfirmedMatchSource(),
  { decrypt: () => 'Jugador sintético' });

describe('Feature 011 private confirmed read on isolated PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createAnalystMatchUploadFixture>>;
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature011_test_[a-f0-9]{12}$/);
    const client = await pool.connect();
    try { fixture = await createAnalystMatchUploadFixture(client);
      await seedSyntheticUploadPlayerNames(client, [fixture.playerId, fixture.rescheduled.playerId, fixture.loaded.playerId]);
    } finally { client.release(); }
    await confirm.confirm(fixture.analystId, fixture.waitingMatchId, randomUUID(), {
      expectedVersion: 1, participation: 'PARTICIPATED', totalMinutesPlayed: 97, youtubeUrl: SYNTHETIC_VIDEO_URL,
      events: [{ sequence: 1, eventType: 'GOAL', result: 'NONE', videoMinute: '90+7', context: {}, complexity: {},
        observation: 'Observación privada sintética' }],
    });
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('projects confirmed events and optional observation only for the current custodian', async () => {
    const result = await capture.get(fixture.analystId, fixture.waitingMatchId);
    expect(result).toMatchObject({ availability: 'CONFIRMED', upload: { matchId: fixture.waitingMatchId,
      participation: 'PARTICIPATED', totalMinutesPlayed: 97, youtubeUrl: SYNTHETIC_VIDEO_URL,
      events: [{ videoMinute: '90+7', observation: 'Observación privada sintética' }] } });
    expect(result).not.toHaveProperty('expectedVersion');
    expect(JSON.stringify(result)).not.toMatch(/rating|score|evaluation|analystIdentityId|intentDigest/i);
    expect(await capture.get(fixture.analystId, fixture.loadedMatchId)).toMatchObject({ availability: 'UNAVAILABLE' });
    expect(await capture.get(fixture.analystId, fixture.loadedMatchId)).not.toHaveProperty('upload');
    const owner = await ownerView.get({ passportId: fixture.passportId, actorIdentityId: fixture.ownerId });
    const passport = await prisma.playerPassport.findUniqueOrThrow({ where: { id: fixture.passportId },
      select: { id: true, state: true, originKind: true, position: true, ageCategory: true, city: true,
        country: true, dominantFoot: true, createdAt: true, updatedAt: true } });
    const contaminatedPresentation = { ...passport, displayName: 'Jugador sintético',
      youtubeUrl: SYNTHETIC_VIDEO_URL, events: result.upload?.events,
      observation: 'Observación privada sintética' };
    const publicPresentation = toPassportPresentationResponse(contaminatedPresentation, []);
    expect(owner).toMatchObject({ outcome: 'ok', flow: { state: 'LOADED' } });
    const analystList = await analystMatches.list(fixture.analystId, { limit: 50 });
    expect(JSON.stringify(owner) + JSON.stringify(analystList) + JSON.stringify(publicPresentation))
      .not.toMatch(/youtubeUrl|Observación privada|"events"|videoMinute|Feature011TestVideo/);
  });

  it('denies foreign and nonexistent IDs alike and denies every read after custody, role or identity revocation', async () => {
    const missing = '00000000-0000-4000-8000-000000000099';
    for (const matchId of [fixture.otherMatchId, missing]) {
      await expect(capture.get(fixture.analystId, matchId)).rejects.toMatchObject({ kind: 'NOT_FOUND', message: 'Resource unavailable' });
    }
    const before = await prisma.firstMatch.findUniqueOrThrow({ where: { id: fixture.waitingMatchId } });
    await prisma.passportCustody.update({ where: { passportId: fixture.passportId }, data: { currentAnalystIdentityId: fixture.otherAnalystId } });
    try { await expect(capture.get(fixture.analystId, fixture.waitingMatchId)).rejects.toMatchObject({ kind: 'NOT_FOUND' }); }
    finally { await prisma.passportCustody.update({ where: { passportId: fixture.passportId }, data: { currentAnalystIdentityId: fixture.analystId } }); }
    await prisma.roleAssignment.updateMany({ where: { identityId: fixture.analystId, role: 'ANALYST' }, data: { status: 'REVOKED' } });
    try { await expect(capture.get(fixture.analystId, fixture.waitingMatchId)).rejects.toMatchObject({ kind: 'FORBIDDEN' }); }
    finally { await prisma.roleAssignment.updateMany({ where: { identityId: fixture.analystId, role: 'ANALYST' }, data: { status: 'ACTIVE' } }); }
    await prisma.identity.update({ where: { id: fixture.analystId }, data: { status: 'INACTIVE' } });
    try { await expect(capture.get(fixture.analystId, fixture.waitingMatchId)).rejects.toMatchObject({ kind: 'FORBIDDEN' }); }
    finally { await prisma.identity.update({ where: { id: fixture.analystId }, data: { status: 'ACTIVE' } }); }
    expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: fixture.waitingMatchId } })).toEqual(before);
  });
});
