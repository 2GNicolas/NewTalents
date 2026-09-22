import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { AUTHORIZATION_CONTRACT_VERSION, type AuthorizationRequest } from '../authorization/authorization.contract.js';
import type { FunctionalRole } from '../identity/role-assignment.service.js';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthenticationTransactionClient } from './authentication-transaction.service.js';
import { AuthenticationTransactionService } from './authentication-transaction.service.js';
import { CredentialService } from './credential.service.js';
import { SecurityEventService } from './security-event.service.js';

const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const email = (value: unknown): value is string => typeof value === 'string' && value === value.trim().toLowerCase() && value.length > 3 && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const eligible = new Set<FunctionalRole>(['ADMINISTRATOR', 'ANALYST', 'USER', 'TUTOR', 'ACADEMY_USER']);

export type TemporaryCredentialResult = Readonly<{ outcome: 'provisioned'; temporaryCredential: string }> | Readonly<{ outcome: 'denied' | 'invalid' | 'unavailable' }>;
export type ProvisionTemporaryCredential = Readonly<{ actorIdentityId: unknown; identityId: unknown; normalizedEmail: unknown }>;

@Injectable()
export class TemporaryCredentialService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(CredentialService) private readonly credentials: CredentialService,
    @Inject(AuthenticationTransactionService) private readonly transactions: AuthenticationTransactionService,
    @Inject(SecurityEventService) private readonly securityEvents: SecurityEventService,
  ) {}

  async provision(input: ProvisionTemporaryCredential): Promise<TemporaryCredentialResult> {
    return this.create(input, 'TEMPORARY_CREDENTIAL_PROVISIONED');
  }

  async reissue(input: ProvisionTemporaryCredential): Promise<TemporaryCredentialResult> {
    return this.create(input, 'TEMPORARY_CREDENTIAL_REISSUED');
  }

  private async create(input: ProvisionTemporaryCredential, event: 'TEMPORARY_CREDENTIAL_PROVISIONED' | 'TEMPORARY_CREDENTIAL_REISSUED'): Promise<TemporaryCredentialResult> {
    if (!uuid(input.actorIdentityId) || !uuid(input.identityId) || !email(input.normalizedEmail)) return { outcome: 'invalid' };
    const actorIdentityId = input.actorIdentityId;
    const identityId = input.identityId;
    const normalizedEmail = input.normalizedEmail;
    const temporaryCredential = randomBytes(32).toString('base64url');
    try {
      return await this.transactions.execute(async (transaction) => {
        const actor = await this.authorizationRequest(transaction, actorIdentityId);
        const decision = this.authorization.evaluate({ ...actor, permission: 'foundation.privileged.role-change', resource: { classification: 'protected' } });
        if (!decision.allowed) {
          await this.securityEvents.record(transaction, { type: event, outcome: 'DENIED', identityId, actorIdentityId, reasonCategory: decision.reason });
          return { outcome: 'denied' };
        }
        const target = await transaction.identity.findUnique({ where: { id: identityId }, select: { status: true, roleAssignments: { where: { status: 'ACTIVE' }, select: { role: true } } } });
        if (!target || target.status !== 'ACTIVE' || !target.roleAssignments.some((assignment) => eligible.has(assignment.role as FunctionalRole))) {
          await this.securityEvents.record(transaction, { type: event, outcome: 'DENIED', identityId, actorIdentityId, reasonCategory: 'ineligible-identity' });
          return { outcome: 'denied' };
        }
        const existing = await transaction.authenticationCredential.findUnique({ where: { normalizedEmail }, select: { identityId: true } });
        if (existing && existing.identityId !== identityId) return { outcome: 'denied' };
        await transaction.temporaryCredential.updateMany({ where: { identityId, status: 'ISSUED' }, data: { status: 'INVALIDATED', invalidatedAt: new Date() } });
        await transaction.temporaryCredential.create({ data: { identityId, issuedByIdentityId: actorIdentityId, normalizedEmail, secretHash: await this.credentials.hashPassword(temporaryCredential), expiresAt: new Date(Date.now() + 86_400_000) } });
        await this.securityEvents.record(transaction, { type: event, outcome: 'APPLIED', identityId, actorIdentityId });
        return { outcome: 'provisioned', temporaryCredential };
      });
    } catch { return { outcome: 'unavailable' }; }
  }

  private async authorizationRequest(transaction: AuthenticationTransactionClient, actorIdentityId: string): Promise<AuthorizationRequest> {
    const actor = await transaction.identity.findUnique({ where: { id: actorIdentityId }, select: { status: true, roleAssignments: { where: { status: 'ACTIVE' }, select: { role: true } } } });
    return {
      version: AUTHORIZATION_CONTRACT_VERSION,
      permission: 'foundation.privileged.role-change',
      resource: { classification: 'protected' },
      subject: actor ? { kind: 'authenticated', identityId: actorIdentityId, status: actor.status, roles: actor.roleAssignments.map((assignment) => ({ role: assignment.role as FunctionalRole, active: true })) } : { kind: 'anonymous' },
    };
  }
}
