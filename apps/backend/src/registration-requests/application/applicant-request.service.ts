import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Readable } from 'node:stream';

import { PrismaService } from '../../database/prisma.service.js';
import type { RegistrationEvidenceCategory } from '../../generated/prisma/client.js';
import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';
import type { RegistrationRequestStatus, RegistrationRequestType } from '../domain/registration-request.types.js';
import { EvidenceIngestionService } from '../evidence/evidence-ingestion.service.js';
import { EvidenceDeletionService } from '../evidence/evidence-deletion.service.js';
import { RegistrationRequestHistoryService } from '../history/registration-request-history.service.js';
import { RegistrationRequestLifecycleService } from '../lifecycle/registration-request-lifecycle.service.js';
import { RegistrationRequestRepository } from '../persistence/registration-request.repository.js';
import { RegistrationExactConflictService, type ExactConflictCheck } from '../duplicates/registration-exact-conflict.service.js';

export const REGISTRATION_TYPED_REQUEST_APPLICATION = Symbol('REGISTRATION_TYPED_REQUEST_APPLICATION');
export type TypedApplicationResult = Readonly<{ outcome: 'created'; requestId: string }> | Readonly<{ outcome: 'updated' }> | Readonly<{ outcome: 'conflict'; field?: string }> | Readonly<{ outcome: 'invalid' | 'unavailable' }>;
export interface RegistrationTypedRequestApplication {
  create(input: Readonly<{ type: RegistrationRequestType; payload: unknown; academyContextId?: string; actorIdentityId?: string }>): Promise<TypedApplicationResult>;
  update(input: Readonly<{ requestId: string; type: RegistrationRequestType; payload: unknown; actorIdentityId: string; expectedVersion: number }>): Promise<TypedApplicationResult>;
  readiness(requestId: string): Promise<Readonly<{ ageRouteCompatible: boolean; representationComplete: boolean }>>;
}

@Injectable()
export class DeferredRegistrationTypedRequestApplication implements RegistrationTypedRequestApplication {
  async create(): Promise<TypedApplicationResult> { return { outcome: 'unavailable' }; }
  async update(): Promise<TypedApplicationResult> { return { outcome: 'unavailable' }; }
  async readiness(): Promise<Readonly<{ ageRouteCompatible: boolean; representationComplete: boolean }>> { return { ageRouteCompatible: false, representationComplete: false }; }
}

type Transition = Readonly<{ expectedVersion: number; idempotencyKey: string }>;
const OWN_CAPABILITIES = ['registration.request.own.view', 'registration.request.own.edit-draft', 'registration.request.own.submit', 'registration.request.own.correct', 'registration.request.own.resubmit', 'registration.request.own.upload-evidence', 'registration.request.own.view-deletion-status'] as const;

@Injectable()
export class ApplicantRequestService {
  constructor(
    @Inject(REGISTRATION_TYPED_REQUEST_APPLICATION) private readonly typed: RegistrationTypedRequestApplication,
    private readonly repository: RegistrationRequestRepository,
    private readonly prisma: PrismaService,
    private readonly authorization: RegistrationAuthorizationAdapter,
    private readonly lifecycle: RegistrationRequestLifecycleService,
    private readonly history: RegistrationRequestHistoryService,
    private readonly ingestion: EvidenceIngestionService,
    private readonly deletion: EvidenceDeletionService,
    @Optional() private readonly exactConflicts?: RegistrationExactConflictService,
  ) {}

  async validatePublicIdentity(type: RegistrationRequestType, input: ExactConflictCheck) {
    if (!['PERSONAL_ADULT', 'REPRESENTED_MINOR', 'FORMAL_ACADEMY', 'NATURAL_PERSON_ACADEMY'].includes(type)) return { outcome: 'not-found' as const };
    return this.exactConflicts ? this.exactConflicts.validate(input) : { outcome: 'not-found' as const };
  }

  async validateAcademyIdentity(identityId: string, academyId: string, type: RegistrationRequestType, input: ExactConflictCheck) {
    if (!['ADDITIONAL_ACADEMY_ACCOUNT', 'ACADEMY_ADULT_PLAYER', 'ACADEMY_MINOR_PLAYER'].includes(type)) return { outcome: 'not-found' as const };
    const decision = await this.authorization.authorize({ identityId, permission: 'registration.request.academy.list', academyId });
    if (!decision.allowed) return { outcome: 'not-found' as const };
    return this.exactConflicts ? this.exactConflicts.validate(input) : { outcome: 'not-found' as const };
  }

  async createPublic(type: RegistrationRequestType, payload: unknown) {
    const result = await this.typed.create({ type, payload });
    return result.outcome === 'created' ? this.createdResult(result.requestId) : result;
  }
  async createAcademy(identityId: string, academyContextId: string, type: RegistrationRequestType, payload: unknown) {
    const result = await this.typed.create({ type, payload, academyContextId, actorIdentityId: identityId });
    return result.outcome === 'created' ? this.createdResult(result.requestId, identityId) : result;
  }

  async listOwn(identityId: string, query: Readonly<{ cursor?: string; limit: number; type?: RegistrationRequestType; status?: RegistrationRequestStatus }>) {
    const page = await this.repository.listOwned(identityId, query);
    return Object.freeze({ items: Object.freeze(await Promise.all(page.items.map((item) => this.safeSummary(identityId, item)))), ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) });
  }

  async listAcademy(identityId: string, academyContextId: string, query: Readonly<{ cursor?: string; limit: number; type?: RegistrationRequestType; status?: RegistrationRequestStatus }>) {
    const decision = await this.authorization.authorize({ identityId, permission: 'registration.request.academy.list', academyId: academyContextId });
    if (!decision.allowed) return { outcome: 'not-found' as const };
    const page = await this.repository.listAcademy(academyContextId, query);
    return Object.freeze({ items: Object.freeze(await Promise.all(page.items.map((item) => this.safeSummary(identityId, item)))), ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) });
  }

  async detailOwn(identityId: string, requestId: string) {
    const decision = await this.authorization.authorize({ identityId, permission: 'registration.request.own.view', requestId });
    if (!decision.allowed) return { outcome: 'not-found' as const };
    const request = await this.loadRequest(requestId);
    if (!request) return { outcome: 'not-found' as const };
    const summary = await this.safeSummary(identityId, request);
    const correctionTargets = request.corrections[0]?.correctionTargets ?? [];
    return Object.freeze({ outcome: 'found' as const, request: Object.freeze({ ...summary, evidence: this.safeEvidence(request.evidenceItems, correctionTargets), ...(request.deletionRecords[0] ? { deletion: this.deletionView(request.deletionRecords) } : {}) }) });
  }

  async update(identityId: string, requestId: string, input: Readonly<{ expectedVersion: number; idempotencyKey: string; details: unknown }>) {
    const request = await this.prisma.registrationRequest.findUnique({ where: { id: requestId }, select: { type: true } });
    if (!request || !(await this.allowed(identityId, 'registration.request.own.edit-draft', requestId, input.expectedVersion))) return { outcome: 'not-found' as const };
    const typed = await this.typed.update({ requestId, type: request.type, payload: input.details, actorIdentityId: identityId, expectedVersion: input.expectedVersion });
    if (typed.outcome !== 'updated') return typed;
    return this.lifecycle.update({ requestId, expectedVersion: input.expectedVersion, actorId: identityId, idempotencyKey: input.idempotencyKey, safeCategory: 'PROFILE' });
  }

  submit(identityId: string, requestId: string, input: Transition) { return this.transition(identityId, requestId, input, 'registration.request.own.submit', 'submit'); }
  resubmit(identityId: string, requestId: string, input: Transition) { return this.transition(identityId, requestId, input, 'registration.request.own.resubmit', 'resubmit'); }

  async uploadEvidence(identityId: string, requestId: string, input: Readonly<{ expectedVersion: number; category: RegistrationEvidenceCategory; fileName: string; declaredMime: string; body: Readable }>) {
    if (!(await this.allowed(identityId, 'registration.request.own.upload-evidence', requestId, input.expectedVersion))) { input.body.destroy(); return { outcome: 'not-found' as const }; }
    const request = await this.prisma.registrationRequest.findUnique({
      where: { id: requestId },
      select: { status: true, version: true, corrections: { orderBy: { createdAt: 'desc' }, take: 1, select: { correctionTargets: true, createdAt: true } } },
    });
    const correctionReplacement = request?.status === 'REQUIRES_CORRECTION';
    if (!request || request.version !== input.expectedVersion || (correctionReplacement && !request.corrections[0]?.correctionTargets.includes(input.category))) {
      input.body.destroy();
      return { outcome: 'not-found' as const };
    }
    const current = await this.prisma.registrationEvidenceItem.findFirst({
      where: { requestId, category: input.category, status: 'CLEAN', replacedById: null, deletedAt: null },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, category: true, status: true, sizeBytes: true, uploadedAt: true },
    });
    const correctionCreatedAt = request.corrections[0]?.createdAt;
    if (current && (!correctionReplacement || (correctionCreatedAt !== undefined && current.uploadedAt >= correctionCreatedAt))) {
      input.body.resume();
      const { uploadedAt: _uploadedAt, ...evidence } = current;
      return Object.freeze({ outcome: 'created' as const, evidence: Object.freeze(evidence) });
    }
    const uncertain = correctionReplacement ? null : await this.prisma.registrationEvidenceItem.findFirst({
      where: { requestId, category: input.category, status: { in: ['QUARANTINED', 'SCANNING', 'REJECTED'] }, replacedById: null, deletedAt: null },
      select: { id: true },
    });
    const total = await this.prisma.registrationEvidenceItem.aggregate({
      where: { requestId, replacedById: null, deletedAt: null, ...(correctionReplacement ? { category: { not: input.category } } : {}) },
      _sum: { sizeBytes: true },
    });
    const ingested = await this.ingestion.ingest({ fileName: input.fileName, declaredMime: input.declaredMime, body: input.body, existingRequestBytes: total._sum.sizeBytes ?? 0 });
    if (!ingested.internal) return { outcome: ingested.outcome, evidence: ingested.projection };
    if (correctionReplacement && ingested.outcome === 'clean') {
      const replaced = await this.deletion.replaceCorrectedEvidence({
        actorIdentityId: identityId, requestId, expectedVersion: input.expectedVersion, category: input.category,
        replacement: { ...ingested.internal, declaredMime: ingested.projection.declaredMime, detectedMime: ingested.projection.detectedMime!, sizeBytes: ingested.projection.sizeBytes, scannerResultCode: 'CLEAN' },
      });
      if (replaced.outcome !== 'replaced') return { outcome: replaced.outcome };
      return Object.freeze({ outcome: 'created' as const, evidence: Object.freeze({ id: replaced.evidenceId, category: input.category, status: 'CLEAN' as const, sizeBytes: ingested.projection.sizeBytes }) });
    }
    if (uncertain && ingested.outcome === 'clean') {
      const replaced = await this.deletion.replaceUncertainEvidence({
        actorIdentityId: identityId, requestId, expectedVersion: input.expectedVersion, category: input.category,
        replacement: { ...ingested.internal, declaredMime: ingested.projection.declaredMime, detectedMime: ingested.projection.detectedMime!, sizeBytes: ingested.projection.sizeBytes, scannerResultCode: 'CLEAN' },
      });
      if (replaced.outcome !== 'replaced') return { outcome: replaced.outcome };
      return Object.freeze({ outcome: 'created' as const, evidence: Object.freeze({ id: replaced.evidenceId, category: input.category, status: 'CLEAN' as const, sizeBytes: ingested.projection.sizeBytes }) });
    }
    const item = await this.prisma.registrationEvidenceItem.create({ data: { requestId, category: input.category, objectKey: ingested.internal.objectKey, contentDigest: ingested.internal.contentDigest, declaredMime: ingested.projection.declaredMime, ...(ingested.projection.detectedMime ? { detectedMime: ingested.projection.detectedMime } : {}), sizeBytes: ingested.projection.sizeBytes, status: ingested.projection.status, ...(ingested.projection.status === 'CLEAN' ? { scannerResultCode: 'CLEAN' } : ingested.projection.reason ? { scannerResultCode: ingested.projection.reason } : {}) }, select: { id: true, category: true, status: true, sizeBytes: true } });
    return Object.freeze({ outcome: 'created' as const, evidence: Object.freeze(item) });
  }

  async retireEvidence(identityId: string, requestId: string, evidenceId: string, expectedVersion: number) {
    if (!(await this.allowed(identityId, 'registration.request.own.upload-evidence', requestId, expectedVersion))) return { outcome: 'not-found' as const };
    const result = await this.prisma.$transaction(async (transaction) => {
      const item = await transaction.registrationEvidenceItem.findFirst({ where: { id: evidenceId, requestId, replacedById: null, deletedAt: null }, select: { id: true } });
      if (!item) return false;
      await transaction.registrationEvidenceItem.update({ where: { id: item.id }, data: { status: 'DELETION_PENDING' } });
      await transaction.registrationEvidenceDeletionRecord.upsert({ where: { evidenceItemId_requestVersion: { evidenceItemId: item.id, requestVersion: expectedVersion } }, create: { requestId, evidenceItemId: item.id, requestVersion: expectedVersion }, update: {} });
      return true;
    });
    return { outcome: result ? 'retired' as const : 'not-found' as const };
  }

  async deletionStatus(identityId: string, requestId: string) {
    if (!(await this.allowed(identityId, 'registration.request.own.view-deletion-status', requestId))) return { outcome: 'not-found' as const };
    const records = await this.prisma.registrationEvidenceDeletionRecord.findMany({ where: { requestId }, select: { status: true, updatedAt: true } });
    const status = records.some((item) => item.status === 'RECOVERY_REQUIRED') ? 'RECOVERY_REQUIRED' : records.some((item) => item.status === 'IN_PROGRESS') ? 'IN_PROGRESS' : records.some((item) => item.status === 'PENDING') ? 'PENDING' : 'COMPLETED';
    return { outcome: 'found' as const, deletion: { status, totalItems: records.length, completedItems: records.filter((item) => item.status === 'COMPLETED').length, ...(records[0] ? { lastUpdatedAt: records.reduce((latest, item) => item.updatedAt > latest ? item.updatedAt : latest, records[0].updatedAt).toISOString() } : {}) } };
  }

  private async transition(identityId: string, requestId: string, input: Transition, permission: 'registration.request.own.submit' | 'registration.request.own.resubmit', action: 'submit' | 'resubmit') {
    const ownership = await this.authorization.authorize({ identityId, permission: 'registration.request.own.view', requestId });
    if (!ownership.allowed) return { outcome: 'not-found' as const };
    const prior = await this.repository.findIdempotentResult({ requestId, action: action === 'submit' ? 'SUBMIT' : 'RESUBMIT', idempotencyKey: input.idempotencyKey });
    if (prior) return { outcome: 'idempotent' as const, snapshot: prior };
    if (this.exactConflicts && (await this.exactConflicts.validatePersistedRequest(requestId)).outcome === 'conflict') return { outcome: 'conflict' as const };
    const readiness = await this.typed.readiness(requestId);
    const request = await this.loadRequest(requestId);
    const evidenceCompleteAndClean = Boolean(request?.evidenceItems.length) && request!.evidenceItems.every((item) => item.status === 'CLEAN');
    const decision = await this.authorization.authorize({ identityId, permission, requestId, evidenceCompleteAndClean, ...readiness });
    if (!decision.allowed) return { outcome: 'not-found' as const };
    return this.lifecycle[action]({ requestId, expectedVersion: input.expectedVersion, actorId: identityId, idempotencyKey: input.idempotencyKey, safeCategory: 'SUBMISSION' });
  }

  private async allowed(identityId: string, permission: Parameters<RegistrationAuthorizationAdapter['authorize']>[0]['permission'], requestId: string, expectedVersion?: number) {
    return (await this.authorization.authorize({ identityId, permission, requestId, ...(expectedVersion === undefined ? {} : { expectedVersion }) })).allowed;
  }

  private loadRequest(requestId: string) {
    return this.prisma.registrationRequest.findUnique({ where: { id: requestId }, include: { evidenceItems: { where: { replacedById: null, deletedAt: null } }, corrections: { orderBy: { createdAt: 'desc' }, take: 1, select: { correctionTargets: true } }, deletionRecords: { orderBy: { createdAt: 'desc' } } } });
  }

  private async safeSummary(identityId: string, request: Readonly<{ id: string; type: RegistrationRequestType; status: RegistrationRequestStatus; version: number; createdAt: Date; submittedAt: Date | null; latestSafeReason: string | null; evidenceItems?: readonly Readonly<{ status: string }>[] }>) {
    const evidence = request.evidenceItems ?? [];
    const readiness = request.status === 'DRAFT' || request.status === 'REQUIRES_CORRECTION'
      ? await this.typed.readiness(request.id)
      : undefined;
    const capabilities = await this.authorization.projectCapabilities({ identityId, requestId: request.id, expectedVersion: request.version, evidenceCompleteAndClean: evidence.length > 0 && evidence.every((item) => item.status === 'CLEAN'), ...readiness }, OWN_CAPABILITIES);
    return Object.freeze({ id: request.id, type: request.type, status: request.status, version: request.version, createdAt: request.createdAt.toISOString(), ...(request.submittedAt ? { submittedAt: request.submittedAt.toISOString() } : {}), evidenceComplete: evidence.length > 0 && evidence.every((item) => item.status === 'CLEAN'), correctionRequired: request.status === 'REQUIRES_CORRECTION', ...(request.latestSafeReason ? { safeReason: request.latestSafeReason } : {}), capabilities });
  }

  private async createdResult(requestId: string, identityId?: string) {
    const request = await this.loadRequest(requestId);
    if (!request) return { outcome: 'unavailable' as const };
    const capabilities = identityId ? await this.authorization.projectCapabilities({ identityId, requestId, expectedVersion: request.version }, OWN_CAPABILITIES) : [];
    return Object.freeze({ outcome: 'created' as const, requestId, data: Object.freeze({ id: request.id, type: request.type, status: request.status, version: request.version, createdAt: request.createdAt.toISOString(), evidenceComplete: false, correctionRequired: false, capabilities, evidence: Object.freeze([]) }) });
  }

  private safeEvidence(items: readonly Readonly<{ id: string; category: RegistrationEvidenceCategory; status: string; sizeBytes: number }>[], correctionTargets: readonly string[] = []) {
    return Object.freeze(items.map(({ id, category, status, sizeBytes }) => Object.freeze({ id, category, status, sizeBytes, correctionRequired: correctionTargets.includes(category) })));
  }

  private deletionView(items: readonly Readonly<{ status: string; updatedAt: Date }>[]) {
    const status = items.some((item) => item.status === 'RECOVERY_REQUIRED') ? 'RECOVERY_REQUIRED' : items.some((item) => item.status === 'IN_PROGRESS') ? 'IN_PROGRESS' : items.some((item) => item.status === 'PENDING') ? 'PENDING' : 'COMPLETED';
    return Object.freeze({ status, totalItems: items.length, completedItems: items.filter((item) => item.status === 'COMPLETED').length, lastUpdatedAt: items.reduce((latest, item) => item.updatedAt > latest ? item.updatedAt : latest, items[0]!.updatedAt).toISOString() });
  }
}
