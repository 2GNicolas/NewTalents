import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationTransactionService } from './authentication-transaction.service.js';
import { CredentialService } from './credential.service.js';
import { SecurityEventService } from './security-event.service.js';

export type AdministratorOperatorInput = Readonly<{ confirmation: boolean; email: unknown; password: unknown }>;
export type AdministratorBootstrapResult = Readonly<{ outcome: 'initialized'; identityId: string }> | Readonly<{ outcome: 'refused' | 'invalid' | 'unavailable' }>;

export const isNormalizedOperatorEmail = (value: unknown): value is string =>
  typeof value === 'string' && value === value.trim().toLowerCase() && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

@Injectable()
export class AdministratorBootstrapService {
  constructor(
    @Inject(AuthenticationTransactionService) private readonly transactions: AuthenticationTransactionService,
    @Inject(CredentialService) private readonly credentials: CredentialService,
    @Inject(SecurityEventService) private readonly securityEvents: SecurityEventService,
  ) {}

  async initialize(input: AdministratorOperatorInput): Promise<AdministratorBootstrapResult> {
    if (!input.confirmation) return { outcome: 'refused' };
    if (!isNormalizedOperatorEmail(input.email) || !this.credentials.validPassword(input.password)) return { outcome: 'invalid' };
    const normalizedEmail = input.email;
    const passwordHash = await this.credentials.hashPassword(input.password);
    try {
      return await this.transactions.execute(async (transaction) => {
        const historicalAdministrator = await transaction.roleAssignment.findFirst({ where: { role: 'ADMINISTRATOR' }, select: { id: true } });
        if (historicalAdministrator) {
          await this.securityEvents.record(transaction, { type: 'INITIALIZATION_DENIED', outcome: 'DENIED', reasonCategory: 'administrator-history-exists' });
          return { outcome: 'refused' };
        }
        const identity = await transaction.identity.create({ data: {} });
        await transaction.authenticationCredential.create({ data: { identityId: identity.id, normalizedEmail, passwordHash, activatedAt: new Date() } });
        await transaction.roleAssignment.create({ data: { identityId: identity.id, assignedByIdentityId: identity.id, role: 'ADMINISTRATOR' } });
        await this.securityEvents.record(transaction, { type: 'INITIALIZATION_SUCCEEDED', outcome: 'APPLIED', identityId: identity.id });
        return { outcome: 'initialized', identityId: identity.id };
      });
    } catch {
      return { outcome: 'unavailable' };
    }
  }
}
