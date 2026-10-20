import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AnalystMatchUploadAccess } from '../../src/analyst-match-upload/application/analyst-match-upload-access.js';
import { ConfirmAnalystMatchUpload } from '../../src/analyst-match-upload/application/confirm-analyst-match-upload.js';
import { AnalystMatchUploadRepository } from '../../src/analyst-match-upload/persistence/analyst-match-upload.repository.js';
import { ConfirmedLoadService } from '../../src/first-match/application/confirmed-load.service.js';
import { FirstMatchRepository } from '../../src/first-match/persistence/first-match.repository.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { AllowanceTransactionRunner } from '../../src/passport-match-allowance/persistence/allowance-transaction.runner.js';
import { createAnalystMatchUploadFixture, SYNTHETIC_VIDEO_URL } from '../analyst-match-upload-test-helpers.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const firstMatch = new FirstMatchRepository(new AllowanceTransactionRunner(prisma as never));
const repository = new AnalystMatchUploadRepository();
const service = new ConfirmAnalystMatchUpload(prisma as never, new AnalystMatchUploadAccess(prisma as never),
  repository, firstMatch, new ConfirmedLoadService(firstMatch));
const event = { sequence: 1, eventType: 'GOAL', result: 'NONE', videoMinute: '90+7', context: {}, complexity: {},
  observation: 'Acción visible' };
const body = { expectedVersion: 1, participation: 'PARTICIPATED', totalMinutesPlayed: 97,
  youtubeUrl: SYNTHETIC_VIDEO_URL, events: [event] };

describe('Feature 011 atomic final confirmation on isolated PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createAnalystMatchUploadFixture>>;
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature011_test_[a-f0-9]{12}$/);
    const client = await pool.connect();
    try { fixture = await createAnalystMatchUploadFixture(client); } finally { client.release(); }
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('persists only a complete upload and moves the same reserved unit to used', async () => {
    const before = await prisma.firstMatch.findUniqueOrThrow({ where: { id: fixture.waitingMatchId } });
    const key = randomUUID();
    const result = await service.confirm(fixture.analystId, fixture.waitingMatchId, key, body);
    expect(result).toMatchObject({ outcome: 'APPLIED', matchId: fixture.waitingMatchId, totalMinutesPlayed: 97 });
    const after = await prisma.firstMatch.findUniqueOrThrow({ where: { id: fixture.waitingMatchId } });
    expect(before).toMatchObject({ state: 'WAITING', unitState: 'RESERVED' });
    expect(after).toMatchObject({ state: 'LOADED', unitState: 'USED', loadId: key, version: before.version + 1 });
    const upload = await prisma.analystMatchUpload.findUniqueOrThrow({ where: { loadId: key }, include: { events: true } });
    expect(upload).toMatchObject({ firstMatchId: fixture.waitingMatchId, totalMinutesPlayed: 97,
      youtubeUrl: SYNTHETIC_VIDEO_URL });
    expect(upload.events).toHaveLength(1);
    expect(upload.events[0]?.catalogVersion).toBe(1);
    expect(upload.events[0]?.observation).toBe('Acción visible');
    expect(await prisma.firstMatch.count({ where: { id: fixture.waitingMatchId, unitState: 'USED' } })).toBe(1);
    expect(JSON.stringify(upload)).not.toMatch(/rating|score|evaluation/i);
  });

  it('rolls back inserted upload, events and operational transition if proof verification fails', async () => {
    const key = randomUUID();
    const spy = vi.spyOn(repository, 'verifyConfirmedData').mockRejectedValueOnce(new Error('injected proof failure'));
    try {
      await expect(service.confirm(fixture.analystId, fixture.rescheduledMatchId, key,
        { ...body, expectedVersion: 2 })).rejects.toThrow('injected proof failure');
    } finally { spy.mockRestore(); }
    expect(await prisma.analystMatchUpload.findUnique({ where: { loadId: key } })).toBeNull();
    expect(await prisma.analystMatchEvent.count({ where: { loadId: key } })).toBe(0);
    expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: fixture.rescheduledMatchId } }))
      .toMatchObject({ state: 'WAITING', unitState: 'RESERVED', version: 2, loadId: null });
  });

  it('persists a valid event with empty optional observation after the failed attempt was rolled back', async () => {
    const key = randomUUID();
    await service.confirm(fixture.analystId, fixture.rescheduledMatchId, key,
      { ...body, expectedVersion: 2, events: [{ ...event, observation: '' }] });
    const upload = await prisma.analystMatchUpload.findUniqueOrThrow({ where: { loadId: key }, include: { events: true } });
    expect(upload.events[0]?.observation).toBe('');
    expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id: fixture.rescheduledMatchId } }))
      .toMatchObject({ state: 'LOADED', unitState: 'USED', loadId: key });
  });
});
