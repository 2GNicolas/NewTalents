import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PassportCustodyCommandService } from '../../src/passport-custody/application/passport-custody-command.service.js';
import { PassportCustodyQueryService } from '../../src/passport-custody/application/passport-custody-query.service.js';
import { PassportCustodyRepository } from '../../src/passport-custody/persistence/passport-custody.repository.js';
import { PassportCustodyTransactionRunner } from '../../src/passport-custody/persistence/passport-custody-transaction.runner.js';
import { PassportTransactionRunner } from '../../src/player-passport/passport-lifecycle/transaction-runner.js';
import { decryptPassportValue } from '../../src/player-passport/player-private-identity/passport-crypto.js';
import { PersonalAdultApprovalOrchestrator } from '../../src/registration-requests/outcomes/personal-adult-approval.orchestrator.js';
import { RegistrationAgePolicy } from '../../src/registration-requests/personal/registration-age-policy.js';
import { cleanupPersonalFixtures, createSubmittedPersonalRequest, TEST_PASSPORT_KEYS } from './registration-personal-test-fixture.js';

const connectionString = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

describe('Feature 007 custody A -> B -> unassigned', () => {
  const requestIds: string[] = [];
  const ownerIds: string[] = [];
  const staffIds: string[] = [];
  const passportIds: string[] = [];

  beforeAll(async () => { await prisma.$queryRaw`SELECT 1`; });

  afterAll(async () => {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
      if (passportIds.length) {
        await transaction.passportCustodyEvent.deleteMany({ where: { passportId: { in: passportIds } } });
        await transaction.passportCustody.deleteMany({ where: { passportId: { in: passportIds } } });
      }
      if (staffIds.length) await transaction.analystOperationalProfile.deleteMany({ where: { identityId: { in: staffIds } } });
    });
    await cleanupPersonalFixtures(prisma, requestIds, [...ownerIds, ...staffIds]);
    await prisma.$disconnect();
  });

  it('commits A to B to unassigned with live workloads, one authority row, and exact events', async () => {
    const passportId = await approvedPassport();
    const { administratorId, analystA, analystB } = await staffFixture();
    const commands = new PassportCustodyCommandService(new PassportCustodyTransactionRunner(prisma as never, async () => undefined));
    const queries = new PassportCustodyQueryService(new PassportCustodyRepository(prisma as never), {
      decrypt: (value) => decryptPassportValue(TEST_PASSPORT_KEYS.privateEncryptionKey, value),
    });

    await expect(commands.assign({
      passportId, administratorIdentityId: administratorId, analystIdentityId: analystA,
      expectedVersion: 0, idempotencyKey: randomUUID(),
    })).resolves.toMatchObject({ outcome: 'applied', custody: { state: 'ASSIGNED', version: 1, analystIdentityId: analystA } });
    expect(await authority(passportId)).toEqual({ currentAnalystIdentityId: analystA, version: 1 });
    expect(await workloads(queries, analystA, analystB)).toEqual({ a: 1, b: 0 });

    await expect(commands.change({
      passportId, administratorIdentityId: administratorId, analystIdentityId: analystB,
      expectedVersion: 1, idempotencyKey: randomUUID(), reason: 'Cambio confirmado a Analista B',
    })).resolves.toMatchObject({ outcome: 'applied', custody: { state: 'ASSIGNED', version: 2, analystIdentityId: analystB } });
    expect(await authority(passportId)).toEqual({ currentAnalystIdentityId: analystB, version: 2 });
    expect(await workloads(queries, analystA, analystB)).toEqual({ a: 0, b: 1 });
    expect(await prisma.passportCustody.count({ where: { passportId } })).toBe(1);

    await expect(commands.remove({
      passportId, administratorIdentityId: administratorId,
      expectedVersion: 2, idempotencyKey: randomUUID(), reason: 'Retiro confirmado de custodia',
    })).resolves.toMatchObject({ outcome: 'applied', custody: { state: 'UNASSIGNED', version: 3 } });
    expect(await authority(passportId)).toEqual({ currentAnalystIdentityId: null, version: 3 });
    expect(await workloads(queries, analystA, analystB)).toEqual({ a: 0, b: 0 });
    expect(await prisma.passportCustody.count({ where: { passportId } })).toBe(1);

    const events = await prisma.passportCustodyEvent.findMany({
      where: { passportId }, orderBy: { sequence: 'asc' },
      select: { action: true, sequence: true, previousAnalystIdentityId: true, nextAnalystIdentityId: true },
    });
    expect(events).toEqual([
      { action: 'ASSIGNED', sequence: 1, previousAnalystIdentityId: null, nextAnalystIdentityId: analystA },
      { action: 'CHANGED', sequence: 2, previousAnalystIdentityId: analystA, nextAnalystIdentityId: analystB },
      { action: 'REMOVED', sequence: 3, previousAnalystIdentityId: analystB, nextAnalystIdentityId: null },
    ]);
  });

  async function approvedPassport(): Promise<string> {
    const fixture = await createSubmittedPersonalRequest(prisma, { type: 'PERSONAL_ADULT', playerDocument: `F007-US4-${randomUUID()}`, playerBirthDate: '1990-01-15' });
    requestIds.push(fixture.requestId);
    ownerIds.push(fixture.ownerIdentityId);
    const result = await new PersonalAdultApprovalOrchestrator(new PassportTransactionRunner(prisma as never, async () => undefined), new RegistrationAgePolicy(), TEST_PASSPORT_KEYS).approve({
      requestId: fixture.requestId, expectedVersion: 0, actorIdentityId: fixture.ownerIdentityId,
      idempotencyKey: randomUUID(), operationInstant: new Date('2026-10-01T09:00:00.000Z'),
    });
    if (!isRecord(result) || !isRecord(result.passport) || typeof result.passport.id !== 'string') throw new Error('Expected approved passport');
    passportIds.push(result.passport.id);
    return result.passport.id;
  }

  async function staffFixture() {
    const administratorId = randomUUID();
    const analystA = randomUUID();
    const analystB = randomUUID();
    staffIds.push(administratorId, analystA, analystB);
    await prisma.identity.createMany({ data: [{ id: administratorId }, { id: analystA }, { id: analystB }] });
    await prisma.roleAssignment.createMany({ data: [
      { identityId: administratorId, assignedByIdentityId: administratorId, role: 'ADMINISTRATOR', status: 'ACTIVE' },
      { identityId: analystA, assignedByIdentityId: administratorId, role: 'ANALYST', status: 'ACTIVE' },
      { identityId: analystB, assignedByIdentityId: administratorId, role: 'ANALYST', status: 'ACTIVE' },
    ] });
    await prisma.analystOperationalProfile.createMany({ data: [
      { identityId: analystA, displayLabel: 'Analista A', normalizedLabel: 'analista a' },
      { identityId: analystB, displayLabel: 'Analista B', normalizedLabel: 'analista b' },
    ] });
    return { administratorId, analystA, analystB };
  }

  async function authority(passportId: string) {
    return prisma.passportCustody.findUniqueOrThrow({ where: { passportId }, select: { currentAnalystIdentityId: true, version: true } });
  }

  async function workloads(queries: PassportCustodyQueryService, analystA: string, analystB: string) {
    const result = await queries.listAnalysts({ limit: 50 });
    if (!('items' in result)) throw new Error('Expected analysts');
    return {
      a: result.items.find((item) => item.identityId === analystA)?.activeCustodyCount,
      b: result.items.find((item) => item.identityId === analystB)?.activeCustodyCount,
    };
  }
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
