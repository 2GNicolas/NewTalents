import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AnalystMatchUploadAccess } from '../../src/analyst-match-upload/application/analyst-match-upload-access.js';
import { ConfirmedUploadSources } from '../../src/analyst-match-upload/application/confirmed-upload-source.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { createAnalystMatchUploadFixture } from '../analyst-match-upload-test-helpers.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const access = new AnalystMatchUploadAccess(prisma as never);
const sources = new ConfirmedUploadSources();

describe('Feature 011 access and source on isolated PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createAnalystMatchUploadFixture>>;

  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature011_test_[a-f0-9]{12}$/);
    const client = await pool.connect();
    try { fixture = await createAnalystMatchUploadFixture(client); }
    finally { client.release(); }
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('reads only own ACTIVE passport matches and never fabricates a later source', async () => {
    const match = await access.readMatch(fixture.analystId, fixture.waitingMatchId, async (scope) => scope.match);
    expect(sources.forMatch(match)).toEqual({ sourceKind: 'FIRST_MATCH', availability: 'AVAILABLE', expectedVersion: 1 });
    const rescheduled = await access.readMatch(fixture.analystId, fixture.rescheduledMatchId, async (scope) => scope.match);
    expect(sources.forMatch(rescheduled)).toMatchObject({ expectedVersion: 2 });
    const loaded = await access.readMatch(fixture.analystId, fixture.loadedMatchId, async (scope) => scope.match);
    expect(sources.forMatch(loaded)).toEqual({ sourceKind: 'FIRST_MATCH', availability: 'UNAVAILABLE' });
    expect(sources.registeredKinds).toEqual(['FIRST_MATCH']);
  });

  it('denies foreign, missing, canceled, inactive-passport and unassigned matches identically', async () => {
    for (const id of [fixture.otherMatchId, fixture.unassignedMatchId, fixture.nonActiveMatchId,
      fixture.canceledMatchId, '00000000-0000-4000-8000-000000000099']) {
      await expect(access.readMatch(fixture.analystId, id, async () => 'secret'))
        .rejects.toMatchObject({ kind: 'NOT_FOUND', message: 'Resource unavailable' });
    }
    for (const id of [fixture.ownerId, fixture.revokedAnalystId, fixture.inactiveAnalystId]) {
      await expect(access.readMatch(id, fixture.waitingMatchId, async () => 'secret'))
        .rejects.toMatchObject({ kind: 'FORBIDDEN' });
    }
  });

  it('does not grant access from historical custody after reassignment', async () => {
    await prisma.passportCustody.update({ where: { passportId: fixture.passportId },
      data: { currentAnalystIdentityId: fixture.otherAnalystId } });
    try {
      await expect(access.readMatch(fixture.analystId, fixture.waitingMatchId, async () => 'secret'))
        .rejects.toMatchObject({ kind: 'NOT_FOUND' });
      expect(await access.readMatch(fixture.otherAnalystId, fixture.waitingMatchId,
        async (scope) => scope.match.id)).toBe(fixture.waitingMatchId);
    } finally {
      await prisma.passportCustody.update({ where: { passportId: fixture.passportId },
        data: { currentAnalystIdentityId: fixture.analystId } });
    }
  });
});
