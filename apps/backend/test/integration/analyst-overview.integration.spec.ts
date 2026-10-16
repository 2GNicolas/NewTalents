import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AnalystOverview } from '../../src/analyst-workspace/application/analyst-overview.js';
import { AnalystWorkspaceAccess } from '../../src/analyst-workspace/application/analyst-workspace-access.js';
import { Feature009ConfirmedMatchSource } from '../../src/analyst-workspace/persistence/confirmed-match-source.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { decryptPassportValue, encryptPassportValue } from '../../src/player-passport/player-private-identity/passport-crypto.js';
import { createAnalystWorkspaceFixture } from '../analyst-workspace-test-helpers.js';
import { TEST_PASSPORT_KEYS } from './registration-personal-test-fixture.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const access = new AnalystWorkspaceAccess(prisma as never);
const source = new Feature009ConfirmedMatchSource();
const labels = { decrypt: (ciphertext: string) => decryptPassportValue(TEST_PASSPORT_KEYS.privateEncryptionKey, ciphertext) };

describe('Feature 010 overview on isolated PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createAnalystWorkspaceFixture>>;
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature010_test_[a-f0-9]{12}$/);
    const client = await pool.connect();
    try {
      fixture = await createAnalystWorkspaceFixture(client);
      const encrypt = (value: string) => encryptPassportValue(TEST_PASSPORT_KEYS.privateEncryptionKey, value);
      await client.query(`INSERT INTO "PlayerPrivateIdentity" (id, "playerId", "encryptedLegalName", "encryptedDateOfBirth",
        "encryptedDocumentType", "encryptedDocumentNumber", "documentFingerprint", "nameDobFingerprint", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`, [randomUUID(), fixture.playerId,
        encrypt('Jugador Sintético'), encrypt('2000-01-01'), encrypt('CC'), encrypt('ficticio'), randomUUID(), randomUUID()]);
    } finally { client.release(); }
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  const at = (instant: string) => new AnalystOverview(access, source, labels, () => new Date(instant));

  it('moves one real WAITING match from upcoming to pending exactly at the Bogota boundary', async () => {
    const before = await at('2026-11-01T14:59:59.000Z').get(fixture.analystId);
    expect(before.analystLabel).toBe('Analista sintetico');
    expect(before.upcoming.data.map((match) => match.id)).toEqual([fixture.waitingMatchId]);
    expect(before.pending.data).toEqual([]);
    expect(before.upcoming.data[0]?.playerName).toBe('Jugador Sintético');
    const exact = await at('2026-11-01T15:00:00.000Z').get(fixture.analystId);
    expect(exact.pending.data.map((match) => match.id)).toEqual([fixture.waitingMatchId]);
    expect(exact.upcoming.data).toEqual([]);
    expect(exact.completed).toEqual({ availability: 'UNAVAILABLE' });
    expect(JSON.stringify(exact)).not.toMatch(/document|encrypted|unitState|loadId|contact/i);
    expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: fixture.waitingMatchId }, select: { state: true, unitState: true } }))
      .toEqual({ state: 'WAITING', unitState: 'RESERVED' });
  });

  it('drops the match after confirmed load without presenting a completed analysis', async () => {
    await prisma.firstMatch.update({ where: { id: fixture.waitingMatchId }, data: {
      state: 'LOADED', unitState: 'USED', loadedByAnalystIdentityId: fixture.analystId,
      loadId: randomUUID(), loadedAt: new Date(), version: 2,
    } });
    const after = await at('2026-11-01T15:00:01.000Z').get(fixture.analystId);
    expect(after.pending.data).toEqual([]);
    expect(after.upcoming.data).toEqual([]);
    expect(after.completed).toEqual({ availability: 'UNAVAILABLE' });
  });
});
