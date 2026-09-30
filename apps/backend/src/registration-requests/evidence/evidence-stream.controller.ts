import { Controller, Get, Inject, Param, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';

import { AuthenticationGuard, type RequestActor } from '../../authentication/authentication.guard.js';
import { PrismaService } from '../../database/prisma.service.js';
import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';
import { EvidenceAccessAuditService, type EvidenceAccessOutcome } from './evidence-access-audit.service.js';
import { PRIVATE_EVIDENCE_STORE, type EvidenceObjectKey, type PrivateEvidenceStore } from './private-evidence-store.js';

type Response = { setHeader(name: string, value: string): Response; status(code: number): Response };
const EXTENSION_BY_MIME: Readonly<Record<string, string>> = Object.freeze({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' });

@Controller('admin/registration-requests')
@UseGuards(AuthenticationGuard)
export class EvidenceStreamController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: RegistrationAuthorizationAdapter,
    @Inject(PRIVATE_EVIDENCE_STORE) private readonly store: PrivateEvidenceStore,
    private readonly audit: EvidenceAccessAuditService,
  ) {}

  @Get(':requestId/evidence/:evidenceId')
  async stream(@Req() request: { actor: RequestActor }, @Param('requestId') requestId: string, @Param('evidenceId') evidenceId: string, @Res({ passthrough: true }) response: Response) {
    this.secureHeaders(response);
    const evidence = await this.prisma.registrationEvidenceItem.findFirst({
      where: { id: evidenceId, requestId },
      select: { id: true, requestId: true, category: true, objectKey: true, declaredMime: true, detectedMime: true, request: { select: { version: true, status: true } } },
    });
    if (!evidence) return this.notFound(response);
    if (evidence.request.status !== 'SUBMITTED' || evidence.detectedMime === null) {
      await this.auditAttempt(evidence, request.actor.identityId, 'NOT_FOUND');
      return this.notFound(response);
    }
    const current = await this.prisma.registrationEvidenceItem.findFirst({ where: { id: evidence.id, status: 'CLEAN', replacedById: null, deletedAt: null }, select: { id: true } });
    if (!current) {
      await this.auditAttempt(evidence, request.actor.identityId, 'NOT_FOUND');
      return this.notFound(response);
    }

    const decision = await this.authorization.authorize({ identityId: request.actor.identityId, permission: 'registration.review.view-evidence', requestId, expectedVersion: evidence.request.version, evidenceCompleteAndClean: true });
    if (!decision.allowed) {
      await this.auditAttempt(evidence, request.actor.identityId, 'DENIED');
      return this.notFound(response);
    }

    const stream = await this.store.openStream(evidence.objectKey as EvidenceObjectKey).catch(() => null);
    if (!stream) {
      await this.auditAttempt(evidence, request.actor.identityId, 'UNAVAILABLE');
      return this.notFound(response);
    }
    const mime = evidence.detectedMime ?? evidence.declaredMime;
    const extension = EXTENSION_BY_MIME[mime];
    if (!extension) {
      stream.destroy();
      await this.auditAttempt(evidence, request.actor.identityId, 'UNAVAILABLE');
      return this.notFound(response);
    }
    response.setHeader('Content-Type', mime);
    response.setHeader('Content-Disposition', `inline; filename="${evidence.category.toLowerCase().replaceAll('_', '-')}.${extension}"`);
    await this.auditAttempt(evidence, request.actor.identityId, 'STREAMED');
    return new StreamableFile(stream);
  }

  private secureHeaders(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
  }

  private notFound(response: Response) {
    response.status(404);
    return { code: 'evidence_not_found', message: 'Evidence not found' } as const;
  }

  private async auditAttempt(evidence: Readonly<{ id: string; requestId: string; category: any }>, actorIdentityId: string, outcome: EvidenceAccessOutcome): Promise<void> {
    await this.audit.record({ requestId: evidence.requestId, evidenceItemId: evidence.id, actorIdentityId, category: evidence.category, outcome });
  }
}
