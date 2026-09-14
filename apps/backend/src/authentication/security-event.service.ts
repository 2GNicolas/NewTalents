import { Injectable } from '@nestjs/common';
import type { ChangeOutcome, AuthenticationSecurityEventType } from '../generated/prisma/client.js';
import type { AuthenticationTransactionClient } from './authentication-transaction.service.js';

@Injectable()
export class SecurityEventService {
  async record(transaction: AuthenticationTransactionClient, input: Readonly<{ type: AuthenticationSecurityEventType; outcome: ChangeOutcome; identityId?: string; actorIdentityId?: string; reasonCategory?: string }>): Promise<void> {
    await transaction.authenticationSecurityEvent.create({ data: {
      type: input.type, outcome: input.outcome, details: {},
      ...(input.identityId ? { identityId: input.identityId } : {}),
      ...(input.actorIdentityId ? { actorIdentityId: input.actorIdentityId } : {}),
      ...(input.reasonCategory ? { reasonCategory: input.reasonCategory } : {}),
    } });
  }
}
