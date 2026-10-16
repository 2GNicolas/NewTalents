import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AnalystWorkspaceAccess } from '../../src/analyst-workspace/application/analyst-workspace-access.js';
import { AnalystMatches } from '../../src/analyst-workspace/application/analyst-matches.js';
import { Feature009ConfirmedMatchSource } from '../../src/analyst-workspace/persistence/confirmed-match-source.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { decryptPassportValue } from '../../src/player-passport/player-private-identity/passport-crypto.js';
import { addSyntheticPlayerName } from '../analyst-passport-fixtures.js';
import { createAnalystWorkspaceFixture } from '../analyst-workspace-test-helpers.js';
import { TEST_PASSPORT_KEYS } from './registration-personal-test-fixture.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const matches = new AnalystMatches(new AnalystWorkspaceAccess(prisma as never), new Feature009ConfirmedMatchSource(),
  { decrypt: (value: string) => decryptPassportValue(TEST_PASSPORT_KEYS.privateEncryptionKey, value) });

describe('Feature 010 match reading on isolated PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createAnalystWorkspaceFixture>>;
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature010_test_[a-f0-9]{12}$/);
    const client = await pool.connect();
    try {
      fixture = await createAnalystWorkspaceFixture(client);
      for (const [playerId, name] of [[fixture.playerId, 'Jugadora propia'],
        [fixture.personalMinor.playerId, 'Menor propia'], [fixture.other.playerId, 'Jugador ajeno']] as [string, string][]) {
        await addSyntheticPlayerName(client, playerId, name);
      }
    } finally { client.release(); }
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('pages own WAITING and LOADED matches without leaking unpublished fields or mutating records', async () => {
    const before = await prisma.firstMatch.findUniqueOrThrow({ where: { id: fixture.waitingMatchId }, select: { state: true, unitState: true } });
    const first = await matches.list(fixture.analystId, { limit: 1 });
    expect(first.data).toHaveLength(1);
    expect(first.pagination.hasMore).toBe(true);
    const second = await matches.list(fixture.analystId, { limit: 1, ...(first.pagination.nextCursor ? { cursor: first.pagination.nextCursor } : {}) });
    const rows = [...first.data, ...second.data];
    expect(rows.map((row) => row.state).sort()).toEqual(['LOADED', 'WAITING']);
    expect(rows.find((row) => row.id === fixture.waitingMatchId)?.playerName).toBe('Jugadora propia');
    expect(JSON.stringify(rows)).not.toMatch(/contact|document|unitState|loadId|metric|analysis/i);
    expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: fixture.waitingMatchId }, select: { state: true, unitState: true } })).toEqual(before);
  });

  it('rechecks direct custody, reflects rescheduling and excludes cancellation', async () => {
    const own = await matches.detail(fixture.analystId, fixture.waitingMatchId);
    expect(own.state).toBe('WAITING');
    await expect(matches.detail(fixture.otherAnalystId, fixture.waitingMatchId)).rejects.toMatchObject({ kind: 'NOT_FOUND' });
    await expect(matches.detail(fixture.analystId, '33333333-3333-4333-8333-333333333333')).rejects.toMatchObject({ kind: 'NOT_FOUND' });
    await prisma.firstMatch.update({ where: { id: fixture.waitingMatchId }, data: { matchTime: '17:30', opponent: 'Rival actualizado', version: { increment: 1 } } });
    expect(await matches.detail(fixture.analystId, fixture.waitingMatchId)).toMatchObject({ id: fixture.waitingMatchId, matchTime: '17:30', opponent: 'Rival actualizado' });
    await prisma.firstMatch.update({ where: { id: fixture.waitingMatchId }, data: { state: 'CANCELED', unitState: 'RELEASED',
      canceledByIdentityId: fixture.ownerId, canceledAt: new Date(), version: { increment: 1 } } });
    expect((await matches.list(fixture.analystId, { limit: 20 })).data.map((row) => row.id)).not.toContain(fixture.waitingMatchId);
    await expect(matches.detail(fixture.analystId, fixture.waitingMatchId)).rejects.toMatchObject({ kind: 'NOT_FOUND' });
  });
});
