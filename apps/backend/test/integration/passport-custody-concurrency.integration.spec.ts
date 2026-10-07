import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PassportCustodyCommandService, type AssignPassportCustodyCommand } from '../../src/passport-custody/application/passport-custody-command.service.js';
import { PassportCustodyTransactionRunner, type CustodyTransactionClient } from '../../src/passport-custody/persistence/passport-custody-transaction.runner.js';
import { PassportTransactionRunner } from '../../src/player-passport/passport-lifecycle/transaction-runner.js';
import { PersonalAdultApprovalOrchestrator } from '../../src/registration-requests/outcomes/personal-adult-approval.orchestrator.js';
import { RegistrationAgePolicy } from '../../src/registration-requests/personal/registration-age-policy.js';
import { cleanupPersonalFixtures, createSubmittedPersonalRequest, TEST_PASSPORT_KEYS } from './registration-personal-test-fixture.js';

const connectionString = process.env.DATABASE_URL!;
const prisma = client();
const competingClient = client();

describe('Feature 007 custody concurrency and exact-once outcomes', () => {
  const requestIds: string[] = [];
  const ownerIds: string[] = [];
  const staffIds: string[] = [];
  const passportIds: string[] = [];
  let administratorA: string;
  let administratorB: string;
  let analystA: string;
  let analystB: string;

  beforeAll(async () => {
    await Promise.all([prisma.$queryRaw`SELECT 1`, competingClient.$queryRaw`SELECT 1`]);
    administratorA = randomUUID();
    administratorB = randomUUID();
    analystA = randomUUID();
    analystB = randomUUID();
    staffIds.push(administratorA, administratorB, analystA, analystB);
    await prisma.identity.createMany({ data: staffIds.map((id) => ({ id })) });
    await prisma.roleAssignment.createMany({ data: [
      { identityId: administratorA, assignedByIdentityId: administratorA, role: 'ADMINISTRATOR', status: 'ACTIVE' },
      { identityId: administratorB, assignedByIdentityId: administratorA, role: 'ADMINISTRATOR', status: 'ACTIVE' },
      { identityId: analystA, assignedByIdentityId: administratorA, role: 'ANALYST', status: 'ACTIVE' },
      { identityId: analystB, assignedByIdentityId: administratorA, role: 'ANALYST', status: 'ACTIVE' },
    ] });
    await prisma.analystOperationalProfile.createMany({ data: [
      { identityId: analystA, displayLabel: 'Analista Concurrencia A', normalizedLabel: 'analista concurrencia a' },
      { identityId: analystB, displayLabel: 'Analista Concurrencia B', normalizedLabel: 'analista concurrencia b' },
    ] });
  });

  afterAll(async () => {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
      if (passportIds.length) {
        await transaction.passportCustodyEvent.deleteMany({ where: { passportId: { in: passportIds } } });
        await transaction.passportCustody.deleteMany({ where: { passportId: { in: passportIds } } });
      }
      await transaction.analystOperationalProfile.deleteMany({ where: { identityId: { in: staffIds } } });
    });
    await cleanupPersonalFixtures(prisma, requestIds, [...ownerIds, ...staffIds]);
    await Promise.all([prisma.$disconnect(), competingClient.$disconnect()]);
  });

  it('allows one competing destination, replays the winner, and leaves one version/event', async () => {
    const passportId = await approvedPassport();
    const keyA = randomUUID();
    const keyB = randomUUID();
    const inputA = assignment(passportId, administratorA, analystA, keyA);
    const inputB = assignment(passportId, administratorB, analystB, keyB);
    const [first, second] = await Promise.all([commands(prisma).assign(inputA), commands(competingClient).assign(inputB)]);

    expect([first.outcome, second.outcome].sort()).toEqual(['applied', 'conflict']);
    const winnerInput = first.outcome === 'applied' ? inputA : inputB;
    const winningResult = first.outcome === 'applied' ? first : second;
    const replay = await commands(competingClient).assign(winnerInput);
    expect(replay).toMatchObject({ outcome: 'idempotent', eventId: 'eventId' in winningResult ? winningResult.eventId : undefined, custody: { version: 1 } });

    const authority = await prisma.passportCustody.findUniqueOrThrow({ where: { passportId }, select: { currentAnalystIdentityId: true, version: true } });
    expect(authority).toEqual({ currentAnalystIdentityId: winnerInput.analystIdentityId, version: 1 });
    expect(await prisma.passportCustody.count({ where: { passportId } })).toBe(1);
    expect(await prisma.passportCustodyEvent.findMany({ where: { passportId }, select: { sequence: true, action: true } })).toEqual([{ sequence: 1, action: 'ASSIGNED' }]);
  });

  it('serializes simultaneous change/remove, exposes the winner, and succeeds after refresh with a new intention', async () => {
    const baselineA = await activeLoad(analystA);
    const baselineB = await activeLoad(analystB);
    const passportId = await approvedPassport();
    await commands(prisma).assign(assignment(passportId, administratorA, analystA, randomUUID()));
    const [change, remove] = await Promise.all([
      commands(prisma).change({ passportId, administratorIdentityId: administratorA, analystIdentityId: analystB, expectedVersion: 1, idempotencyKey: randomUUID(), reason: 'Cambio concurrente a B' }),
      commands(competingClient).remove({ passportId, administratorIdentityId: administratorB, expectedVersion: 1, idempotencyKey: randomUUID(), reason: 'Retiro concurrente' }),
    ]);
    expect([change.outcome, remove.outcome].sort()).toEqual(['applied', 'conflict']);

    const afterRace = await authority(passportId);
    expect(afterRace.version).toBe(2);
    expect(await prisma.passportCustodyEvent.count({ where: { passportId, sequence: 2 } })).toBe(1);
    expect(await activeLoad(analystA)).toBe(baselineA);
    expect(await activeLoad(analystB)).toBe(baselineB + (afterRace.currentAnalystIdentityId === analystB ? 1 : 0));

    const refreshed = afterRace.currentAnalystIdentityId === analystB
      ? await commands(competingClient).remove({ passportId, administratorIdentityId: administratorB, expectedVersion: 2, idempotencyKey: randomUUID(), reason: 'Retiro tras actualizar' })
      : await commands(competingClient).assign(assignment(passportId, administratorB, analystB, randomUUID(), 2));
    expect(refreshed).toMatchObject({ outcome: 'applied', custody: { version: 3 } });
    expect((await authority(passportId)).currentAnalystIdentityId).toBe(afterRace.currentAnalystIdentityId === analystB ? null : analystB);
    expect((await prisma.passportCustodyEvent.findMany({ where: { passportId }, orderBy: { sequence: 'asc' }, select: { sequence: true } })).map((event) => event.sequence)).toEqual([1, 2, 3]);
  });

  it('rolls back state and event when failure is injected before commit', async () => {
    const passportId = await approvedPassport();
    const injectedRunner = {
      executeLocked: async <T>(_passportId: string, operation: (transaction: CustodyTransactionClient) => Promise<T>): Promise<T> => prisma.$transaction(async (transaction) => {
        await transaction.$queryRawUnsafe(`SELECT "id" FROM "PlayerPassport" WHERE "id" = $1::uuid FOR UPDATE`, passportId);
        await operation(transaction);
        throw new Error('injected pre-commit rollback');
      }),
    };
    const result = await new PassportCustodyCommandService(injectedRunner as never).assign(assignment(passportId, administratorA, analystA, randomUUID()));
    expect(result).toEqual({ outcome: 'unavailable' });
    expect(await prisma.passportCustody.findUnique({ where: { passportId } })).toBeNull();
    expect(await prisma.passportCustodyEvent.count({ where: { passportId } })).toBe(0);
  });

  function commands(database: PrismaClient) {
    return new PassportCustodyCommandService(new PassportCustodyTransactionRunner(database as never, async () => undefined));
  }

  async function approvedPassport(): Promise<string> {
    const fixture = await createSubmittedPersonalRequest(prisma, { type: 'PERSONAL_ADULT', playerDocument: `F007-US5-${randomUUID()}`, playerBirthDate: '1990-01-15' });
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

  function authority(passportId: string) {
    return prisma.passportCustody.findUniqueOrThrow({ where: { passportId }, select: { currentAnalystIdentityId: true, version: true } });
  }

  function activeLoad(analystIdentityId: string) {
    return prisma.passportCustody.count({ where: { currentAnalystIdentityId: analystIdentityId } });
  }
});

function client() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function assignment(passportId: string, administratorIdentityId: string, analystIdentityId: string, idempotencyKey: string, expectedVersion = 0): AssignPassportCustodyCommand {
  return { passportId, administratorIdentityId, analystIdentityId, expectedVersion, idempotencyKey };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
