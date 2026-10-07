import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PrismaClient, type RegistrationRequestType } from '../../src/generated/prisma/client.js';
import { AdminRegistrationDecisionService } from '../../src/registration-requests/review/admin-registration-decision.service.js';
import { ApprovalExecutionService } from '../../src/registration-requests/review/approval-execution.service.js';
import { RegistrationRequestRepository, type RegistrationTypedDraftInput } from '../../src/registration-requests/persistence/registration-request.repository.js';

const connectionString = process.env.DATABASE_URL!;
const clients = [new PrismaClient({ adapter: new PrismaPg({ connectionString }) }), new PrismaClient({ adapter: new PrismaPg({ connectionString }) })] as const;
const requestIds: string[] = [];
const identityIds: string[] = [];
const academyIds: string[] = [];

const applicant = (marker: string) => ({ encryptedLegalName: 'synthetic', encryptedDateOfBirth: 'synthetic', encryptedDocumentType: 'synthetic', encryptedDocumentNumber: 'synthetic', documentFingerprint: `app-doc-${marker}`, nameDobFingerprint: `app-name-${marker}`, encryptedPhone: 'synthetic', phoneFingerprint: `phone-${marker}`, derivedAdult: true });
const player = (marker: string, derivedAdult = true) => ({ encryptedLegalName: 'synthetic', encryptedDateOfBirth: 'synthetic', encryptedDocumentType: 'synthetic', encryptedDocumentNumber: 'synthetic', documentFingerprint: `player-doc-${marker}`, nameDobFingerprint: `player-name-${marker}`, encryptedCountry: 'synthetic', encryptedCity: 'synthetic', derivedAdult });
const representative = (marker: string) => ({ encryptedLegalName: 'synthetic', encryptedDocumentType: 'synthetic', encryptedDocumentNumber: 'synthetic', documentFingerprint: `rep-doc-${marker}`, encryptedPhone: 'synthetic', phoneFingerprint: `rep-phone-${marker}`, relationship: 'MOTHER' as const, authorityDeclared: true as const });

async function createSubmitted(type: RegistrationRequestType) {
  const requestId = randomUUID(); const ownerIdentityId = randomUUID(); const marker = requestId;
  requestIds.push(requestId); identityIds.push(ownerIdentityId);
  await clients[0].identity.create({ data: { id: ownerIdentityId } });
  let academyContextId: string | undefined;
  if (type === 'ADDITIONAL_ACADEMY_ACCOUNT' || type === 'ACADEMY_ADULT_PLAYER' || type === 'ACADEMY_MINOR_PLAYER') {
    academyContextId = randomUUID(); academyIds.push(academyContextId);
    await clients[0].academy.create({ data: { id: academyContextId, displayName: `Academia sintética ${marker}` } });
  }
  const base = { requestId, ownerIdentityId, ...(academyContextId ? { academyContextId } : {}) };
  let input: RegistrationTypedDraftInput;
  if (type === 'PERSONAL_ADULT') input = { ...base, type, detail: { type, applicant: applicant(marker), player: player(marker), actingForSelf: true } };
  else if (type === 'REPRESENTED_MINOR') input = { ...base, type, detail: { type, applicant: applicant(marker), player: player(marker, false), relationship: 'MOTHER', authorityDeclared: true } };
  else if (type === 'FORMAL_ACADEMY') input = { ...base, type, detail: { type, responsibleApplicant: applicant(marker), encryptedAcademyName: 'synthetic', academyNameFingerprint: `academy-${marker}`, encryptedCountry: 'synthetic', encryptedCity: 'synthetic', encryptedOrganizationType: 'synthetic', encryptedNit: 'synthetic', nitFingerprint: `nit-${marker}`, authorityDeclared: true } };
  else if (type === 'NATURAL_PERSON_ACADEMY') input = { ...base, type, detail: { type, responsibleApplicant: applicant(marker), encryptedAcademyName: 'synthetic', academyNameFingerprint: `academy-${marker}`, encryptedCountry: 'synthetic', encryptedCity: 'synthetic', operationDeclared: true, proofCategories: ['PLACE_USE_AUTHORIZATION'] } };
  else if (type === 'ADDITIONAL_ACADEMY_ACCOUNT') input = { ...base, type, academyContextId: academyContextId!, detail: { type, applicant: applicant(marker), encryptedFunction: 'synthetic', responsibleAuthorization: true } };
  else if (type === 'ACADEMY_ADULT_PLAYER') input = { ...base, type, academyContextId: academyContextId!, detail: { type, player: player(marker), adultAuthorization: true } };
  else input = { ...base, type: 'ACADEMY_MINOR_PLAYER', academyContextId: academyContextId!, detail: { type: 'ACADEMY_MINOR_PLAYER', player: player(marker, false), representative: representative(marker), authorityDeclared: true } };
  await new RegistrationRequestRepository(clients[0] as never).createTypedDraft(input);
  await clients[0].registrationEvidenceItem.create({ data: { requestId, category: 'IDENTITY_FRONT', objectKey: `feature-006/${randomUUID()}`, declaredMime: 'application/pdf', detectedMime: 'application/pdf', sizeBytes: 128, contentDigest: `digest-${marker}`, status: 'CLEAN' } });
  await clients[0].registrationRequest.update({ where: { id: requestId }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
  return { requestId, ownerIdentityId };
}

function approvalService(client: PrismaClient, calls: RegistrationRequestType[]) {
  const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }) };
  const typed = { readiness: vi.fn().mockResolvedValue({ ageRouteCompatible: true, representationComplete: true }) };
  const orchestrator = (type: RegistrationRequestType) => ({ approve: vi.fn(async ({ requestId, expectedVersion }: { requestId: string; expectedVersion: number }) => {
    calls.push(type);
    await client.$transaction(async (tx) => {
      const updated = await tx.registrationRequest.updateMany({ where: { id: requestId, status: 'SUBMITTED', version: expectedVersion }, data: { status: 'APPROVED', version: { increment: 1 }, approvalExecutionStatus: 'FINALIZED', decidedAt: new Date() } });
      if (updated.count !== 1) throw new Error('STALE_REGISTRATION_REQUEST');
      await tx.registrationApprovalExecution.update({ where: { requestId_requestVersion: { requestId, requestVersion: expectedVersion } }, data: { status: 'FINALIZED', attempts: { increment: 1 }, resultReferences: { type }, finalizedAt: new Date() } });
    });
    return { type };
  }) });
  return new ApprovalExecutionService(client as never, authorization as never, typed as never,
    orchestrator('PERSONAL_ADULT') as never, orchestrator('REPRESENTED_MINOR') as never, orchestrator('FORMAL_ACADEMY') as never,
    orchestrator('NATURAL_PERSON_ACADEMY') as never, orchestrator('ADDITIONAL_ACADEMY_ACCOUNT') as never,
    orchestrator('ACADEMY_ADULT_PLAYER') as never, orchestrator('ACADEMY_MINOR_PLAYER') as never);
}

async function completeDeletion(requestId: string, requestVersion: number) {
  await clients[0].registrationEvidenceDeletionRecord.updateMany({ where: { requestId, requestVersion }, data: { status: 'COMPLETED', verifiedAbsentAt: new Date() } });
  await clients[0].registrationEvidenceItem.updateMany({ where: { requestId }, data: { status: 'DELETED', deletedAt: new Date() } });
}

async function cleanup() {
  await clients[0].$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
    await tx.registrationRequestEvent.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationReviewDecision.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationCorrectionRequest.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationManualDossierConfirmation.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationEvidenceDeletionRecord.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationApprovalExecution.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationEvidenceItem.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.personalAdultRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } }); await tx.representedMinorRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.formalAcademyRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } }); await tx.naturalPersonAcademyRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.additionalAcademyAccountRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } }); await tx.academyAdultPlayerRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } }); await tx.academyMinorPlayerRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationRequestRepresentative.deleteMany({ where: { requestId: { in: requestIds } } }); await tx.registrationRequestApplicant.deleteMany({ where: { requestId: { in: requestIds } } }); await tx.registrationRequestPlayer.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.registrationRequest.deleteMany({ where: { id: { in: requestIds } } });
    await tx.academy.deleteMany({ where: { id: { in: academyIds } } }); await tx.identity.deleteMany({ where: { id: { in: identityIds } } });
  });
}

describe('Feature 006 Administrator decisions', () => {
  beforeAll(async () => { await Promise.all(clients.map((client) => client.$queryRaw`SELECT 1`)); });
  afterAll(async () => { await cleanup(); await Promise.all(clients.map((client) => client.$disconnect())); });

  it('waits for verified absence and idempotently dispatches every typed outcome once', async () => {
    const administratorIdentityId = randomUUID(); identityIds.push(administratorIdentityId); await clients[0].identity.create({ data: { id: administratorIdentityId } });
    const calls: RegistrationRequestType[] = []; const service = approvalService(clients[0], calls);
    const types: RegistrationRequestType[] = ['PERSONAL_ADULT', 'REPRESENTED_MINOR', 'FORMAL_ACADEMY', 'NATURAL_PERSON_ACADEMY', 'ADDITIONAL_ACADEMY_ACCOUNT', 'ACADEMY_ADULT_PLAYER', 'ACADEMY_MINOR_PLAYER'];
    for (const type of types) {
      const fixture = await createSubmitted(type); const idempotencyKey = randomUUID();
      await expect(service.prepare(administratorIdentityId, fixture.requestId, { expectedVersion: 0, idempotencyKey, manualDossierConfirmation: { confirmed: true, dossierName: `exp-${type.toLowerCase()}`, declarationVersion: 'dossier-v1', categories: ['IDENTITY_FRONT'] } })).resolves.toMatchObject({ outcome: 'pending-deletion' });
      await expect(clients[0].registrationManualDossierConfirmation.findFirstOrThrow({ where: { requestId: fixture.requestId }, select: { dossierName: true } })).resolves.toEqual({ dossierName: `exp-${type.toLowerCase()}` });
      expect(calls.filter((value) => value === type)).toHaveLength(0);
      await completeDeletion(fixture.requestId, 1);
      await expect(service.prepare(administratorIdentityId, fixture.requestId, { expectedVersion: 0, idempotencyKey, manualDossierConfirmation: { confirmed: true, dossierName: `exp-${type.toLowerCase()}`, declarationVersion: 'dossier-v1', categories: ['IDENTITY_FRONT'] } })).resolves.toMatchObject({ outcome: 'approved' });
      await expect(service.prepare(administratorIdentityId, fixture.requestId, { expectedVersion: 0, idempotencyKey, manualDossierConfirmation: { confirmed: true, dossierName: `exp-${type.toLowerCase()}`, declarationVersion: 'dossier-v1', categories: ['IDENTITY_FRONT'] } })).resolves.toMatchObject({ outcome: 'approved' });
      expect(calls.filter((value) => value === type)).toHaveLength(1);
    }
    expect(new Set(calls)).toEqual(new Set(types));
  });

  it('surfaces deletion recovery and serializes approval preparation against rejection', async () => {
    const administratorIdentityId = randomUUID(); identityIds.push(administratorIdentityId); await clients[0].identity.create({ data: { id: administratorIdentityId } });
    const recovery = await createSubmitted('PERSONAL_ADULT'); const calls: RegistrationRequestType[] = []; const service = approvalService(clients[0], calls); const key = randomUUID();
    await service.prepare(administratorIdentityId, recovery.requestId, { expectedVersion: 0, idempotencyKey: key, manualDossierConfirmation: { confirmed: true, dossierName: 'exp-recuperacion', declarationVersion: 'dossier-v1', categories: ['IDENTITY_FRONT'] } });
    await clients[0].registrationEvidenceDeletionRecord.updateMany({ where: { requestId: recovery.requestId }, data: { status: 'RECOVERY_REQUIRED', attempts: 5 } });
    const recoveryExecution = await clients[0].registrationApprovalExecution.findFirstOrThrow({ where: { requestId: recovery.requestId } });
    await expect(service.finalize(recoveryExecution.id, administratorIdentityId)).resolves.toMatchObject({ outcome: 'recovery-required' });
    expect(calls).toHaveLength(0);
    await completeDeletion(recovery.requestId, 1);
    await expect(service.finalize(recoveryExecution.id, administratorIdentityId)).resolves.toMatchObject({ outcome: 'approved' });
    expect(calls).toEqual(['PERSONAL_ADULT']);

    const raced = await createSubmitted('PERSONAL_ADULT'); const raceCalls: RegistrationRequestType[] = [];
    const decision = new AdminRegistrationDecisionService(clients[1] as never, { authorize: vi.fn().mockResolvedValue({ allowed: true }) } as never);
    const results = await Promise.all([
      approvalService(clients[0], raceCalls).prepare(administratorIdentityId, raced.requestId, { expectedVersion: 0, idempotencyKey: randomUUID(), manualDossierConfirmation: { confirmed: true, dossierName: 'exp-carrera', declarationVersion: 'dossier-v1', categories: ['IDENTITY_FRONT'] } }),
      decision.reject(administratorIdentityId, raced.requestId, { expectedVersion: 0, idempotencyKey: randomUUID(), safeReason: 'La evidencia sintética no acredita la solicitud.' }),
    ]);
    expect(results.filter(({ outcome }) => outcome === 'pending-deletion' || outcome === 'applied')).toHaveLength(1);
    expect(await clients[0].registrationApprovalExecution.count({ where: { requestId: raced.requestId } })).toBeLessThanOrEqual(1);
    expect(raceCalls.length).toBeLessThanOrEqual(1);
  });
});
