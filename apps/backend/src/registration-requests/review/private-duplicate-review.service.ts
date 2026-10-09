import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';

@Injectable()
export class PrivateDuplicateReviewService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: RegistrationAuthorizationAdapter) {}

  async read(identityId: string, requestId: string) {
    const allowed = await this.authorization.authorize({ identityId, permission: 'registration.review.view', requestId });
    if (!allowed.allowed) return { outcome: 'not-found' as const };
    const signals = await this.prisma.registrationPrivateDuplicateSignal.findMany({ where: { requestId }, select: { status: true } });
    return this.project(signals);
  }

  async resolveDistinct(identityId: string, requestId: string) {
    const allowed = await this.authorization.authorize({ identityId, permission: 'registration.review.view', requestId });
    if (!allowed.allowed) return { outcome: 'not-found' as const };
    await this.prisma.registrationPrivateDuplicateSignal.updateMany({ where: { requestId, status: 'OPEN' }, data: { status: 'DISTINCT', resolvedByIdentityId: identityId, resolvedAt: new Date() } });
    return Object.freeze({ state: 'RESOLVED_DISTINCT' as const, canApprove: true });
  }

  async approvalFact(_requestId: string, signals: readonly Readonly<{ status: string }>[]): Promise<boolean> {
    return !signals.some(({ status }) => status === 'OPEN' || status === 'CONFIRMED_CONFLICT');
  }

  applicantConflict() { return Object.freeze({ code: 'REGISTRATION_CONFLICT' as const }); }

  private project(signals: readonly Readonly<{ status: string }>[]) {
    if (signals.some(({ status }) => status === 'CONFIRMED_CONFLICT')) return Object.freeze({ state: 'CONFLICT' as const, canApprove: false });
    if (signals.some(({ status }) => status === 'OPEN')) return Object.freeze({ state: 'REVIEW_REQUIRED' as const, canApprove: false });
    if (signals.some(({ status }) => status === 'DISTINCT')) return Object.freeze({ state: 'RESOLVED_DISTINCT' as const, canApprove: true });
    return Object.freeze({ state: 'CLEAR' as const, canApprove: true });
  }
}
