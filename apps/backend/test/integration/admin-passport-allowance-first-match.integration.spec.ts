import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthorizationService } from '../../src/authorization/authorization.service.js';
import { FirstMatchRepository } from '../../src/first-match/persistence/first-match.repository.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { AdministratorAllowanceAuthorization } from '../../src/passport-match-allowance/application/administrator-allowance-authorization.js';
import { AllowanceCommand } from '../../src/passport-match-allowance/application/allowance-command.js';
import { AllowanceTransactionRunner } from '../../src/passport-match-allowance/persistence/allowance-transaction.runner.js';
import { createFirstMatchFixture, insertSyntheticFirstMatch } from '../first-match-test-helpers.js';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const clock = () => new Date('2026-02-10T16:00:00.000Z');
const command = new AllowanceCommand(new AllowanceTransactionRunner(prisma as never, async () => undefined),
  new AdministratorAllowanceAuthorization(prisma as never, new AuthorizationService()), clock);
const repository = new FirstMatchRepository(new AllowanceTransactionRunner(prisma as never, async () => undefined));
const capacityAt = (passportId: string, matchDate: string) => repository.executeLocked(passportId, async (transaction) =>
  repository.countPeriod(transaction, await repository.loadAllowanceSource(transaction, passportId), matchDate));

describe('Feature 008 revision with first-match units on isolated PostgreSQL', () => {
  beforeAll(async () => {
    expect(new URL(connectionString).pathname).toMatch(/^\/newtalents_feature009_test_[a-f0-9]{12}$/);
    await prisma.$queryRaw`SELECT 1`;
  });
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });

  it('accepts a boundary-effective lower limit equal to one RESERVED unit and preserves that match', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client, { limit: 4 });
      await client.query(`INSERT INTO "RoleAssignment" (id, "identityId", role, "assignedByIdentityId")
        VALUES (gen_random_uuid(), $1, 'ADMINISTRATOR', $1)`, [f.ownerId]);
      const id = await insertSyntheticFirstMatch(client, f, { date: '2026-03-01' });
      const before = await prisma.firstMatch.findUniqueOrThrow({ where: { id } });
      expect(await capacityAt(f.passportId, '2026-02-27')).toMatchObject({
        period: { start: '2026-01-31', endExclusive: '2026-02-28' }, matchLimit: 4, reserved: 0, used: 0,
      });
      const result = await command.confirm({ passportId: f.passportId, administratorIdentityId: f.ownerId,
        expectedVersion: 1, idempotencyKey: randomUUID(), cadence: 'QUARTERLY', matchLimit: 1 });
      expect(result).toMatchObject({ outcome: 'applied', configuration: { version: 2,
        pendingRule: { effectiveOn: '2026-02-28', cadence: 'QUARTERLY', matchLimit: 1 } } });
      expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id } })).toEqual(before);
      expect(await prisma.passportMatchAllowanceRevision.count({ where: { allowanceId: f.allowanceId } })).toBe(2);
      expect(await capacityAt(f.passportId, '2026-02-27')).toMatchObject({
        period: { start: '2026-01-31', endExclusive: '2026-02-28' }, matchLimit: 4, reserved: 0, used: 0,
      });
      expect(await capacityAt(f.passportId, '2026-02-28')).toMatchObject({
        period: { start: '2026-02-28', endExclusive: '2026-05-28' }, matchLimit: 1, reserved: 1, used: 0, available: 0,
      });
      expect(await capacityAt(f.passportId, '2026-05-28')).toMatchObject({
        period: { start: '2026-05-28' }, matchLimit: 1, reserved: 0, used: 0, available: 1,
      });
    } finally { client.release(); }
  });

  it('counts a USED match at the proposed boundary without releasing or moving it', async () => {
    const client = await pool.connect();
    try {
      const f = await createFirstMatchFixture(client, { limit: 2, withCustody: true });
      await client.query(`INSERT INTO "RoleAssignment" (id, "identityId", role, "assignedByIdentityId")
        VALUES (gen_random_uuid(), $1, 'ADMINISTRATOR', $1)`, [f.ownerId]);
      const id = await insertSyntheticFirstMatch(client, f, { date: '2026-02-28', state: 'LOADED' });
      const before = await prisma.firstMatch.findUniqueOrThrow({ where: { id } });
      expect(await capacityAt(f.passportId, '2026-02-28')).toMatchObject({
        period: { start: '2026-02-28', endExclusive: '2026-03-31' }, matchLimit: 2, reserved: 0, used: 1,
      });
      expect((await command.confirm({ passportId: f.passportId, administratorIdentityId: f.ownerId,
        expectedVersion: 1, idempotencyKey: randomUUID(), cadence: 'MONTHLY', matchLimit: 1 })).outcome).toBe('applied');
      expect(await prisma.firstMatch.findUniqueOrThrow({ where: { id } })).toEqual(before);
      expect(await capacityAt(f.passportId, '2026-02-27')).toMatchObject({
        period: { start: '2026-01-31', endExclusive: '2026-02-28' }, matchLimit: 2, reserved: 0, used: 0,
      });
      expect(await capacityAt(f.passportId, '2026-02-28')).toMatchObject({
        period: { start: '2026-02-28', endExclusive: '2026-03-31' }, matchLimit: 1, reserved: 0, used: 1, available: 0,
      });
      expect(await prisma.passportMatchAllowanceRevision.count({ where: { allowanceId: f.allowanceId } })).toBe(2);
    } finally { client.release(); }
  });
});
