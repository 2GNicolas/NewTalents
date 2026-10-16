import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AnalystWorkspaceAccess } from '../../src/analyst-workspace/application/analyst-workspace-access.js';
import { AnalystMatches } from '../../src/analyst-workspace/application/analyst-matches.js';
import { AnalystOverview } from '../../src/analyst-workspace/application/analyst-overview.js';
import { AnalystPassports } from '../../src/analyst-workspace/application/analyst-passports.js';
import { AnalystWorkContact } from '../../src/analyst-workspace/application/analyst-work-contact.js';
import { AnalystPassportReadRepository } from '../../src/analyst-workspace/persistence/analyst-passport-read.repository.js';
import { Feature009ConfirmedMatchSource } from '../../src/analyst-workspace/persistence/confirmed-match-source.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { decryptPassportValue } from '../../src/player-passport/player-private-identity/passport-crypto.js';
import { addSyntheticCredential, addSyntheticPlayerName } from '../analyst-passport-fixtures.js';
import { createAnalystWorkspaceFixture } from '../analyst-workspace-test-helpers.js';
import { TEST_PASSPORT_KEYS } from './registration-personal-test-fixture.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const access = new AnalystWorkspaceAccess(prisma as never);
const cipher = { decrypt: (value: string) => decryptPassportValue(TEST_PASSPORT_KEYS.privateEncryptionKey, value) };
const source = new Feature009ConfirmedMatchSource();
const passports = new AnalystPassports(access, new AnalystPassportReadRepository(source, cipher), new AnalystWorkContact(cipher));
const matches = new AnalystMatches(access, source, cipher);
const overview = new AnalystOverview(access, source, cipher, () => new Date('2026-10-15T15:00:00Z'));

describe('Feature 010 live revocation on isolated PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createAnalystWorkspaceFixture>>;
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature010_test_[a-f0-9]{12}$/);
    const client = await pool.connect();
    try {
      fixture = await createAnalystWorkspaceFixture(client);
      for (const [playerId, name] of [[fixture.playerId, 'Jugador propio'], [fixture.personalMinor.playerId, 'Menor propia'],
        [fixture.academyAdult.playerId, 'Jugador academia'], [fixture.academyMinor.playerId, 'Menor academia']] as [string, string][]) {
        await addSyntheticPlayerName(client, playerId, name);
      }
      await addSyntheticCredential(client, fixture.ownerId, 'revocation-adult@example.test');
    } finally { client.release(); }
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('removes name, contact and match from the next read when custody, role or identity changes', async () => {
    const owned = await passports.detail(fixture.analystId, fixture.passportId);
    expect(owned).toMatchObject({ playerName: 'Jugador propio', contact: { availability: 'AVAILABLE', email: 'revocation-adult@example.test' } });
    expect((await matches.detail(fixture.analystId, fixture.waitingMatchId)).playerName).toBe('Jugador propio');
    expect((await overview.get(fixture.analystId)).upcoming.data.some((row) => row.id === fixture.waitingMatchId)).toBe(true);
    const missing = '44444444-4444-4444-8444-444444444444';
    for (const id of [fixture.other.passportId, missing]) {
      await expect(passports.detail(fixture.analystId, id)).rejects.toMatchObject({ kind: 'NOT_FOUND' });
    }
    for (const id of [fixture.other.passportId, missing]) {
      await expect(matches.detail(fixture.analystId, id)).rejects.toMatchObject({ kind: 'NOT_FOUND' });
    }
    await prisma.passportCustody.update({ where: { passportId: fixture.passportId }, data: { currentAnalystIdentityId: fixture.otherAnalystId } });
    expect((await passports.list(fixture.analystId, { limit: 20 })).data.some((row) => row.passportId === fixture.passportId)).toBe(false);
    expect((await matches.list(fixture.analystId, { limit: 20 })).data.some((row) => row.id === fixture.waitingMatchId)).toBe(false);
    expect((await overview.get(fixture.analystId)).upcoming.data.some((row) => row.id === fixture.waitingMatchId)).toBe(false);
    await expect(passports.detail(fixture.analystId, fixture.passportId)).rejects.toMatchObject({ kind: 'NOT_FOUND' });
    await expect(matches.detail(fixture.analystId, fixture.waitingMatchId)).rejects.toMatchObject({ kind: 'NOT_FOUND' });
    await prisma.passportCustody.update({ where: { passportId: fixture.passportId }, data: { currentAnalystIdentityId: null, assignedAt: null } });
    await expect(passports.detail(fixture.analystId, fixture.passportId)).rejects.toMatchObject({ kind: 'NOT_FOUND' });
    await expect(matches.detail(fixture.analystId, fixture.waitingMatchId)).rejects.toMatchObject({ kind: 'NOT_FOUND' });
    expect((await passports.list(fixture.analystId, { limit: 20 })).data.some((row) => row.passportId === fixture.passportId)).toBe(false);
    await prisma.passportCustody.update({ where: { passportId: fixture.passportId }, data: { currentAnalystIdentityId: fixture.analystId, assignedAt: new Date() } });
    const role = await prisma.roleAssignment.findFirstOrThrow({ where: { identityId: fixture.analystId, role: 'ANALYST' } });
    await prisma.roleAssignment.update({ where: { id: role.id }, data: { status: 'REVOKED', revokedAt: new Date() } });
    for (const read of [() => passports.list(fixture.analystId, { limit: 20 }), () => matches.list(fixture.analystId, { limit: 20 }),
      () => overview.get(fixture.analystId), () => passports.detail(fixture.analystId, fixture.passportId),
      () => matches.detail(fixture.analystId, fixture.waitingMatchId)]) await expect(read()).rejects.toMatchObject({ kind: 'FORBIDDEN' });
    await prisma.roleAssignment.update({ where: { id: role.id }, data: { status: 'ACTIVE', revokedAt: null } });
    await prisma.identity.update({ where: { id: fixture.analystId }, data: { status: 'INACTIVE', deactivatedAt: new Date() } });
    for (const read of [() => passports.list(fixture.analystId, { limit: 20 }), () => matches.list(fixture.analystId, { limit: 20 }),
      () => overview.get(fixture.analystId), () => passports.detail(fixture.analystId, fixture.passportId),
      () => matches.detail(fixture.analystId, fixture.waitingMatchId)]) await expect(read()).rejects.toMatchObject({ kind: 'FORBIDDEN' });
    expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: fixture.waitingMatchId }, select: { state: true, unitState: true } }))
      .toEqual({ state: 'WAITING', unitState: 'RESERVED' });
  });
});
