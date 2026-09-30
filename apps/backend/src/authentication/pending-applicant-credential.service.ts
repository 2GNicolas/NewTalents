import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationTransactionService } from './authentication-transaction.service.js';
import { CredentialService } from './credential.service.js';

export type PendingApplicantCredentialResult =
  | Readonly<{ outcome: 'created'; identityId: string }>
  | Readonly<{ outcome: 'invalid' | 'conflict' | 'unavailable' }>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class PendingApplicantCredentialService {
  constructor(
    @Inject(AuthenticationTransactionService) private readonly transactions: AuthenticationTransactionService,
    @Inject(CredentialService) private readonly credentials: CredentialService,
  ) {}

  async create(input: Readonly<{ requestId: unknown; email: unknown; password: unknown; passwordConfirmation: unknown }>): Promise<PendingApplicantCredentialResult> {
    const normalizedEmail = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    if (!UUID_PATTERN.test(String(input.requestId)) || !EMAIL_PATTERN.test(normalizedEmail) || !this.credentials.validPassword(input.password) || input.password !== input.passwordConfirmation) return { outcome: 'invalid' };

    try {
      const passwordHash = await this.credentials.hashPassword(input.password);
      return await this.transactions.execute(async (transaction) => {
        const identity = await transaction.identity.create({ data: {} });
        const claimed = await transaction.registrationRequest.updateMany({
          where: { id: input.requestId as string, ownerIdentityId: null, status: 'DRAFT' },
          data: { ownerIdentityId: identity.id },
        });
        if (claimed.count !== 1) throw { code: 'REGISTRATION_REQUEST_CONFLICT' };
        await transaction.authenticationCredential.create({
          data: { identityId: identity.id, normalizedEmail, passwordHash, activatedAt: new Date() },
        });
        await transaction.registrationApplicantAccess.create({
          data: { requestId: input.requestId as string, identityId: identity.id, status: 'PENDING_ONBOARDING' },
        });
        return { outcome: 'created', identityId: identity.id } as const;
      });
    } catch (error) {
      const code = this.errorCode(error);
      if (code === 'P2002' || code === 'P2003' || code === 'REGISTRATION_REQUEST_CONFLICT') return { outcome: 'conflict' };
      return { outcome: 'unavailable' };
    }
  }

  private errorCode(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  }
}
