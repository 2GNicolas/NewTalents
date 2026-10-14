import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { ConfirmedLoadService } from '../../src/first-match/application/confirmed-load.service.js';
import { FirstMatchAccess } from '../../src/first-match/application/first-match-access.js';
import { FirstMatchCommand } from '../../src/first-match/application/first-match-command.js';
import { FirstMatchQuery } from '../../src/first-match/application/first-match-query.js';
import { FirstMatchController } from '../../src/first-match/http/first-match.controller.js';
import { FirstMatchExceptionFilter } from '../../src/first-match/http/first-match-exception.filter.js';
import { FirstMatchRepository } from '../../src/first-match/persistence/first-match.repository.js';
import { PrismaClient, Prisma } from '../../src/generated/prisma/client.js';
import { AllowanceTransactionRunner } from '../../src/passport-match-allowance/persistence/allowance-transaction.runner.js';
import { createFirstMatchFixture } from '../first-match-test-helpers.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const repository = new FirstMatchRepository(new AllowanceTransactionRunner(prisma as never, async () => undefined));
const access = new FirstMatchAccess();
const command = new FirstMatchCommand(repository, access);
const query = new FirstMatchQuery(repository, access);
const controller = new FirstMatchController(query, command);
const load = new ConfirmedLoadService(repository);
const fields = { matchDate: '2026-02-28', matchTime: '10:00', opponent: 'Rival sintético',
  competition: 'Liga sintética', venue: 'Cancha sintética' };

describe('Feature 009 private response and audit boundary on isolated PostgreSQL', () => {
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature009_test_[a-f0-9]{12}$/);
    await prisma.$executeRawUnsafe('CREATE TABLE "Feature009PrivacyConfirmedLoad" (match_id uuid NOT NULL, load_id uuid NOT NULL UNIQUE)');
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('projects only authorized match details; missing and foreign direct IDs produce the same safe error', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client, { withCustody: true });
      const other = await createFirstMatchFixture(client);
      const booked = await command.schedule({ passportId: f.passportId, actorIdentityId: f.ownerId,
        expectedVersion: 0, idempotencyKey: randomUUID(), ...fields });
      expect(booked.outcome).toBe('applied');
      const request = { actor: { identityId: f.ownerId, sessionId: randomUUID() } } as never;
      const allowed = await controller.get(request, f.passportId);
      const serialized = JSON.stringify(allowed);
      expect(serialized).toContain(fields.opponent);
      expect(serialized).not.toMatch(/scheduledByIdentityId|loadedByAnalystIdentityId|analystIdentityId|playerId|evidence|civil|provisional|fem|metrics/i);
      expect(serialized).not.toContain(f.analystId);
      expect(serialized).not.toContain(f.playerId);
      const foreign = { actor: { identityId: other.ownerId, sessionId: randomUUID() } } as never;
      const absent = await controller.get(foreign, randomUUID()).catch((error: unknown) => error);
      const denied = await controller.get(foreign, f.passportId).catch((error: unknown) => error);
      expect(denied).toMatchObject({ outcome: 'not-found' });
      expect(absent).toMatchObject({ outcome: 'not-found' });
      const renderError = (error: unknown) => {
        const response = { header: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis(), json: vi.fn() };
        new FirstMatchExceptionFilter().catch(error as never,
          { switchToHttp: () => ({ getResponse: () => response }) } as never);
        return { status: response.status.mock.calls[0]?.[0], body: response.json.mock.calls[0]?.[0] };
      };
      expect(renderError(denied)).toEqual(renderError(absent));
      expect(JSON.stringify(renderError(denied))).not.toContain(f.passportId);
      const preview = await controller.preview(request, f.passportId, fields.matchDate);
      expect(JSON.stringify(preview)).not.toMatch(/analyst|identity|player|evidence|metric/i);
    } finally { client.release(); }
  });

  it('retains actor/time audit for schedule, move, release and RESERVED → USED without leaking it to the responsible flow', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client, { withCustody: true });
      const first = await command.schedule({ passportId: f.passportId, actorIdentityId: f.ownerId,
        expectedVersion: 0, idempotencyKey: randomUUID(), ...fields });
      if (!('matchId' in first)) throw new Error('first booking failed');
      expect(await command.reschedule({ passportId: f.passportId, matchId: first.matchId,
        actorIdentityId: f.ownerId, expectedVersion: 1, idempotencyKey: randomUUID(),
        ...fields, matchDate: '2026-03-31' })).toMatchObject({ outcome: 'applied' });
      expect(await command.cancel({ passportId: f.passportId, matchId: first.matchId,
        actorIdentityId: f.ownerId, expectedVersion: 2, idempotencyKey: randomUUID() }))
        .toMatchObject({ outcome: 'applied' });
      const second = await command.schedule({ passportId: f.passportId, actorIdentityId: f.ownerId,
        expectedVersion: 0, idempotencyKey: randomUUID(), ...fields });
      if (!('matchId' in second)) throw new Error('second booking failed');
      const loadId = randomUUID();
      expect(await prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`INSERT INTO "Feature009PrivacyConfirmedLoad" (match_id, load_id)
          VALUES (${second.matchId}::uuid, ${loadId}::uuid)`);
        return load.confirmFirstMatchDataLoad(tx, { passportId: f.passportId, matchId: second.matchId,
          analystIdentityId: f.analystId, loadId, expectedVersion: 1, confirmedAt: new Date() },
        async (sameTx, proof) => {
          const rows = await sameTx.$queryRaw<{ match_id: string; load_id: string }[]>(Prisma.sql`
            SELECT match_id, load_id FROM "Feature009PrivacyConfirmedLoad"
            WHERE match_id = ${proof.matchId}::uuid AND load_id = ${proof.loadId}::uuid`);
          return rows[0] ? { matchId: rows[0].match_id, loadId: rows[0].load_id } : null;
        });
      }, { isolationLevel: 'Serializable' })).toMatchObject({ outcome: 'applied' });
      const intents = await prisma.firstMatchIntent.findMany({ where: { passportId: f.passportId },
        orderBy: { occurredAt: 'asc' } });
      expect(intents.map((intent) => intent.action).sort()).toEqual(['CANCEL', 'LOAD_CONFIRMED', 'RESCHEDULE', 'SCHEDULE', 'SCHEDULE']);
      expect(intents.every((intent) => intent.occurredAt instanceof Date && intent.actorIdentityId)).toBe(true);
      expect(intents.find((intent) => intent.action === 'LOAD_CONFIRMED')?.actorIdentityId).toBe(f.analystId);
      expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: first.matchId } })).toMatchObject({
        unitState: 'RELEASED', canceledByIdentityId: f.ownerId, canceledAt: expect.any(Date),
      });
      expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: second.matchId } })).toMatchObject({
        unitState: 'USED', loadedByAnalystIdentityId: f.analystId, loadedAt: expect.any(Date),
      });
      const flow = await query.get({ passportId: f.passportId, actorIdentityId: f.ownerId });
      expect(flow).toMatchObject({ flow: { state: 'LOADED', allowedActions: [] } });
      expect(JSON.stringify(flow)).not.toContain(f.analystId);
      expect(JSON.stringify(flow)).not.toMatch(/loadedByAnalystIdentityId|scheduledByIdentityId|loadId|evidence|provisional/i);
    } finally { client.release(); }
  });
});
