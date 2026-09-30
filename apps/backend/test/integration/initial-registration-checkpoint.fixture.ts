import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';
import { expect } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { CredentialService } from '../../src/authentication/credential.service.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import type { RegistrationEvidenceCategory } from '../../src/generated/prisma/client.js';
import { EvidenceIngestionService } from '../../src/registration-requests/evidence/evidence-ingestion.service.js';
import type { EvidenceMalwareScanner } from '../../src/registration-requests/evidence/evidence-malware-scanner.js';
import {
  createOpaqueEvidenceObjectKey,
  PRIVATE_EVIDENCE_STORE,
  type EvidenceObjectKey,
  type PrivateEvidenceStore,
} from '../../src/registration-requests/evidence/private-evidence-store.js';

export type InitialRequestType = 'PERSONAL_ADULT' | 'REPRESENTED_MINOR' | 'FORMAL_ACADEMY' | 'NATURAL_PERSON_ACADEMY';

const PATHS: Readonly<Record<InitialRequestType, string>> = Object.freeze({
  PERSONAL_ADULT: '/registration-requests/personal-adult',
  REPRESENTED_MINOR: '/registration-requests/represented-minor',
  FORMAL_ACADEMY: '/registration-requests/academies/formal',
  NATURAL_PERSON_ACADEMY: '/registration-requests/academies/natural-person',
});

export const REQUIRED_EVIDENCE = {
  PERSONAL_ADULT: ['IDENTITY_FRONT', 'IDENTITY_BACK'],
  REPRESENTED_MINOR: ['IDENTITY_FRONT', 'IDENTITY_BACK', 'MINOR_CIVIL_IDENTITY', 'REPRESENTATION_AUTHORITY'],
  FORMAL_ACADEMY: ['RUT', 'EXISTENCE_CERTIFICATE', 'RESPONSIBLE_AUTHORITY'],
  NATURAL_PERSON_ACADEMY: ['OPERATION_PROOF', 'RESPONSIBLE_AUTHORITY'],
} as const satisfies Readonly<Record<InitialRequestType, readonly RegistrationEvidenceCategory[]>>;

class CheckpointEvidenceStore implements PrivateEvidenceStore {
  private readonly objects = new Map<EvidenceObjectKey, Buffer>();

  async put(input: Parameters<PrivateEvidenceStore['put']>[0]) {
    const chunks: Buffer[] = [];
    for await (const chunk of input.body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const objectKey = createOpaqueEvidenceObjectKey();
    this.objects.set(objectKey, Buffer.concat(chunks));
    return { objectKey };
  }

  async openStream(objectKey: EvidenceObjectKey) {
    const value = this.objects.get(objectKey);
    return value ? Readable.from(value) : null;
  }

  async delete(objectKey: EvidenceObjectKey) { this.objects.delete(objectKey); return { verifiedAbsent: true }; }
  async exists(objectKey: EvidenceObjectKey) { return this.objects.has(objectKey); }
  async listOrphanCandidates() { return []; }
}

const cleanScanner: EvidenceMalwareScanner = {
  async scan(stream) {
    for await (const _chunk of stream) { /* consume the private synthetic stream */ }
    return { status: 'clean', code: 'CLEAN' };
  },
};

function person(marker: string, minor = false) {
  return {
    legalNames: minor ? 'Menor Sintetico' : 'Persona Sintetica', legalSurnames: marker,
    documentType: minor ? 'TI' : 'CC', documentNumber: `${minor ? 'TI' : 'CC'}-${marker}`,
    birthDate: minor ? '2014-01-15' : '1990-01-15', country: 'Colombia', city: 'Bogota',
  };
}

export function checkpointPayload(type: InitialRequestType, marker = randomUUID().replaceAll('-', '')) {
  const email = `checkpoint.${marker}@example.test`;
  const password = `Synthetic-${marker}-Pass!`;
  const credentials = { email, password, passwordConfirmation: password };
  const consent = { privacyVersion: 'checkpoint-v1', privacyAccepted: true, truthfulnessAccepted: true };
  const adult = person(marker);
  const responsible = { ...adult, phone: '+573001234567' };
  if (type === 'PERSONAL_ADULT') return { email, password, body: { credentials, person: adult, actingForSelf: true, consent } };
  if (type === 'REPRESENTED_MINOR') return { email, password, body: { credentials, representative: responsible, minor: person(marker, true), relationship: 'MOTHER', authorityDeclared: true, consent: { ...consent, representationAccepted: true, minorTreatmentAccepted: true } } };
  const academy = { academyName: `Academia Sintetica ${marker}`, country: 'Colombia', city: 'Bogota', responsiblePerson: responsible };
  if (type === 'FORMAL_ACADEMY') return { email, password, body: { credentials, academy, organizationType: 'SAS', nit: `900${marker.slice(0, 8)}`, authorityDeclared: true, consent } };
  return { email, password, body: { credentials, academy: { ...academy, trainingPlace: 'Sector norte' }, operationDeclared: true, proofCategories: ['PLACE_USE_AUTHORIZATION'], consent } };
}

export class InitialRegistrationCheckpointHarness {
  readonly requestIds: string[] = [];
  readonly identityIds: string[] = [];
  readonly store = new CheckpointEvidenceStore();
  private app!: INestApplication;
  private http!: ReturnType<typeof supertest>;
  prisma!: PrismaService;

  async start() {
    const ingestion = new EvidenceIngestionService(this.store, cleanScanner, { maxItemBytes: 10 * 1024 * 1024, maxRequestBytes: 40 * 1024 * 1024 });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PRIVATE_EVIDENCE_STORE).useValue(this.store)
      .overrideProvider(EvidenceIngestionService).useValue(ingestion)
      .compile();
    this.app = moduleRef.createNestApplication();
    await this.app.init();
    this.http = supertest(this.app.getHttpServer());
    this.prisma = this.app.get(PrismaService);
    await this.prisma.$queryRaw`SELECT 1`;
    return this;
  }

  async createAndAuthenticate(type: InitialRequestType) {
    const payload = checkpointPayload(type);
    const created = await this.http.post(PATHS[type]).set('Idempotency-Key', randomUUID()).send(payload.body).expect(201);
    const requestId = String(created.body.data.id);
    this.requestIds.push(requestId);
    const request = await this.prisma.registrationRequest.findUniqueOrThrow({ where: { id: requestId }, select: { ownerIdentityId: true } });
    if (!request.ownerIdentityId) throw new Error('Checkpoint request has no pending owner');
    this.identityIds.push(request.ownerIdentityId);
    const login = await this.http.post('/auth/login').send({ email: payload.email, password: payload.password }).expect(201);
    return { requestId, identityId: request.ownerIdentityId, accessToken: String(login.body.accessToken), access: login.body.access, payload, created: created.body.data };
  }

  async uploadAll(requestId: string, accessToken: string, type: InitialRequestType, expectedVersion = 0) {
    const evidence = [];
    for (const category of REQUIRED_EVIDENCE[type]) {
      evidence.push(await this.upload(requestId, accessToken, category, expectedVersion));
    }
    return evidence;
  }

  async upload(requestId: string, accessToken: string, category: RegistrationEvidenceCategory, expectedVersion = 0, idempotencyKey = randomUUID()) {
    const response = await this.http.post(`/registration-requests/${requestId}/evidence`)
      .set('Authorization', `Bearer ${accessToken}`).set('Idempotency-Key', idempotencyKey)
      .field('category', category).field('expectedVersion', String(expectedVersion))
      .attach('file', Buffer.from('%PDF-1.4\nsynthetic checkpoint evidence\n%%EOF'), { filename: `${category.toLowerCase()}.pdf`, contentType: 'application/pdf' })
      .expect(201);
    return response.body.data;
  }

  async submit(requestId: string, accessToken: string, expectedVersion = 0, idempotencyKey = randomUUID()) {
    const response = await this.http.post(`/registration-requests/${requestId}/submit`).set('Authorization', `Bearer ${accessToken}`).send({ expectedVersion, idempotencyKey }).expect(200);
    return { data: response.body.data, idempotencyKey };
  }

  async detail(requestId: string, accessToken: string, status = 200) {
    return this.http.get(`/registration-requests/${requestId}`).set('Authorization', `Bearer ${accessToken}`).expect(status);
  }

  async createAdministrator() {
    const marker = randomUUID().replaceAll('-', '');
    const email = `checkpoint.admin.${marker}@example.test`;
    const password = `Synthetic-${marker}-Admin!`;
    const identity = await this.prisma.identity.create({ data: {} });
    this.identityIds.push(identity.id);
    const passwordHash = await this.app.get(CredentialService).hashPassword(password);
    await this.prisma.authenticationCredential.create({ data: { identityId: identity.id, normalizedEmail: email, passwordHash, activatedAt: new Date() } });
    await this.prisma.roleAssignment.create({ data: { identityId: identity.id, assignedByIdentityId: identity.id, role: 'ADMINISTRATOR' } });
    const login = await this.http.post('/auth/login').send({ email, password }).expect(201);
    return { identityId: identity.id, accessToken: String(login.body.accessToken) };
  }

  adminList(accessToken: string, type?: InitialRequestType) {
    const query = type ? `?status=SUBMITTED&type=${type}` : '?status=SUBMITTED';
    return this.http.get(`/admin/registration-requests${query}`).set('Authorization', `Bearer ${accessToken}`);
  }

  adminDetail(accessToken: string, requestId: string) {
    return this.http.get(`/admin/registration-requests/${requestId}`).set('Authorization', `Bearer ${accessToken}`);
  }

  adminEvidence(accessToken: string, requestId: string, evidenceId: string) {
    return this.http.get(`/admin/registration-requests/${requestId}/evidence/${evidenceId}`).set('Authorization', `Bearer ${accessToken}`);
  }

  async stop() {
    if (this.prisma) await this.cleanup();
    if (this.app) await this.app.close();
  }

  private async cleanup() {
    const requestIds = [...new Set(this.requestIds)];
    const identityIds = [...new Set(this.identityIds)];
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
      if (requestIds.length) {
        await tx.registrationEvidenceAccessAudit.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.registrationEvidenceDeletionRecord.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.registrationEvidenceItem.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.registrationConsentRecord.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.registrationCorrectionRequest.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.registrationReviewDecision.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.registrationManualDossierConfirmation.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.registrationApprovalExecution.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.registrationRequestEvent.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.registrationRequestIdempotencyRecord.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.registrationPrivateDuplicateSignal.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.registrationApplicantAccess.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.personalAdultRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.representedMinorRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.formalAcademyRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.naturalPersonAcademyRequestDetail.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.registrationRequestApplicant.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.registrationRequestPlayer.deleteMany({ where: { requestId: { in: requestIds } } });
        await tx.registrationRequest.deleteMany({ where: { id: { in: requestIds } } });
      }
      if (identityIds.length) {
        const sessions = await tx.authenticationSession.findMany({ where: { identityId: { in: identityIds } }, select: { id: true } });
        const sessionIds = sessions.map(({ id }) => id);
        if (sessionIds.length) await tx.refreshTokenHistory.deleteMany({ where: { sessionId: { in: sessionIds } } });
        await tx.authenticationSecurityEvent.deleteMany({ where: { OR: [{ identityId: { in: identityIds } }, { actorIdentityId: { in: identityIds } }] } });
        await tx.authenticationSession.deleteMany({ where: { identityId: { in: identityIds } } });
        await tx.authenticationAttempt.deleteMany({ where: { identityId: { in: identityIds } } });
        await tx.roleAssignment.deleteMany({ where: { OR: [{ identityId: { in: identityIds } }, { assignedByIdentityId: { in: identityIds } }] } });
        await tx.authenticationCredential.deleteMany({ where: { identityId: { in: identityIds } } });
        await tx.identity.deleteMany({ where: { id: { in: identityIds } } });
      }
    });
  }
}

export function expectSafeProjection(value: unknown) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toMatch(/objectKey|contentDigest|password|passwordConfirmation|refreshToken|accessToken|encrypted|fingerprint|scannerResultCode/i);
}
