import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AnalystWorkspaceAccess } from '../../src/analyst-workspace/application/analyst-workspace-access.js';
import { Feature009ConfirmedMatchSource } from '../../src/analyst-workspace/persistence/confirmed-match-source.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { createAnalystWorkspaceFixture } from '../analyst-workspace-test-helpers.js';
import { insertSyntheticFirstMatch } from '../first-match-test-helpers.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const access = new AnalystWorkspaceAccess(prisma as never);
const source = new Feature009ConfirmedMatchSource();

describe('Feature 010 foundation on isolated PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createAnalystWorkspaceFixture>>;

  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature010_test_[a-f0-9]{12}$/);
    const client = await pool.connect();
    try {
      fixture = await createAnalystWorkspaceFixture(client);
      await insertSyntheticFirstMatch(client, fixture, { date: '2026-11-02', state: 'WAITING',
        passportId: fixture.other.passportId, playerId: fixture.other.playerId });
    } finally { client.release(); }
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('keeps the synthetic responsibility and custody variants valid', async () => {
    expect(await prisma.playerPassport.count({ where: { id: { in: [fixture.passportId, fixture.other.passportId,
      fixture.unassigned.passportId, fixture.nonActive.passportId, fixture.personalMinor.passportId,
      fixture.academyAdult.passportId, fixture.academyMinor.passportId] } } })).toBe(7);
  });

  it('lists only confirmed matches of ACTIVE passports under current custody', async () => {
    const page = await access.readCollection(fixture.analystId, (scope) => source.list(scope, { limit: 10 }));
    expect(page.items.map((item) => item.id).sort()).toEqual([fixture.waitingMatchId, fixture.loadedMatchId].sort());
    expect(page.nextCursor).toBeUndefined();
    expect(page.items.find((item) => item.id === fixture.waitingMatchId)).toMatchObject({
      sourceKind: 'FIRST_MATCH', state: 'WAITING', matchDate: '2026-11-01' });
    expect(page.items.find((item) => item.id === fixture.loadedMatchId)).toMatchObject({ state: 'LOADED' });
    const first = await access.readCollection(fixture.analystId, (scope) => source.list(scope, { limit: 1 }));
    expect(first.nextCursor).toBe(first.items[0]?.id);
    if (!first.nextCursor) throw new Error('Expected a second page');
    const cursor = first.nextCursor;
    const second = await access.readCollection(fixture.analystId, (scope) => source.list(scope, { limit: 1, cursor }));
    expect(second.items).toHaveLength(1);
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
  });

  it('denies foreign, inactive and unassigned passports with the same safe outcome', async () => {
    for (const passportId of [fixture.other.passportId, fixture.nonActive.passportId, fixture.unassigned.passportId,
      '00000000-0000-4000-8000-000000000099']) {
      await expect(access.readPassport(fixture.analystId, passportId, async () => 'secret'))
        .rejects.toMatchObject({ kind: 'NOT_FOUND' });
    }
    for (const identityId of [fixture.inactiveAnalystId, fixture.revokedAnalystId, fixture.ownerId]) {
      await expect(access.readCollection(identityId, async () => 'secret')).rejects.toMatchObject({ kind: 'FORBIDDEN' });
    }
    const foreignMatch = await prisma.firstMatch.findFirstOrThrow({ where: { passportId: fixture.other.passportId }, select: { id: true } });
    expect(await access.readPassport(fixture.analystId, fixture.passportId,
      (scope) => source.find(scope, foreignMatch.id))).toBeNull();
  });

  it('rechecks current custody and returns no data after a transfer', async () => {
    await prisma.passportCustody.update({ where: { passportId: fixture.passportId },
      data: { currentAnalystIdentityId: fixture.otherAnalystId } });
    await expect(access.readPassport(fixture.analystId, fixture.passportId, (scope) => source.find(scope, fixture.waitingMatchId)))
      .rejects.toMatchObject({ kind: 'NOT_FOUND' });
    const formerPage = await access.readCollection(fixture.analystId, (scope) => source.list(scope, { limit: 10 }));
    expect(formerPage.items.map((item) => item.id)).toEqual([fixture.loadedMatchId]);
    expect(await access.readPassport(fixture.otherAnalystId, fixture.passportId, (scope) => source.find(scope, fixture.waitingMatchId)))
      .toMatchObject({ id: fixture.waitingMatchId });
  });
});
