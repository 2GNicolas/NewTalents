import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PassportTransactionRunner } from '../../src/player-passport/passport-lifecycle/transaction-runner.js';
import { RepresentedMinorApprovalOrchestrator } from '../../src/registration-requests/outcomes/represented-minor-approval.orchestrator.js';
import { RegistrationAgePolicy } from '../../src/registration-requests/personal/registration-age-policy.js';
import { cleanupPersonalFixtures, createSubmittedPersonalRequest, TEST_PASSPORT_KEYS } from './registration-personal-test-fixture.js';

const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const requestIds: string[] = [];
const identityIds: string[] = [];

describe('Feature 006 one representative with multiple minors', () => {
  beforeAll(async () => client.$queryRaw`SELECT 1`);
  afterAll(async () => { await cleanupPersonalFixtures(client, requestIds, identityIds); await client.$disconnect(); });

  it('keeps separate legal relationships and passports without creating minor accounts', async () => {
    const first = await createSubmittedPersonalRequest(client, { type: 'REPRESENTED_MINOR', playerDocument: `M-${Date.now()}-1`, playerBirthDate: '2015-01-01' });
    identityIds.push(first.ownerIdentityId); requestIds.push(first.requestId);
    const second = await createSubmittedPersonalRequest(client, { type: 'REPRESENTED_MINOR', ownerIdentityId: first.ownerIdentityId, playerDocument: `M-${Date.now()}-2`, playerBirthDate: '2016-01-01' });
    requestIds.push(second.requestId);
    const orchestrator = new RepresentedMinorApprovalOrchestrator(new PassportTransactionRunner(client as never, async () => undefined), new RegistrationAgePolicy(), TEST_PASSPORT_KEYS);
    await orchestrator.approve({ requestId: first.requestId, expectedVersion: 0 });
    await orchestrator.approve({ requestId: second.requestId, expectedVersion: 0 });
    expect(await client.passportResponsibility.count({ where: { identityId: first.ownerIdentityId, kind: 'LEGAL_REPRESENTATIVE' } })).toBe(2);
    expect(await client.playerPassport.count({ where: { responsibilities: { some: { identityId: first.ownerIdentityId } } } })).toBe(2);
    expect(await client.authenticationCredential.count({ where: { identityId: first.ownerIdentityId } })).toBe(1);
  });
});
