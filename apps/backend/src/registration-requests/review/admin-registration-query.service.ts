import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import type { RegistrationRequestStatus, RegistrationRequestType } from '../domain/registration-request.types.js';
import { RegistrationRequestHistoryService } from '../history/registration-request-history.service.js';
import { RegistrationRequestRepository } from '../persistence/registration-request.repository.js';
import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';

type Query = Readonly<{ cursor?: string; limit: number; type?: RegistrationRequestType; status?: RegistrationRequestStatus }>;
type ReviewRow = Awaited<ReturnType<RegistrationRequestRepository['listForReview']>>['items'][number];

const ADMIN_CAPABILITIES = ['registration.review.view', 'registration.review.view-evidence', 'registration.review.request-correction', 'registration.review.confirm-dossier', 'registration.review.approve', 'registration.review.reject', 'registration.review.view-deletion-status', 'registration.review.retry-deletion'] as const;

@Injectable()
export class AdminRegistrationQueryService {
  constructor(
    private readonly repository: RegistrationRequestRepository,
    private readonly prisma: PrismaService,
    private readonly authorization: RegistrationAuthorizationAdapter,
    private readonly history: RegistrationRequestHistoryService,
  ) {}

  async list(identityId: string, query: Query) {
    const decision = await this.authorization.authorize({ identityId, permission: 'registration.review.list' });
    if (!decision.allowed) return { outcome: 'denied' as const };
    const page = await this.repository.listForReview(query);
    return Object.freeze({ items: Object.freeze(page.items.map((row) => this.summary(row))), ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) });
  }

  async detail(identityId: string, requestId: string) {
    const decision = await this.authorization.authorize({ identityId, permission: 'registration.review.view', requestId });
    if (!decision.allowed) return { outcome: 'not-found' as const };
    const request = await this.prisma.registrationRequest.findUnique({
      where: { id: requestId },
      include: {
        applicants: true,
        evidenceItems: { where: { replacedById: null, deletedAt: null }, orderBy: { uploadedAt: 'asc' } },
        corrections: { orderBy: { createdAt: 'desc' }, take: 1 },
        deletionRecords: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!request) return { outcome: 'not-found' as const };
    const evidenceComplete = request.evidenceItems.length > 0 && request.evidenceItems.every((item) => item.status === 'CLEAN');
    const capabilities = await this.authorization.projectCapabilities({ identityId, requestId, expectedVersion: request.version, evidenceCompleteAndClean: evidenceComplete }, ADMIN_CAPABILITIES);
    const history = await this.history.administratorHistory(requestId);
    const summary = this.summary(request);
    return Object.freeze({
      outcome: 'found' as const,
      request: Object.freeze({
        ...summary,
        capabilities,
        evidence: Object.freeze(request.evidenceItems.map((item) => Object.freeze({ id: item.id, category: item.category, status: item.status, sizeBytes: item.sizeBytes, correctionRequired: request.corrections[0]?.correctionTargets.includes(item.category) ?? false }))),
        ...(request.deletionRecords[0] ? { deletion: Object.freeze({ status: request.deletionRecords[0].status, totalItems: request.deletionRecords.length, completedItems: request.deletionRecords.filter((item) => item.status === 'COMPLETED').length, lastUpdatedAt: request.deletionRecords[0].updatedAt.toISOString() }) } : {}),
        history: Object.freeze(history.map(({ at, action, fromStatus, toStatus, result }) => Object.freeze({ at, action, ...(fromStatus ? { fromStatus } : {}), ...(toStatus ? { toStatus } : {}), result }))),
      }),
    });
  }

  private summary(row: Pick<ReviewRow, 'id' | 'type' | 'status' | 'version' | 'createdAt' | 'submittedAt' | 'latestSafeReason'> & { evidenceItems?: readonly Readonly<{ status: string }>[]; corrections?: readonly unknown[] }) {
    const evidenceItems = row.evidenceItems ?? [];
    return Object.freeze({
      id: row.id, type: row.type, status: row.status, version: row.version,
      safeApplicantLabel: 'Solicitante',
      ...(row.type.includes('ACADEMY') ? { academyLabel: 'Academia solicitante' } : {}),
      ...(row.submittedAt ? { submittedAt: row.submittedAt.toISOString() } : {}),
      createdAt: row.createdAt.toISOString(),
      evidenceComplete: evidenceItems.length > 0 && evidenceItems.every((item) => item.status === 'CLEAN'),
      correctionRequired: row.status === 'REQUIRES_CORRECTION' || (row.corrections?.length ?? 0) > 0,
      ...(row.latestSafeReason ? { safeReason: row.latestSafeReason } : {}),
      capabilities: Object.freeze([] as string[]),
    });
  }
}
