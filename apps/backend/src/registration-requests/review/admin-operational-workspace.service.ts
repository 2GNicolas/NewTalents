import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import type { RegistrationRequestType } from '../domain/registration-request.types.js';
import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';
import { AdminReviewProgressService, type AdminProgressRequest, type AdminReviewStage } from './admin-review-progress.service.js';

export type OperationalGroup = 'NEW' | 'CONTINUE_REVIEW' | 'REQUIRES_CORRECTION' | 'READY_FOR_DECISION' | 'WAITING_EVIDENCE_DELETION';
export type OperationalNextAction = 'REVIEW' | 'CONTINUE' | 'VIEW_CORRECTION' | 'DECIDE' | 'VIEW_DELETION';

export type OperationalRequest = Readonly<{
  requestId: string;
  requestVersion: number;
  maskedReference: string;
  displayLabel: string;
  requestType: RegistrationRequestType;
  operationalGroup: OperationalGroup;
  relevantAt: string;
  nextAction: OperationalNextAction;
}>;

type WorkspaceQuery = Readonly<{ query?: string; requestType?: RegistrationRequestType }>;
type ProgressCommand = Readonly<{ expectedRequestVersion: number; stage: AdminReviewStage }>;

const GROUP_ORDER: readonly OperationalGroup[] = ['NEW', 'CONTINUE_REVIEW', 'REQUIRES_CORRECTION', 'READY_FOR_DECISION', 'WAITING_EVIDENCE_DELETION'];
const NEXT_ACTION: Readonly<Record<OperationalGroup, OperationalNextAction>> = {
  NEW: 'REVIEW',
  CONTINUE_REVIEW: 'CONTINUE',
  REQUIRES_CORRECTION: 'VIEW_CORRECTION',
  READY_FOR_DECISION: 'DECIDE',
  WAITING_EVIDENCE_DELETION: 'VIEW_DELETION',
};

@Injectable()
export class AdminOperationalWorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: RegistrationAuthorizationAdapter,
    private readonly progress: AdminReviewProgressService,
  ) {}

  async list(identityId: string, query: WorkspaceQuery): Promise<
    | Readonly<{ outcome: 'found'; groups: readonly Readonly<{ group: OperationalGroup; total: number; items: readonly OperationalRequest[] }>[] }>
    | Readonly<{ outcome: 'denied' }>
  > {
    const decision = await this.authorization.authorize({ identityId, permission: 'registration.review.list' });
    if (!decision.allowed) return { outcome: 'denied' };
    const rows = await this.prisma.registrationRequest.findMany({
      where: {
        status: { in: ['SUBMITTED', 'REQUIRES_CORRECTION'] },
        ...(query.requestType ? { type: query.requestType } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        type: true,
        status: true,
        version: true,
        approvalExecutionStatus: true,
        submittedAt: true,
        createdAt: true,
        updatedAt: true,
        adminReviewProgress: { select: { stage: true, observedRequestVersion: true } },
      },
    });
    const needle = query.query?.trim().toLocaleLowerCase('es-CO');
    const cards = rows
      .map((row) => this.project(row as AdminProgressRequest))
      .filter((card) => !needle || card.maskedReference.toLocaleLowerCase('es-CO').includes(needle) || card.displayLabel.toLocaleLowerCase('es-CO').includes(needle));
    return {
      outcome: 'found',
      groups: Object.freeze(GROUP_ORDER.map((group) => {
        const items = Object.freeze(cards.filter((card) => card.operationalGroup === group));
        return Object.freeze({ group, total: items.length, items });
      })),
    };
  }

  async updateProgress(identityId: string, requestId: string, command: ProgressCommand) {
    const result = await this.progress.update({
      administratorIdentityId: identityId,
      requestId,
      expectedRequestVersion: command.expectedRequestVersion,
      stage: command.stage,
    });
    return result.outcome === 'updated'
      ? { outcome: 'updated' as const, request: this.project(result.request) }
      : result;
  }

  private project(row: AdminProgressRequest): OperationalRequest {
    const operationalGroup = this.group(row);
    const relevantAt = operationalGroup === 'REQUIRES_CORRECTION' || operationalGroup === 'WAITING_EVIDENCE_DELETION'
      ? row.updatedAt
      : row.submittedAt ?? row.createdAt;
    return Object.freeze({
      requestId: row.id,
      requestVersion: row.version,
      maskedReference: `SOL-••••-${row.id.slice(-4).toUpperCase()}`,
      displayLabel: row.type.includes('ACADEMY') ? 'Academia solicitante' : 'Solicitante',
      requestType: row.type as RegistrationRequestType,
      operationalGroup,
      relevantAt: relevantAt.toISOString(),
      nextAction: NEXT_ACTION[operationalGroup],
    });
  }

  private group(row: AdminProgressRequest): OperationalGroup {
    if (row.approvalExecutionStatus === 'DELETING_EVIDENCE' || row.approvalExecutionStatus === 'RECOVERY_REQUIRED') return 'WAITING_EVIDENCE_DELETION';
    if (row.status === 'REQUIRES_CORRECTION') return 'REQUIRES_CORRECTION';
    const currentProgress = row.adminReviewProgress?.observedRequestVersion === row.version ? row.adminReviewProgress.stage : undefined;
    if (currentProgress === 'REVIEWED') return 'READY_FOR_DECISION';
    if (currentProgress === 'OPENED') return 'CONTINUE_REVIEW';
    return 'NEW';
  }
}
