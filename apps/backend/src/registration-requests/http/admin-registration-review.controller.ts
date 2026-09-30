import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseFilters, UseGuards } from '@nestjs/common';

import { AuthenticationGuard, type RequestActor } from '../../authentication/authentication.guard.js';
import { AdminRegistrationQueryService } from '../review/admin-registration-query.service.js';
import { AdminRegistrationReviewService } from '../review/admin-registration-review.service.js';
import { AdminRegistrationDecisionService } from '../review/admin-registration-decision.service.js';
import { ApprovalExecutionService } from '../review/approval-execution.service.js';
import { EvidenceDeletionService } from '../evidence/evidence-deletion.service.js';
import { EvidenceDeletionWorker } from '../evidence/evidence-deletion.worker.js';
import { parseAdminRequestListQuery, parseApprovalCommand, parseCorrectionCommand, parseRejectionCommand, parseTransitionCommand } from './registration-request.dto.js';
import { RegistrationRequestExceptionFilter, RegistrationRequestHttpError } from './registration-request-exception.filter.js';

@Controller('admin/registration-requests')
@UseGuards(AuthenticationGuard)
@UseFilters(RegistrationRequestExceptionFilter)
export class AdminRegistrationReviewController {
  constructor(
    private readonly queries: AdminRegistrationQueryService,
    private readonly reviews: AdminRegistrationReviewService,
    private readonly decisions: AdminRegistrationDecisionService,
    private readonly approvals: ApprovalExecutionService,
    private readonly deletions: EvidenceDeletionService,
    private readonly deletionWorker: EvidenceDeletionWorker,
  ) {}

  @Get()
  async list(@Req() request: { actor: RequestActor }, @Query() query: unknown) {
    const parsed = parseAdminRequestListQuery(query);
    if (!parsed.ok) throw new RegistrationRequestHttpError('validation', parsed.issues);
    const result = await this.queries.list(request.actor.identityId, {
      limit: parsed.value.limit,
      ...(parsed.value.cursor === undefined ? {} : { cursor: parsed.value.cursor }),
      ...(parsed.value.type === undefined ? {} : { type: parsed.value.type }),
      ...(parsed.value.status === undefined ? {} : { status: parsed.value.status }),
    });
    if ('outcome' in result) throw new RegistrationRequestHttpError('forbidden');
    return { data: result.items, pagination: { hasMore: Boolean(result.nextCursor), ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) } };
  }

  @Get(':requestId')
  async detail(@Req() request: { actor: RequestActor }, @Param('requestId') requestId: string) {
    const result = await this.reviews.detail(request.actor.identityId, requestId);
    if (result.outcome !== 'found') throw new RegistrationRequestHttpError('not-found');
    return { data: result.request };
  }

  @Post(':requestId/correction')
  @HttpCode(200)
  async correction(@Req() request: { actor: RequestActor }, @Param('requestId') requestId: string, @Body() body: unknown) {
    const parsed = parseCorrectionCommand(body);
    if (!parsed.ok) throw new RegistrationRequestHttpError('validation', parsed.issues);
    return { data: this.unwrap(await this.decisions.requestCorrection(request.actor.identityId, requestId, parsed.value)) };
  }

  @Post(':requestId/reject')
  @HttpCode(200)
  async reject(@Req() request: { actor: RequestActor }, @Param('requestId') requestId: string, @Body() body: unknown) {
    const parsed = parseRejectionCommand(body);
    if (!parsed.ok) throw new RegistrationRequestHttpError('validation', parsed.issues);
    return { data: this.unwrap(await this.decisions.reject(request.actor.identityId, requestId, parsed.value)) };
  }

  @Post(':requestId/approve')
  @HttpCode(202)
  async approve(@Req() request: { actor: RequestActor }, @Param('requestId') requestId: string, @Body() body: unknown) {
    const parsed = parseApprovalCommand(body);
    if (!parsed.ok) throw new RegistrationRequestHttpError('validation', parsed.issues);
    const prepared = this.unwrap(await this.approvals.approve(request.actor.identityId, requestId, parsed.value));
    if (prepared.outcome !== 'pending-deletion') return { data: prepared };
    await this.deletionWorker.runOnce();
    return { data: this.unwrap(await this.approvals.finalize(prepared.executionId, request.actor.identityId)) };
  }

  @Post(':requestId/deletion/retry')
  @HttpCode(202)
  async retryDeletion(@Req() request: { actor: RequestActor }, @Param('requestId') requestId: string, @Body() body: unknown) {
    const parsed = parseTransitionCommand(body);
    if (!parsed.ok) throw new RegistrationRequestHttpError('validation', parsed.issues);
    return { data: this.unwrap(await this.deletions.retryRequestRecovery({ actorIdentityId: request.actor.identityId, requestId, expectedVersion: parsed.value.expectedVersion })) };
  }

  private unwrap<T extends { outcome: string }>(result: T): T {
    if (result.outcome === 'not-found') throw new RegistrationRequestHttpError('not-found');
    if (result.outcome === 'stale' || result.outcome === 'conflict') throw new RegistrationRequestHttpError('stale-version');
    if (result.outcome === 'invalid') throw new RegistrationRequestHttpError('validation');
    if (result.outcome === 'denied') throw new RegistrationRequestHttpError('not-found');
    return result;
  }
}
