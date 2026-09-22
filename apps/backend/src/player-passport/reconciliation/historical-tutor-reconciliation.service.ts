import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class HistoricalTutorReconciliationService {
  public constructor(private readonly prisma: PrismaService) {}

  public async reconcile(actorIdentityId: string, legacyResponsibilityId: string | null, hasCompleteVerifiedFacts: boolean) {
    const existing = await this.prisma.historicalTutorReconciliationAudit.findFirst({ where: { actorIdentityId, legacyResponsibilityId } });
    if (existing) return existing;
    const outcome = hasCompleteVerifiedFacts ? 'REVIEW_REQUIRED' : 'NO_AUTHORITY_GRANTED';
    const reasonCategory = hasCompleteVerifiedFacts ? 'EXPLICIT_REVIEW_REQUIRED' : 'INCOMPLETE_HISTORICAL_FACTS';
    return this.prisma.historicalTutorReconciliationAudit.create({ data: { actorIdentityId, legacyResponsibilityId, outcome, reasonCategory } });
  }
}
