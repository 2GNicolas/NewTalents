import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class ChangeAuditService {
  async record(transaction: Prisma.TransactionClient, actorIdentityId: string, targetIdentityId: string, operation: string, outcome: 'APPLIED' | 'DENIED', reasonCategory: string): Promise<void> {
    await transaction.authorizationChangeRecord.create({ data: { actorIdentityId, targetIdentityId, operation, priorState: {}, resultingState: {}, outcome, reasonCategory, policyVersion: '1' } });
  }
}
