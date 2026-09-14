import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationTransactionService } from './authentication-transaction.service.js';
import { type AdministratorOperatorInput, isNormalizedOperatorEmail } from './administrator-bootstrap.service.js';
import { CredentialService } from './credential.service.js';
import { SecurityEventService } from './security-event.service.js';

export type AdministratorRecoveryResult = Readonly<{ outcome: 'recovered'; identityId: string }> | Readonly<{ outcome: 'refused' | 'invalid' | 'unavailable' }>;

@Injectable()
export class AdministratorRecoveryService {
  constructor(
    @Inject(AuthenticationTransactionService) private readonly transactions: AuthenticationTransactionService,
    @Inject(CredentialService) private readonly credentials: CredentialService,
    @Inject(SecurityEventService) private readonly securityEvents: SecurityEventService,
  ) {}

  async recover(input: AdministratorOperatorInput): Promise<AdministratorRecoveryResult> {
    if (!input.confirmation) return { outcome: 'refused' };
    if (!isNormalizedOperatorEmail(input.email) || !this.credentials.validPassword(input.password)) return { outcome: 'invalid' };
    const normalizedEmail = input.email;
    const passwordHash = await this.credentials.hashPassword(input.password);
    try {
      return await this.transactions.execute(async (transaction) => {
        const activeAdministrator = await transaction.roleAssignment.findFirst({
          where: { role: 'ADMINISTRATOR', status: 'ACTIVE', identity: { status: 'ACTIVE' } },
          select: { id: true },
        });
        if (activeAdministrator) {
          await this.securityEvents.record(transaction, { type: 'RECOVERY_DENIED', outcome: 'DENIED', reasonCategory: 'active-administrator-exists' });
          return { outcome: 'refused' };
        }
        const identity = await transaction.identity.create({ data: {} });
        await transaction.authenticationCredential.create({ data: { identityId: identity.id, normalizedEmail, passwordHash, activatedAt: new Date() } });
        await transaction.roleAssignment.create({ data: { identityId: identity.id, assignedByIdentityId: identity.id, role: 'ADMINISTRATOR' } });
        // The recovery identity is deliberately new. This conditional no-op documents that no
        // pre-existing session can become compatible with the recovered Administrator state.
        await transaction.authenticationSession.updateMany({ where: { identityId: identity.id, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: new Date(), revocationReason: 'administrator-recovery' } });
        await this.securityEvents.record(transaction, { type: 'RECOVERY_SUCCEEDED', outcome: 'APPLIED', identityId: identity.id });
        return { outcome: 'recovered', identityId: identity.id };
      });
    } catch {
      return { outcome: 'unavailable' };
    }
  }
}
