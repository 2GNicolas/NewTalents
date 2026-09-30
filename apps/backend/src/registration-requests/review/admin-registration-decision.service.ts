import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';

type CorrectionInput = Readonly<{ expectedVersion: number; idempotencyKey: string; safeReason: string; correctionTargets: readonly string[] }>;
type RejectionInput = Readonly<{ expectedVersion: number; idempotencyKey: string; safeReason: string }>;

@Injectable()
export class AdminRegistrationDecisionService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: RegistrationAuthorizationAdapter) {}

  async requestCorrection(identityId: string, requestId: string, input: CorrectionInput) {
    if (!this.validReason(input.safeReason) || input.correctionTargets.length === 0 || new Set(input.correctionTargets).size !== input.correctionTargets.length) return { outcome: 'invalid' as const };
    const allowed = await this.authorization.authorize({ identityId, permission: 'registration.review.request-correction', requestId, expectedVersion: input.expectedVersion });
    if (!allowed.allowed) return { outcome: 'not-found' as const };
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM "RegistrationRequest" WHERE id = $1::uuid FOR UPDATE', requestId);
      const prior = await tx.registrationReviewDecision.findUnique({ where: { administratorIdentityId_idempotencyKey: { administratorIdentityId: identityId, idempotencyKey: input.idempotencyKey } } });
      if (prior) return prior.requestId === requestId && prior.kind === 'CORRECTION_REQUESTED'
        ? { outcome: 'idempotent' as const, requestId, requestStatus: 'REQUIRES_CORRECTION' as const }
        : { outcome: 'conflict' as const };
      const request = await tx.registrationRequest.findUnique({ where: { id: requestId }, select: { status: true, version: true } });
      if (!request || request.status !== 'SUBMITTED') return { outcome: 'not-found' as const };
      if (request.version !== input.expectedVersion) return { outcome: 'stale' as const };
      const safeReason = input.safeReason.trim();
      await tx.registrationCorrectionRequest.create({ data: { requestId, requestVersion: request.version, correctionTargets: [...input.correctionTargets], safeReason, administratorIdentityId: identityId } });
      await tx.registrationReviewDecision.create({ data: { requestId, requestVersion: request.version, kind: 'CORRECTION_REQUESTED', administratorIdentityId: identityId, safeReason, idempotencyKey: input.idempotencyKey } });
      await tx.registrationRequest.update({ where: { id: requestId }, data: { status: 'REQUIRES_CORRECTION', version: { increment: 1 }, latestSafeReason: safeReason } });
      await this.event(tx, requestId, request.version + 1, identityId, 'REQUEST_CORRECTION', 'SUBMITTED', 'REQUIRES_CORRECTION');
      return { outcome: 'applied' as const, requestId, requestStatus: 'REQUIRES_CORRECTION' as const, version: request.version + 1, safeReason, correctionTargets: Object.freeze([...input.correctionTargets]) };
    });
  }

  async reject(identityId: string, requestId: string, input: RejectionInput) {
    if (!this.validReason(input.safeReason)) return { outcome: 'invalid' as const };
    const allowed = await this.authorization.authorize({ identityId, permission: 'registration.review.reject', requestId, expectedVersion: input.expectedVersion });
    if (!allowed.allowed) return { outcome: 'not-found' as const };
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM "RegistrationRequest" WHERE id = $1::uuid FOR UPDATE', requestId);
      const prior = await tx.registrationReviewDecision.findUnique({ where: { administratorIdentityId_idempotencyKey: { administratorIdentityId: identityId, idempotencyKey: input.idempotencyKey } } });
      if (prior) return prior.requestId === requestId && prior.kind === 'REJECTED'
        ? { outcome: 'idempotent' as const, requestId, requestStatus: 'REJECTED' as const }
        : { outcome: 'conflict' as const };
      const request = await tx.registrationRequest.findUnique({ where: { id: requestId }, include: { applicantAccess: true, evidenceItems: { where: { replacedById: null, deletedAt: null } } } });
      if (!request || request.status !== 'SUBMITTED') return { outcome: 'not-found' as const };
      if (request.version !== input.expectedVersion) return { outcome: 'stale' as const };
      const safeReason = input.safeReason.trim();
      const now = new Date();
      await tx.registrationReviewDecision.create({ data: { requestId, requestVersion: request.version, kind: 'REJECTED', administratorIdentityId: identityId, safeReason, idempotencyKey: input.idempotencyKey } });
      await tx.registrationRequest.update({ where: { id: requestId }, data: { status: 'REJECTED', version: { increment: 1 }, decidedAt: now, latestSafeReason: safeReason } });
      if (request.applicantAccess) await tx.registrationApplicantAccess.update({ where: { requestId }, data: { status: 'REJECTED' } });
      const evidenceIds = request.evidenceItems.map(({ id }) => id);
      if (evidenceIds.length > 0) {
        await tx.registrationEvidenceItem.updateMany({ where: { id: { in: evidenceIds } }, data: { status: 'DELETION_PENDING' } });
        await tx.registrationEvidenceDeletionRecord.createMany({
          data: evidenceIds.map((evidenceItemId) => ({ requestId, requestVersion: request.version, evidenceItemId, status: 'PENDING' as const })),
          skipDuplicates: true,
        });
      }
      await this.event(tx, requestId, request.version + 1, identityId, 'REJECT', 'SUBMITTED', 'REJECTED');
      return { outcome: 'applied' as const, requestId, requestStatus: 'REJECTED' as const, version: request.version + 1, deletion: this.deletion(request.evidenceItems.length) };
    });
  }

  private validReason(value: string): boolean { return value.trim().length > 0 && value.length <= 1000; }
  private deletion(totalItems: number) { return Object.freeze({ status: totalItems === 0 ? 'COMPLETED' as const : 'PENDING' as const, totalItems, completedItems: 0 }); }
  private async event(tx: Prisma.TransactionClient, requestId: string, requestVersion: number, actorIdentityId: string, action: string, priorStatus: 'SUBMITTED', resultingStatus: 'REQUIRES_CORRECTION' | 'REJECTED') {
    const sequence = (await tx.registrationRequestEvent.aggregate({ where: { requestId }, _max: { sequence: true } }))._max.sequence ?? 0;
    await tx.registrationRequestEvent.create({ data: { requestId, sequence: sequence + 1, requestVersion, actorIdentityId, action, priorStatus, resultingStatus, outcome: 'APPLIED', safeCategory: 'ADMIN_DECISION' } });
  }
}
