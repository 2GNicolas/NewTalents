import { createHmac, randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PassportTransactionRunner } from '../../src/player-passport/passport-lifecycle/transaction-runner.js';
import { encryptPassportValue } from '../../src/player-passport/player-private-identity/passport-crypto.js';
import { PrivateIdentityService } from '../../src/player-passport/player-private-identity/private-identity.service.js';
import { FormalAcademyApprovalOrchestrator } from '../../src/registration-requests/outcomes/formal-academy-approval.orchestrator.js';
import { NaturalPersonAcademyApprovalOrchestrator } from '../../src/registration-requests/outcomes/natural-person-academy-approval.orchestrator.js';
import { RegistrationAgePolicy } from '../../src/registration-requests/personal/registration-age-policy.js';
import { RegistrationRequestRepository } from '../../src/registration-requests/persistence/registration-request.repository.js';

const connectionString = process.env.DATABASE_URL!;
const clients = [new PrismaClient({ adapter: new PrismaPg({ connectionString }) }), new PrismaClient({ adapter: new PrismaPg({ connectionString }) })] as const;
const keys = { documentHmacKey: Buffer.alloc(32, 1), nameDobHmacKey: Buffer.alloc(32, 2), privateEncryptionKey: Buffer.alloc(32, 3) };
const requestIds: string[] = [];
const identityIds: string[] = [];

function fingerprint(value: string) { return createHmac('sha256', keys.documentHmacKey).update(value).digest('hex'); }
function normalizedName(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase(); }

async function fixture(type: 'FORMAL_ACADEMY' | 'NATURAL_PERSON_ACADEMY', input: Readonly<{ name: string; nit?: string }>) {
  const ownerIdentityId = randomUUID(); const requestId = randomUUID();
  identityIds.push(ownerIdentityId); requestIds.push(requestId);
  await clients[0].identity.create({ data: { id: ownerIdentityId } });
  await clients[0].authenticationCredential.create({ data: { identityId: ownerIdentityId, normalizedEmail: `${ownerIdentityId}@example.test`, passwordHash: 'synthetic-hash' } });
  const identity = new PrivateIdentityService(keys).createPrivateIdentity({ legalName: 'Responsable Sintético', dateOfBirth: '1985-01-01', documentType: 'CC', documentNumber: `R-${ownerIdentityId}` });
  const applicant = { ...identity, identityId: ownerIdentityId, encryptedEmail: 'safe', emailFingerprint: fingerprint(ownerIdentityId), encryptedPhone: 'safe', phoneFingerprint: fingerprint(`phone-${ownerIdentityId}`), derivedAdult: true };
  const common = { encryptedAcademyName: encryptPassportValue(keys.privateEncryptionKey, input.name), academyNameFingerprint: fingerprint(normalizedName(input.name)), encryptedCountry: 'safe', encryptedCity: 'safe' };
  const repository = new RegistrationRequestRepository(clients[0] as never);
  if (type === 'FORMAL_ACADEMY') await repository.createTypedDraft({ requestId, ownerIdentityId, type, detail: { type, responsibleApplicant: applicant, ...common, encryptedOrganizationType: 'safe', encryptedNit: 'safe', nitFingerprint: fingerprint(input.nit!.replace(/[^0-9A-Za-z]/g, '').toUpperCase()), authorityDeclared: true } });
  else await repository.createTypedDraft({ requestId, ownerIdentityId, type, detail: { type, responsibleApplicant: applicant, ...common, encryptedTrainingPlace: 'safe', operationDeclared: true, proofCategories: ['PLACE_USE_AUTHORIZATION'] } });
  await clients[0].registrationApplicantAccess.create({ data: { requestId, identityId: ownerIdentityId, status: 'PENDING_ONBOARDING' } });
  await clients[0].registrationRequest.update({ where: { id: requestId }, data: { status: 'SUBMITTED' } });
  return { requestId, ownerIdentityId };
}

function formal(client: PrismaClient) { return new FormalAcademyApprovalOrchestrator(new PassportTransactionRunner(client as never, async () => undefined), new RegistrationAgePolicy(), keys); }
function natural(client: PrismaClient) { return new NaturalPersonAcademyApprovalOrchestrator(new PassportTransactionRunner(client as never, async () => undefined), new RegistrationAgePolicy(), keys); }

async function cleanup() {
  await clients[0].$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
    const requests = await tx.registrationRequest.findMany({ where: { id: { in: requestIds } }, select: { academyContextId: true } });
    const academyIds = requests.flatMap((item) => item.academyContextId ? [item.academyContextId] : []);
    await tx.registrationApprovalExecution.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationRequestEvent.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationApplicantAccess.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationConsentRecord.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.formalAcademyRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.naturalPersonAcademyRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationRequestApplicant.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationRequest.deleteMany({ where: { id: { in: requestIds } } });
    if (academyIds.length) { await tx.academyMembership.deleteMany({ where: { academyId: { in: academyIds } } }); await tx.academy.deleteMany({ where: { id: { in: academyIds } } }); }
    await tx.roleAssignment.deleteMany({ where: { OR: [{ identityId: { in: identityIds } }, { assignedByIdentityId: { in: identityIds } }] } });
    await tx.authenticationCredential.deleteMany({ where: { identityId: { in: identityIds } } });
    await tx.identity.deleteMany({ where: { id: { in: identityIds } } });
  });
}

describe('Feature 006 academy creation approval', () => {
  beforeAll(async () => Promise.all(clients.map((client) => client.$queryRaw`SELECT 1`)));
  afterAll(async () => { await cleanup(); await Promise.all(clients.map((client) => client.$disconnect())); });

  it('keeps formal and natural-person requests non-operable while pending, then materializes their bounded outcomes', async () => {
    const formalRequest = await fixture('FORMAL_ACADEMY', { name: `Formal ${Date.now()}`, nit: `${Date.now()}` });
    const naturalRequest = await fixture('NATURAL_PERSON_ACADEMY', { name: `Natural ${Date.now()}` });
    expect(await clients[0].academy.count({ where: { memberships: { some: { identityId: { in: [formalRequest.ownerIdentityId, naturalRequest.ownerIdentityId] } } } } })).toBe(0);
    expect(await clients[0].roleAssignment.count({ where: { identityId: { in: [formalRequest.ownerIdentityId, naturalRequest.ownerIdentityId] } } })).toBe(0);
    await expect(formal(clients[0]).approve({ requestId: formalRequest.requestId, expectedVersion: 0 })).resolves.toMatchObject({ responsibleRoles: ['ACADEMY_USER'], membership: 'ACTIVE' });
    await expect(natural(clients[0]).approve({ requestId: naturalRequest.requestId, expectedVersion: 0 })).resolves.toMatchObject({ legalCertificationClaimed: false, responsibleRoles: ['ACADEMY_USER'] });
    expect(await clients[0].academyMembership.count({ where: { identityId: { in: [formalRequest.ownerIdentityId, naturalRequest.ownerIdentityId] }, status: 'ACTIVE' } })).toBe(2);
  });

  it('serializes equivalent formal approvals to one academy and rolls the loser back without privilege', async () => {
    const marker = Date.now(); const one = await fixture('FORMAL_ACADEMY', { name: `Duplicada ${marker}`, nit: `900${marker}` }); const two = await fixture('FORMAL_ACADEMY', { name: ` Duplicada ${marker} `, nit: `900-${marker}` });
    const results = await Promise.allSettled([formal(clients[0]).approve({ requestId: one.requestId, expectedVersion: 0 }), formal(clients[1]).approve({ requestId: two.requestId, expectedVersion: 0 })]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const loser = results[0]?.status === 'rejected' ? one : two;
    expect(await clients[0].roleAssignment.count({ where: { identityId: loser.ownerIdentityId } })).toBe(0);
    expect(await clients[0].academyMembership.count({ where: { identityId: loser.ownerIdentityId } })).toBe(0);
    expect(await clients[0].registrationRequest.findUnique({ where: { id: loser.requestId }, select: { status: true, version: true } })).toEqual({ status: 'SUBMITTED', version: 0 });
    expect(await clients[0].registrationRequestEvent.count({ where: { requestId: loser.requestId } })).toBe(0);
  });

  it('rolls back academy, membership, role and transition when a late write fails', async () => {
    const request = await fixture('NATURAL_PERSON_ACADEMY', { name: `Rollback ${Date.now()}` });
    await expect(natural(clients[0]).approve({ requestId: request.requestId, expectedVersion: 0, actorIdentityId: randomUUID() })).rejects.toBeDefined();
    expect(await clients[0].academyMembership.count({ where: { identityId: request.ownerIdentityId } })).toBe(0);
    expect(await clients[0].roleAssignment.count({ where: { identityId: request.ownerIdentityId } })).toBe(0);
    expect(await clients[0].registrationRequest.findUnique({ where: { id: request.requestId }, select: { status: true, academyContextId: true } })).toEqual({ status: 'SUBMITTED', academyContextId: null });
  });
});
