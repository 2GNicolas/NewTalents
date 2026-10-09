import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PassportTransactionRunner } from '../../src/player-passport/passport-lifecycle/transaction-runner.js';
import { PersonalAdultApprovalOrchestrator } from '../../src/registration-requests/outcomes/personal-adult-approval.orchestrator.js';
import { RegistrationAgePolicy } from '../../src/registration-requests/personal/registration-age-policy.js';
import { cleanupPersonalFixtures, createSubmittedPersonalRequest, TEST_PASSPORT_KEYS } from './registration-personal-test-fixture.js';

const connectionString = process.env.DATABASE_URL!;
const clients = [new PrismaClient({ adapter: new PrismaPg({ connectionString }) }), new PrismaClient({ adapter: new PrismaPg({ connectionString }) })] as const;
const requestIds: string[] = [];
const identityIds: string[] = [];

describe('Feature 006 personal approval concurrency', () => {
  beforeAll(async () => Promise.all(clients.map((client) => client.$queryRaw`SELECT 1`)));
  afterAll(async () => { await cleanupPersonalFixtures(clients[0], requestIds, identityIds); await Promise.all(clients.map((client) => client.$disconnect())); });

  it('materializes at most one identity/player/SELF/passport outcome and rolls the loser back', async () => {
    const document = `A-${Date.now()}`;
    const first = await createSubmittedPersonalRequest(clients[0], { type: 'PERSONAL_ADULT', playerDocument: document, playerBirthDate: '1990-01-01' });
    const second = await createSubmittedPersonalRequest(clients[0], { type: 'PERSONAL_ADULT', playerDocument: document, playerBirthDate: '1990-01-01' });
    requestIds.push(first.requestId, second.requestId); identityIds.push(first.ownerIdentityId, second.ownerIdentityId);
    const approvals = clients.map((client, index) => new PersonalAdultApprovalOrchestrator(new PassportTransactionRunner(client as never, async () => undefined), new RegistrationAgePolicy(), TEST_PASSPORT_KEYS).approve({ requestId: index === 0 ? first.requestId : second.requestId, expectedVersion: 0 }));
    const results = await Promise.allSettled(approvals);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await clients[0].playerPrivateIdentity.count({ where: { documentFingerprint: new (await import('../../src/player-passport/player-private-identity/private-identity.service.js')).PrivateIdentityService(TEST_PASSPORT_KEYS).createPrivateIdentity({ legalName: 'Jugador Sintético', dateOfBirth: '1990-01-01', documentType: 'CC', documentNumber: document }).documentFingerprint } })).toBe(1);
    expect(await clients[0].playerPassport.count({ where: { player: { privateIdentity: { documentFingerprint: new (await import('../../src/player-passport/player-private-identity/private-identity.service.js')).PrivateIdentityService(TEST_PASSPORT_KEYS).createPrivateIdentity({ legalName: 'Jugador Sintético', dateOfBirth: '1990-01-01', documentType: 'CC', documentNumber: document }).documentFingerprint } } } })).toBe(1);
    const rejectedOwner = results[0]?.status === 'rejected' ? first.ownerIdentityId : second.ownerIdentityId;
    const rejectedRequest = results[0]?.status === 'rejected' ? first.requestId : second.requestId;
    expect(await clients[0].roleAssignment.count({ where: { identityId: rejectedOwner, role: 'USER' } })).toBe(0);
    expect(await clients[0].registrationRequest.findUnique({ where: { id: rejectedRequest }, select: { status: true, version: true } })).toEqual({ status: 'SUBMITTED', version: 0 });
  });
});
