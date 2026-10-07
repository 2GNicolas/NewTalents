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

describe('Feature 007 initial passport custody assignment', () => {
  const requestIds: string[] = [];
  const ownerIds: string[] = [];
  const createdIdentityIds: string[] = [];
  const passportIds: string[] = [];

  beforeAll(async () => { await prisma.$queryRaw`SELECT 1`; });

  afterAll(async () => {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
      if (passportIds.length) {
        await transaction.passportCustodyEvent.deleteMany({ where: { passportId: { in: passportIds } } });
        await transaction.passportCustody.deleteMany({ where: { passportId: { in: passportIds } } });
      }
      if (createdIdentityIds.length) await transaction.analystOperationalProfile.deleteMany({ where: { identityId: { in: createdIdentityIds } } });
      if (requestIds.length) await transaction.registrationManualDossierConfirmation.deleteMany({ where: { requestId: { in: requestIds } } });
    });
    await cleanupPersonalFixtures(prisma, requestIds, [...ownerIds, ...createdIdentityIds]);
    await prisma.$disconnect();
  });

  it('assigns the exact passport linked by Feature 006 with workload +1 and one event', async () => {
    const fixture = await approvedFixture();
    const { administratorId, analystId } = await staffFixture();
    await prisma.registrationManualDossierConfirmation.create({ data: {
      requestId: fixture.requestId,
      requestVersion: 0,
      administratorIdentityId: administratorId,
      transferredCategories: ['IDENTITY_FRONT'],
      declarationVersion: 'synthetic-v1',
    } });

    const linked = await prisma.registrationRequestPlayer.findFirst({
      where: { requestId: fixture.requestId },
      select: { linkedPlayer: { select: { passport: { select: { id: true } } } } },
    });
    expect(linked?.linkedPlayer?.passport?.id).toBe(fixture.passportId);

    const candidates = await new PassportCustodyRepository(prisma as never).listPassportCandidates({
      state: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT', assignment: 'UNASSIGNED', take: 1000,
    });
    expect(candidates.rows.map((item) => item.id)).toContain(fixture.passportId);
    const queries = queryService();
    const before = await queries.listPassports({ assignment: 'UNASSIGNED', query: fixture.passportId.slice(-4), limit: 20 });
    expect('items' in before && before.items.map((item) => item.passportId)).toContain(fixture.passportId);
    const baseline = await immutableCounts(fixture.requestId);

    const commands = commandService();
    const result = await commands.assign({
      passportId: fixture.passportId,
      administratorIdentityId: administratorId,
      analystIdentityId: analystId,
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    });
    expect(result).toMatchObject({ outcome: 'applied', passportId: fixture.passportId, custody: { state: 'ASSIGNED', version: 1, analystIdentityId: analystId } });

    expect(await prisma.passportCustodyEvent.count({ where: { passportId: fixture.passportId, action: 'ASSIGNED' } })).toBe(1);
    expect(await prisma.passportCustodyEvent.findFirst({ where: { passportId: fixture.passportId, action: 'ASSIGNED' }, select: { safeReason: true } })).toEqual({ safeReason: null });
    const analysts = await queries.listAnalysts({ limit: 20 });
    expect('items' in analysts && analysts.items.find((item) => item.identityId === analystId)?.activeCustodyCount).toBe(1);
    const assigned = await queries.listPassports({ assignment: 'ASSIGNED', analystId, limit: 20 });
    expect('items' in assigned && assigned.items.map((item) => item.passportId)).toContain(fixture.passportId);
    expect(await immutableCounts(fixture.requestId)).toEqual(baseline);
  });

  it('rolls back custody state when the event insert fails and creates no privilege', async () => {
    const fixture = await approvedFixture();
    const { administratorId, analystId } = await staffFixture();
    const baselineRoles = await prisma.roleAssignment.count();
    await prisma.passportCustodyEvent.create({ data: {
      passportId: fixture.passportId,
      sequence: 1,
      action: 'ASSIGNED',
      administratorIdentityId: administratorId,
      previousAnalystIdentityId: null,
      nextAnalystIdentityId: analystId,
      safeReason: null,
      expectedVersion: 0,
      resultingVersion: 1,
      idempotencyKey: randomUUID(),
    } });

    const result = await commandService().assign({
      passportId: fixture.passportId,
      administratorIdentityId: administratorId,
      analystIdentityId: analystId,
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    });

    expect(result).toEqual({ outcome: 'unavailable' });
    expect(await prisma.passportCustody.findUnique({ where: { passportId: fixture.passportId } })).toBeNull();
    expect(await prisma.passportCustodyEvent.count({ where: { passportId: fixture.passportId } })).toBe(1);
    expect(await prisma.roleAssignment.count()).toBe(baselineRoles);
    expect(await prisma.playerPassport.count({ where: { id: fixture.passportId } })).toBe(1);
  });

  async function approvedFixture() {
    const fixture = await createSubmittedPersonalRequest(prisma, { type: 'PERSONAL_ADULT', playerDocument: `F007-${randomUUID()}`, playerBirthDate: '1990-01-15' });
    requestIds.push(fixture.requestId);
    ownerIds.push(fixture.ownerIdentityId);
    const result = await new PersonalAdultApprovalOrchestrator(new PassportTransactionRunner(prisma as never, async () => undefined), new RegistrationAgePolicy(), TEST_PASSPORT_KEYS).approve({
      requestId: fixture.requestId,
      expectedVersion: 0,
      actorIdentityId: fixture.ownerIdentityId,
      idempotencyKey: randomUUID(),
      operationInstant: new Date('2026-09-30T15:00:00.000Z'),
    });
    if (!isRecord(result) || !isRecord(result.passport) || typeof result.passport.id !== 'string') throw new Error('Expected Feature 006 passport outcome');
    passportIds.push(result.passport.id);
    return { ...fixture, passportId: result.passport.id };
  }

  async function staffFixture() {
    const administratorId = randomUUID();
    const analystId = randomUUID();
    createdIdentityIds.push(administratorId, analystId);
    await prisma.identity.createMany({ data: [{ id: administratorId }, { id: analystId }] });
    await prisma.roleAssignment.createMany({ data: [
      { identityId: administratorId, assignedByIdentityId: administratorId, role: 'ADMINISTRATOR', status: 'ACTIVE' },
      { identityId: analystId, assignedByIdentityId: administratorId, role: 'ANALYST', status: 'ACTIVE' },
    ] });
    await prisma.analystOperationalProfile.create({ data: { identityId: analystId, displayLabel: `Analista ${analystId.slice(-4)}`, normalizedLabel: `analista ${analystId.slice(-4)}` } });
    return { administratorId, analystId };
  }

  function commandService() {
    return new PassportCustodyCommandService(new PassportCustodyTransactionRunner(prisma as never, async () => undefined));
  }

  function queryService() {
    return new PassportCustodyQueryService(new PassportCustodyRepository(prisma as never), {
      decrypt: (value) => decryptPassportValue(TEST_PASSPORT_KEYS.privateEncryptionKey, value),
    });
  }

  async function immutableCounts(requestId: string) {
    const player = await prisma.registrationRequestPlayer.findFirst({ where: { requestId }, select: { linkedPlayerId: true } });
    return {
      passports: player?.linkedPlayerId ? await prisma.playerPassport.count({ where: { playerId: player.linkedPlayerId } }) : 0,
      dossiers: await prisma.registrationManualDossierConfirmation.count({ where: { requestId } }),
    };
  }
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
