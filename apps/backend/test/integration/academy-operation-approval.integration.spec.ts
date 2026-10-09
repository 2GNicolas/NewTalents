import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PassportTransactionRunner } from '../../src/player-passport/passport-lifecycle/transaction-runner.js';
import { encryptPassportValue } from '../../src/player-passport/player-private-identity/passport-crypto.js';
import { PrivateIdentityService } from '../../src/player-passport/player-private-identity/private-identity.service.js';
import { AcademyAdultPlayerApprovalOrchestrator } from '../../src/registration-requests/outcomes/academy-adult-player-approval.orchestrator.js';
import { AcademyMinorPlayerApprovalOrchestrator } from '../../src/registration-requests/outcomes/academy-minor-player-approval.orchestrator.js';
import { AdditionalAcademyAccountApprovalOrchestrator } from '../../src/registration-requests/outcomes/additional-academy-account-approval.orchestrator.js';
import { RegistrationAgePolicy } from '../../src/registration-requests/personal/registration-age-policy.js';
import { RegistrationRequestRepository, type RegistrationApplicantCreate, type RegistrationPlayerCreate, type RegistrationRepresentativeCreate } from '../../src/registration-requests/persistence/registration-request.repository.js';

const connectionString = process.env.DATABASE_URL!;
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const keys = { documentHmacKey: Buffer.alloc(32, 31), nameDobHmacKey: Buffer.alloc(32, 32), privateEncryptionKey: Buffer.alloc(32, 33) };
const privateIdentity = new PrivateIdentityService(keys);
const requestIds: string[] = [];
const identityIds: string[] = [];
const academyIds: string[] = [];

async function authority() {
  const ownerIdentityId = randomUUID(); const academyId = randomUUID(); const sourceRequestId = randomUUID();
  identityIds.push(ownerIdentityId); academyIds.push(academyId); requestIds.push(sourceRequestId);
  await client.identity.create({ data: { id: ownerIdentityId } });
  await client.roleAssignment.create({ data: { identityId: ownerIdentityId, role: 'ACADEMY_USER', assignedByIdentityId: ownerIdentityId } });
  await client.academy.create({ data: { id: academyId, displayName: 'Academia sintética aprobada' } });
  await client.academyMembership.create({ data: { identityId: ownerIdentityId, academyId, assignedByIdentityId: ownerIdentityId } });
  const identity = privateIdentity.createPrivateIdentity({ legalName: 'Responsable Sintético', dateOfBirth: '1980-01-01', documentType: 'CC', documentNumber: `SRC-${sourceRequestId}` });
  await new RegistrationRequestRepository(client as never).createTypedDraft({ requestId: sourceRequestId, type: 'FORMAL_ACADEMY', ownerIdentityId, academyContextId: academyId, detail: { type: 'FORMAL_ACADEMY', responsibleApplicant: { ...identity, identityId: ownerIdentityId, derivedAdult: true }, encryptedAcademyName: 'safe', academyNameFingerprint: randomUUID(), encryptedCountry: 'safe', encryptedCity: 'safe', encryptedOrganizationType: 'safe', encryptedNit: 'safe', nitFingerprint: randomUUID(), authorityDeclared: true } });
  await client.registrationRequest.update({ where: { id: sourceRequestId }, data: { status: 'APPROVED' } });
  return { ownerIdentityId, academyId };
}

function applicant(identityId: string, marker: string): RegistrationApplicantCreate { return { ...privateIdentity.createPrivateIdentity({ legalName: 'Cuenta Sintética', dateOfBirth: '1991-01-01', documentType: 'CC', documentNumber: marker }), identityId, derivedAdult: true }; }
function player(marker: string, birthDate: string, adult: boolean): RegistrationPlayerCreate { return { ...privateIdentity.createPrivateIdentity({ legalName: 'Jugador Sintético', dateOfBirth: birthDate, documentType: adult ? 'CC' : 'RC', documentNumber: marker }), encryptedCountry: encryptPassportValue(keys.privateEncryptionKey, 'Colombia'), encryptedCity: encryptPassportValue(keys.privateEncryptionKey, 'Bogotá'), derivedAdult: adult }; }
function representative(marker: string): RegistrationRepresentativeCreate { const value = privateIdentity.createPrivateIdentity({ legalName: 'Representante Sintético', dateOfBirth: '1984-01-01', documentType: 'CC', documentNumber: marker }); return { encryptedLegalName: value.encryptedLegalName, encryptedDocumentType: value.encryptedDocumentType, encryptedDocumentNumber: value.encryptedDocumentNumber, documentFingerprint: value.documentFingerprint, encryptedPhone: encryptPassportValue(keys.privateEncryptionKey, '+573000000001'), phoneFingerprint: randomUUID(), relationship: 'MOTHER', authorityDeclared: true }; }

async function cleanup() {
  await client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
    await tx.registrationApprovalExecution.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationRequestEvent.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.passportResponsibility.deleteMany({ where: { passport: { originAcademyId: { in: academyIds } } } });
    await tx.playerPassport.deleteMany({ where: { originAcademyId: { in: academyIds } } });
    await tx.additionalAcademyAccountRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.academyAdultPlayerRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.academyMinorPlayerRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.formalAcademyRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationRequestRepresentative.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationRequestApplicant.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationRequestPlayer.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationRequest.deleteMany({ where: { id: { in: requestIds } } });
    await tx.academyMembership.deleteMany({ where: { academyId: { in: academyIds } } });
    await tx.roleAssignment.deleteMany({ where: { OR: [{ identityId: { in: identityIds } }, { assignedByIdentityId: { in: identityIds } }] } });
    await tx.academy.deleteMany({ where: { id: { in: academyIds } } });
    await tx.identity.deleteMany({ where: { id: { in: identityIds } } });
  });
}

describe('Feature 006 approved-academy operation outcomes', () => {
  beforeAll(async () => { await client.$queryRaw`SELECT 1`; });
  afterAll(async () => { await cleanup(); await client.$disconnect(); });

  it('materializes each bounded outcome and no implicit USER, SELF or automatic account', async () => {
    const { ownerIdentityId, academyId } = await authority(); const repository = new RegistrationRequestRepository(client as never);
    const targetIdentityId = randomUUID(); identityIds.push(targetIdentityId); await client.identity.create({ data: { id: targetIdentityId } });
    const accountRequestId = randomUUID(); const adultRequestId = randomUUID(); const minorRequestId = randomUUID(); requestIds.push(accountRequestId, adultRequestId, minorRequestId);
    await repository.createTypedDraft({ requestId: accountRequestId, type: 'ADDITIONAL_ACADEMY_ACCOUNT', ownerIdentityId, academyContextId: academyId, detail: { type: 'ADDITIONAL_ACADEMY_ACCOUNT', applicant: applicant(targetIdentityId, `ACC-${accountRequestId}`), encryptedFunction: 'safe', responsibleAuthorization: true } });
    await repository.createTypedDraft({ requestId: adultRequestId, type: 'ACADEMY_ADULT_PLAYER', ownerIdentityId, academyContextId: academyId, detail: { type: 'ACADEMY_ADULT_PLAYER', player: player(`ADULT-${adultRequestId}`, '1992-01-01', true), adultAuthorization: true } });
    await repository.createTypedDraft({ requestId: minorRequestId, type: 'ACADEMY_MINOR_PLAYER', ownerIdentityId, academyContextId: academyId, detail: { type: 'ACADEMY_MINOR_PLAYER', player: player(`MINOR-${minorRequestId}`, '2014-01-01', false), representative: representative(`REP-${minorRequestId}`), authorityDeclared: true } });
    await client.registrationRequest.updateMany({ where: { id: { in: [accountRequestId, adultRequestId, minorRequestId] } }, data: { status: 'SUBMITTED' } });
    const runner = new PassportTransactionRunner(client as never, async () => undefined); const ages = new RegistrationAgePolicy();
    await expect(new AdditionalAcademyAccountApprovalOrchestrator(runner, ages, keys).approve({ requestId: accountRequestId, expectedVersion: 0 })).resolves.toMatchObject({ identityRoles: ['ACADEMY_USER'], membership: 'ACTIVE', userPrivilege: false });
    await expect(new AcademyAdultPlayerApprovalOrchestrator(runner, ages, keys).approve({ requestId: adultRequestId, expectedVersion: 0, operationInstant: new Date('2026-09-28T12:00:00Z') })).resolves.toMatchObject({ passportCount: 1, responsibility: 'ACADEMY', userCreated: false, selfResponsibilityCreated: false });
    await expect(new AcademyMinorPlayerApprovalOrchestrator(runner, ages, keys).approve({ requestId: minorRequestId, expectedVersion: 0, operationInstant: new Date('2026-09-28T12:00:00Z') })).resolves.toMatchObject({ responsibilities: ['LEGAL_REPRESENTATIVE', 'ACADEMY'], automaticAccounts: 0 });
    expect(await client.roleAssignment.findMany({ where: { identityId: targetIdentityId }, select: { role: true } })).toEqual([{ role: 'ACADEMY_USER' }]);
    expect(await client.passportResponsibility.count({ where: { kind: 'SELF', passport: { originAcademyId: academyId } } })).toBe(0);
    expect(await client.authenticationCredential.count({ where: { identityId: targetIdentityId } })).toBe(0);
    expect(await client.registrationRequest.count({ where: { id: { in: [accountRequestId, adultRequestId, minorRequestId] }, status: 'APPROVED', approvalExecutionStatus: 'FINALIZED' } })).toBe(3);
  });

  it('rechecks active matching membership and rolls back the complete outcome when it is stale', async () => {
    const { ownerIdentityId, academyId } = await authority(); const requestId = randomUUID(); requestIds.push(requestId);
    await new RegistrationRequestRepository(client as never).createTypedDraft({ requestId, type: 'ACADEMY_ADULT_PLAYER', ownerIdentityId, academyContextId: academyId, detail: { type: 'ACADEMY_ADULT_PLAYER', player: player(`STALE-${requestId}`, '1990-01-01', true), adultAuthorization: true } });
    await client.registrationRequest.update({ where: { id: requestId }, data: { status: 'SUBMITTED' } });
    await client.academyMembership.updateMany({ where: { identityId: ownerIdentityId, academyId }, data: { status: 'ENDED', endedAt: new Date() } });
    const runner = new PassportTransactionRunner(client as never, async () => undefined);
    await expect(new AcademyAdultPlayerApprovalOrchestrator(runner, new RegistrationAgePolicy(), keys).approve({ requestId, expectedVersion: 0 })).rejects.toThrow('ACADEMY_OPERATION_NOT_AUTHORIZED');
    expect(await client.playerPassport.count({ where: { originAcademyId: academyId } })).toBe(0);
    expect(await client.registrationRequest.findUnique({ where: { id: requestId }, select: { status: true, version: true } })).toEqual({ status: 'SUBMITTED', version: 0 });
  });
});
