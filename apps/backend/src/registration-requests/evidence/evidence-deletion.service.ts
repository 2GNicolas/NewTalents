import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import type { RegistrationEvidenceCategory } from '../../generated/prisma/client.js';
import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';
import { isOpaqueEvidenceObjectKey, type EvidenceObjectKey, type PrivateEvidenceStore } from './private-evidence-store.js';

export type EvidenceDeletionConfiguration = Readonly<{ batchSize: number; leaseSeconds: number; backoffSeconds: number; maxAttempts: 5; orphanGraceSeconds: number }>;
export type CleanReplacement = Readonly<{ objectKey: EvidenceObjectKey; declaredMime: string; detectedMime: string; sizeBytes: number; contentDigest: string; scannerResultCode: 'CLEAN' }>;

@Injectable()
export class EvidenceDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: PrivateEvidenceStore,
    private readonly authorization: RegistrationAuthorizationAdapter,
    private readonly configuration: EvidenceDeletionConfiguration,
  ) {}

  async replaceCorrectedEvidence(input: Readonly<{ actorIdentityId: string; requestId: string; expectedVersion: number; category: RegistrationEvidenceCategory; replacement: CleanReplacement }>): Promise<Readonly<{ outcome: 'replaced'; evidenceId: string } | { outcome: 'denied' | 'conflict' }>> {
    const decision = await this.authorization.authorize({ identityId: input.actorIdentityId, permission: 'registration.request.own.upload-evidence', requestId: input.requestId, expectedVersion: input.expectedVersion });
    if (!decision.allowed) {
      await this.store.delete(input.replacement.objectKey).catch(() => undefined);
      return { outcome: 'denied' };
    }
    try {
      const evidenceId = await this.prisma.$transaction(async (transaction) => {
        const request = await transaction.registrationRequest.findUnique({
          where: { id: input.requestId },
          select: { status: true, version: true, corrections: { orderBy: { createdAt: 'desc' }, take: 1, select: { correctionTargets: true } } },
        });
        if (!request || request.status !== 'REQUIRES_CORRECTION' || request.version !== input.expectedVersion || !request.corrections[0]?.correctionTargets.includes(input.category)) throw new Error('INVALID_CORRECTION_REPLACEMENT');
        const previous = await transaction.registrationEvidenceItem.findFirst({ where: { requestId: input.requestId, category: input.category, status: 'CLEAN', replacedById: null, deletedAt: null }, select: { id: true, category: true, status: true, replacedById: true } });
        if (!previous) throw new Error('INVALID_CORRECTION_REPLACEMENT');
        const replacement = await transaction.registrationEvidenceItem.create({ data: { requestId: input.requestId, category: input.category, objectKey: input.replacement.objectKey, declaredMime: input.replacement.declaredMime, detectedMime: input.replacement.detectedMime, sizeBytes: input.replacement.sizeBytes, contentDigest: input.replacement.contentDigest, scannerResultCode: input.replacement.scannerResultCode, status: 'CLEAN' }, select: { id: true } });
        await transaction.registrationEvidenceItem.update({ where: { id: previous.id }, data: { status: 'REPLACED', replacedById: replacement.id } });
        await transaction.registrationEvidenceDeletionRecord.upsert({
          where: { evidenceItemId_requestVersion: { evidenceItemId: previous.id, requestVersion: input.expectedVersion } },
          create: { requestId: input.requestId, requestVersion: input.expectedVersion, evidenceItemId: previous.id, status: 'PENDING' },
          update: {},
        });
        return replacement.id;
      });
      return { outcome: 'replaced', evidenceId };
    } catch {
      await this.store.delete(input.replacement.objectKey).catch(() => undefined);
      return { outcome: 'conflict' };
    }
  }

  async claimBatch(now = new Date()): Promise<readonly string[]> {
    const candidates = await this.prisma.registrationEvidenceDeletionRecord.findMany({
      where: { attempts: { lt: this.configuration.maxAttempts }, OR: [{ status: 'PENDING', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }, { status: 'IN_PROGRESS', leaseUntil: { lt: now } }] },
      orderBy: { createdAt: 'asc' }, take: this.configuration.batchSize, select: { id: true },
    });
    const claimed: string[] = [];
    const leaseUntil = new Date(now.getTime() + this.configuration.leaseSeconds * 1000);
    for (const candidate of candidates) {
      const updated = await this.prisma.registrationEvidenceDeletionRecord.updateMany({ where: { id: candidate.id, OR: [{ status: 'PENDING' }, { status: 'IN_PROGRESS', leaseUntil: { lt: now } }] }, data: { status: 'IN_PROGRESS', leaseUntil } });
      if (updated.count === 1) claimed.push(candidate.id);
    }
    return Object.freeze(claimed);
  }

  async processClaimed(recordId: string): Promise<Readonly<{ outcome: 'completed' | 'deferred' | 'recovery-required' }>> {
    const record = await this.prisma.registrationEvidenceDeletionRecord.findUnique({ where: { id: recordId }, select: { id: true, attempts: true, evidenceItem: { select: { id: true, objectKey: true } } } });
    if (!record || !isOpaqueEvidenceObjectKey(record.evidenceItem.objectKey)) return { outcome: 'deferred' };
    try {
      const deleted = await this.store.delete(record.evidenceItem.objectKey);
      const verifiedAbsent = deleted.verifiedAbsent && !(await this.store.exists(record.evidenceItem.objectKey));
      if (!verifiedAbsent) throw new Error('ABSENCE_NOT_VERIFIED');
      const now = new Date();
      await this.prisma.$transaction([
        this.prisma.registrationEvidenceDeletionRecord.update({ where: { id: record.id }, data: { status: 'COMPLETED', attempts: record.attempts + 1, leaseUntil: null, nextAttemptAt: null, lastSafeErrorCode: null, verifiedAbsentAt: now } }),
        this.prisma.registrationEvidenceItem.update({ where: { id: record.evidenceItem.id }, data: { status: 'DELETED', deletedAt: now } }),
      ]);
      return { outcome: 'completed' };
    } catch {
      const attempts = record.attempts + 1;
      const exhausted = attempts >= this.configuration.maxAttempts;
      await this.prisma.registrationEvidenceDeletionRecord.update({ where: { id: record.id }, data: { attempts, status: exhausted ? 'RECOVERY_REQUIRED' : 'PENDING', leaseUntil: null, nextAttemptAt: exhausted ? null : new Date(Date.now() + this.configuration.backoffSeconds * 1000 * (2 ** Math.max(0, attempts - 1))), lastSafeErrorCode: 'PROVIDER_DELETE_FAILED' } });
      return { outcome: exhausted ? 'recovery-required' : 'deferred' };
    }
  }

  async retryRecovery(input: Readonly<{ actorIdentityId: string; deletionRecordId: string }>): Promise<Readonly<{ outcome: 'scheduled' | 'denied' | 'not-found' }>> {
    const record = await this.prisma.registrationEvidenceDeletionRecord.findUnique({ where: { id: input.deletionRecordId }, select: { id: true, requestId: true, status: true } });
    if (!record) return { outcome: 'not-found' };
    if (record.status !== 'RECOVERY_REQUIRED') return { outcome: 'scheduled' };
    const decision = await this.authorization.authorize({ identityId: input.actorIdentityId, permission: 'registration.review.retry-deletion', requestId: record.requestId, deletionState: 'RECOVERY_REQUIRED' });
    if (!decision.allowed) return { outcome: 'denied' };
    await this.prisma.registrationEvidenceDeletionRecord.update({ where: { id: record.id }, data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), leaseUntil: null, lastSafeErrorCode: null } });
    return { outcome: 'scheduled' };
  }

  async retryRequestRecovery(input: Readonly<{ actorIdentityId: string; requestId: string; expectedVersion: number }>): Promise<Readonly<{ outcome: 'scheduled' | 'denied' | 'not-found' | 'conflict' }>> {
    const request = await this.prisma.registrationRequest.findUnique({ where: { id: input.requestId }, select: { id: true, version: true, approvalExecutionStatus: true } });
    if (!request) return { outcome: 'not-found' };
    if (request.version !== input.expectedVersion) return { outcome: 'conflict' };
    if (request.approvalExecutionStatus !== 'RECOVERY_REQUIRED') return { outcome: 'scheduled' };
    const decision = await this.authorization.authorize({ identityId: input.actorIdentityId, permission: 'registration.review.retry-deletion', requestId: input.requestId, expectedVersion: input.expectedVersion, deletionState: 'RECOVERY_REQUIRED' });
    if (!decision.allowed) return { outcome: 'denied' };
    await this.prisma.$transaction([
      this.prisma.registrationEvidenceDeletionRecord.updateMany({ where: { requestId: input.requestId, requestVersion: input.expectedVersion, status: 'RECOVERY_REQUIRED' }, data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), leaseUntil: null, lastSafeErrorCode: null } }),
      this.prisma.registrationApprovalExecution.updateMany({ where: { requestId: input.requestId, requestVersion: input.expectedVersion, status: 'RECOVERY_REQUIRED' }, data: { status: 'DELETING_EVIDENCE' } }),
      this.prisma.registrationRequest.update({ where: { id: input.requestId }, data: { approvalExecutionStatus: 'DELETING_EVIDENCE' } }),
    ]);
    return { outcome: 'scheduled' };
  }

  async reconcileOrphans(now = new Date()): Promise<Readonly<{ inspected: number; deleted: number }>> {
    const olderThan = new Date(now.getTime() - this.configuration.orphanGraceSeconds * 1000);
    const candidates = await this.store.listOrphanCandidates(olderThan);
    const keys = candidates.map((candidate) => candidate.objectKey);
    const known = keys.length === 0 ? [] : await this.prisma.registrationEvidenceItem.findMany({ where: { objectKey: { in: keys } }, select: { objectKey: true } });
    const knownKeys = new Set(known.map((item) => item.objectKey));
    let deleted = 0;
    for (const candidate of candidates) {
      if (knownKeys.has(candidate.objectKey)) continue;
      const result = await this.store.delete(candidate.objectKey).catch(() => ({ verifiedAbsent: false }));
      if (result.verifiedAbsent) deleted += 1;
    }
    return { inspected: candidates.length, deleted };
  }
}
