import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthenticationTransactionClient } from './authentication-transaction.service.js';
import { AuthenticationTransactionService } from './authentication-transaction.service.js';
import { CredentialService } from './credential.service.js';
import { SecurityEventService } from './security-event.service.js';

export const FIRST_SESSION_ISSUER = Symbol('FIRST_SESSION_ISSUER');
export interface FirstSessionIssuer {
  issueFirstSession(transaction: AuthenticationTransactionClient, identityId: string): Promise<void>;
}
export type ReplaceInitialCredentialResult = Readonly<{ outcome: 'replaced' }> | Readonly<{ outcome: 'denied' | 'invalid' | 'unavailable' }>;
export type ReplaceInitialCredentialInput = Readonly<{ identityId: unknown; temporaryCredential: unknown; replacementPassword: unknown }>;
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

@Injectable()
export class CredentialReplacementService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CredentialService) private readonly credentials: CredentialService,
    @Inject(AuthenticationTransactionService) private readonly transactions: AuthenticationTransactionService,
    @Inject(SecurityEventService) private readonly securityEvents: SecurityEventService,
    @Inject(FIRST_SESSION_ISSUER) private readonly sessions: FirstSessionIssuer,
  ) {}

  async replace(input: ReplaceInitialCredentialInput): Promise<ReplaceInitialCredentialResult> {
    if (!uuid(input.identityId) || typeof input.temporaryCredential !== 'string' || !this.credentials.validPassword(input.temporaryCredential) || !this.credentials.validPassword(input.replacementPassword)) return { outcome: 'invalid' };
    const identityId = input.identityId;
    const temporaryCredential = input.temporaryCredential;
    const replacementPassword = input.replacementPassword;
    try {
      return await this.transactions.execute(async (transaction) => {
        const temporary = await transaction.temporaryCredential.findFirst({ where: { identityId, status: 'ISSUED' }, orderBy: { issuedAt: 'desc' } });
        const identity = await transaction.identity.findUnique({ where: { id: identityId }, select: { status: true, roleAssignments: { where: { status: 'ACTIVE' }, select: { id: true } } } });
        if (!temporary || temporary.expiresAt <= new Date() || identity?.status !== 'ACTIVE' || identity.roleAssignments.length === 0 || !await this.credentials.verifyPassword(temporary.secretHash, temporaryCredential)) {
          await this.securityEvents.record(transaction, { type: 'TEMPORARY_CREDENTIAL_REPLACED', outcome: 'DENIED', identityId, reasonCategory: 'invalid-credential' });
          return { outcome: 'denied' };
        }
        const consumed = await transaction.temporaryCredential.updateMany({ where: { id: temporary.id, status: 'ISSUED' }, data: { status: 'CONSUMED', consumedAt: new Date() } });
        if (consumed.count !== 1) return { outcome: 'denied' };
        await transaction.authenticationCredential.upsert({ where: { identityId }, create: { identityId, normalizedEmail: temporary.normalizedEmail, passwordHash: await this.credentials.hashPassword(replacementPassword), activatedAt: new Date() }, update: { normalizedEmail: temporary.normalizedEmail, passwordHash: await this.credentials.hashPassword(replacementPassword), status: 'ACTIVE', activatedAt: new Date(), disabledAt: null } });
        await this.sessions.issueFirstSession(transaction, identityId);
        await this.securityEvents.record(transaction, { type: 'TEMPORARY_CREDENTIAL_REPLACED', outcome: 'APPLIED', identityId });
        return { outcome: 'replaced' };
      });
    } catch { return { outcome: 'unavailable' }; }
  }
}
