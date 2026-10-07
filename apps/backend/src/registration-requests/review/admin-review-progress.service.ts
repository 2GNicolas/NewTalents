import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';

export type AdminReviewStage = 'OPENED' | 'REVIEWED';

export type AdminProgressRequest = Readonly<{
  id: string;
  type: string;
  status: string;
  version: number;
  approvalExecutionStatus: string;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  adminReviewProgress: Readonly<{
    stage: AdminReviewStage;
    observedRequestVersion: number;
    startedByIdentityId: string;
    lastUpdatedByIdentityId?: string;
    startedAt: Date;
    updatedAt?: Date;
  }> | null;
}>;

type UpdateInput = Readonly<{
  administratorIdentityId: string;
  requestId: string;
  expectedRequestVersion: number;
  stage: AdminReviewStage;
}>;

const REQUEST_SELECT = {
  id: true,
  type: true,
  status: true,
  version: true,
  approvalExecutionStatus: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  adminReviewProgress: {
    select: {
      stage: true,
      observedRequestVersion: true,
      startedByIdentityId: true,
      lastUpdatedByIdentityId: true,
      startedAt: true,
      updatedAt: true,
    },
  },
} as const;

@Injectable()
export class AdminReviewProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: RegistrationAuthorizationAdapter,
  ) {}

  async update(input: UpdateInput): Promise<
    | Readonly<{ outcome: 'updated'; request: AdminProgressRequest }>
    | Readonly<{ outcome: 'not-found' | 'stale' }>
  > {
    const decision = await this.authorization.authorize({
      identityId: input.administratorIdentityId,
      permission: 'registration.review.progress',
      requestId: input.requestId,
    });
    if (!decision.allowed) return { outcome: 'not-found' };

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const request = await transaction.registrationRequest.findUnique({
          where: { id: input.requestId },
          select: REQUEST_SELECT,
        });
        if (!request || request.status !== 'SUBMITTED') return { outcome: 'not-found' as const };
        if (request.version !== input.expectedRequestVersion) return { outcome: 'stale' as const };

        const prior = request.adminReviewProgress;
        const sameVersion = prior?.observedRequestVersion === request.version;
        const stage: AdminReviewStage = sameVersion && prior.stage === 'REVIEWED' ? 'REVIEWED' : input.stage;
        const reset = !sameVersion;
        const now = new Date();
        const progress = await transaction.registrationAdminReviewProgress.upsert({
          where: { requestId: request.id },
          create: {
            requestId: request.id,
            stage,
            observedRequestVersion: request.version,
            startedByIdentityId: input.administratorIdentityId,
            lastUpdatedByIdentityId: input.administratorIdentityId,
          },
          update: {
            stage,
            observedRequestVersion: request.version,
            lastUpdatedByIdentityId: input.administratorIdentityId,
            ...(reset ? { startedByIdentityId: input.administratorIdentityId, startedAt: now } : {}),
          },
          select: {
            stage: true,
            observedRequestVersion: true,
            startedByIdentityId: true,
            lastUpdatedByIdentityId: true,
            startedAt: true,
            updatedAt: true,
          },
        });
        return { outcome: 'updated' as const, request: { ...request, adminReviewProgress: progress } };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') return { outcome: 'stale' };
      throw error;
    }
  }
}
