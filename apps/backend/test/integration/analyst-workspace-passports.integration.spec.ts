import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AnalystWorkspaceAccess } from '../../src/analyst-workspace/application/analyst-workspace-access.js';
import { AnalystPassportReadRepository } from '../../src/analyst-workspace/persistence/analyst-passport-read.repository.js';
import { Feature009ConfirmedMatchSource } from '../../src/analyst-workspace/persistence/confirmed-match-source.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { decryptPassportValue } from '../../src/player-passport/player-private-identity/passport-crypto.js';
import { addSyntheticPlayerName } from '../analyst-passport-fixtures.js';
import { createAnalystWorkspaceFixture } from '../analyst-workspace-test-helpers.js';
import { TEST_PASSPORT_KEYS } from './registration-personal-test-fixture.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const access = new AnalystWorkspaceAccess(prisma as never);
const repo = new AnalystPassportReadRepository(new Feature009ConfirmedMatchSource(),
  { decrypt: (value: string) => decryptPassportValue(TEST_PASSPORT_KEYS.privateEncryptionKey, value) });

describe('Feature 010 passport portfolio on isolated PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createAnalystWorkspaceFixture>>;
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature010_test_[a-f0-9]{12}$/);
    const client = await pool.connect();
    try {
      fixture = await createAnalystWorkspaceFixture(client);
      for (const [playerId, name] of [
        [fixture.playerId, 'Jugador propio'], [fixture.personalMinor.playerId, 'Menor propia'],
        [fixture.academyAdult.playerId, 'Jugador academia'], [fixture.academyMinor.playerId, 'Menor academia'],
        [fixture.other.playerId, 'Jugador ajeno'], [fixture.unassigned.playerId, 'Sin custodio'],
        [fixture.nonActive.playerId, 'No activo'],
      ] as [string, string][]) await addSyntheticPlayerName(client, playerId, name);
      await client.query(`UPDATE "PlayerPassport" SET "enrichmentStatus" = 'AWAITING_ANALYST_ENRICHMENT' WHERE id = $1`, [fixture.personalMinor.passportId]);
    } finally { client.release(); }
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('paginates every ACTIVE owned passport regardless of enrichment without leaking civil fields', async () => {
    const read = (cursor?: string) => access.readCollection(fixture.analystId,
      (scope) => repo.list(scope, { limit: 2, ...(cursor ? { cursor } : {}) }, new Date('2026-10-15T15:00:00Z')));
    const first = await read();
    expect(first.data).toHaveLength(2);
    expect(first.pagination.hasMore).toBe(true);
    const second = await read(first.pagination.nextCursor);
    const all = [...first.data, ...second.data];
    expect(all.map((row) => row.passportId).sort()).toEqual([
      fixture.passportId, fixture.personalMinor.passportId, fixture.academyAdult.passportId, fixture.academyMinor.passportId,
    ].sort());
    expect(all.find((row) => row.passportId === fixture.personalMinor.passportId)?.playerName).toBe('Menor propia');
    expect(all.find((row) => row.passportId === fixture.passportId)?.nextMatch?.id).toBe(fixture.waitingMatchId);
    expect(JSON.stringify(all)).not.toMatch(/encrypted|document|birth|contact|phone|email|createdByIdentityId|enrichmentStatus/i);
  });

  it('rechecks direct custody and leaves passport and match unchanged', async () => {
    const before = await prisma.playerPassport.findUniqueOrThrow({ where: { id: fixture.passportId }, select: { version: true } });
    const owned = await access.readPassport(fixture.analystId, fixture.passportId, (scope) => repo.detail(scope, new Date('2026-10-15T15:00:00Z')));
    expect(owned.playerName).toBe('Jugador propio');
    await expect(access.readPassport(fixture.analystId, fixture.other.passportId, (scope) => repo.detail(scope, new Date()))).rejects.toMatchObject({ kind: 'NOT_FOUND' });
    await expect(access.readPassport(fixture.analystId, '11111111-1111-4111-8111-111111111111', (scope) => repo.detail(scope, new Date()))).rejects.toMatchObject({ kind: 'NOT_FOUND' });
    expect(await prisma.playerPassport.findUniqueOrThrow({ where: { id: fixture.passportId }, select: { version: true } })).toEqual(before);
    expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: fixture.waitingMatchId }, select: { state: true, unitState: true } }))
      .toEqual({ state: 'WAITING', unitState: 'RESERVED' });
  });
});
