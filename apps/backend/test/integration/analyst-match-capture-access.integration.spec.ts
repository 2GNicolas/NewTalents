import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AnalystMatchUploadAccess } from '../../src/analyst-match-upload/application/analyst-match-upload-access.js';
import { AnalystMatchCapture } from '../../src/analyst-match-upload/application/analyst-match-capture.js';
import { ConfirmedUploadSources } from '../../src/analyst-match-upload/application/confirmed-upload-source.js';
import { ReadAnalystMatchUpload } from '../../src/analyst-match-upload/application/read-analyst-match-upload.js';
import { AnalystMatchUploadRepository } from '../../src/analyst-match-upload/persistence/analyst-match-upload.repository.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { createAnalystMatchUploadFixture } from '../analyst-match-upload-test-helpers.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const capture = new AnalystMatchCapture(new AnalystMatchUploadAccess(prisma as never), new ConfirmedUploadSources(),
  new ReadAnalystMatchUpload(new AnalystMatchUploadRepository()));

describe('Feature 011 capture read on isolated PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createAnalystMatchUploadFixture>>;
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature011_test_[a-f0-9]{12}$/);
    const client = await pool.connect();
    try { fixture = await createAnalystMatchUploadFixture(client); } finally { client.release(); }
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('projects only eligible own WAITING matches and unavailable historical LOADED', async () => {
    expect(await capture.get(fixture.analystId, fixture.waitingMatchId)).toEqual({
      matchId: fixture.waitingMatchId, passportId: fixture.passportId, sourceKind: 'FIRST_MATCH', availability: 'AVAILABLE', expectedVersion: 1,
    });
    expect(await capture.get(fixture.analystId, fixture.rescheduledMatchId)).toMatchObject({ availability: 'AVAILABLE', expectedVersion: 2 });
    const loaded = await capture.get(fixture.analystId, fixture.loadedMatchId);
    expect(loaded).toMatchObject({ availability: 'UNAVAILABLE' });
    expect(loaded).not.toHaveProperty('expectedVersion');
    expect(loaded).not.toHaveProperty('upload');
  });

  it('denies foreign/missing alike, rechecks role and custody, and has no read-side writes', async () => {
    const before = await prisma.firstMatch.findUniqueOrThrow({ where: { id: fixture.waitingMatchId } });
    const missing = '00000000-0000-4000-8000-000000000099';
    for (const matchId of [fixture.otherMatchId, fixture.canceledMatchId, missing]) {
      await expect(capture.get(fixture.analystId, matchId)).rejects.toMatchObject({ kind: 'NOT_FOUND', message: 'Resource unavailable' });
    }
    await expect(capture.get(fixture.revokedAnalystId, fixture.waitingMatchId)).rejects.toMatchObject({ kind: 'FORBIDDEN' });
    await prisma.passportCustody.update({ where: { passportId: fixture.passportId }, data: { currentAnalystIdentityId: fixture.otherAnalystId } });
    try {
      await expect(capture.get(fixture.analystId, fixture.waitingMatchId)).rejects.toMatchObject({ kind: 'NOT_FOUND' });
    } finally {
      await prisma.passportCustody.update({ where: { passportId: fixture.passportId }, data: { currentAnalystIdentityId: fixture.analystId } });
    }
    expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: fixture.waitingMatchId } })).toEqual(before);
  });
});
