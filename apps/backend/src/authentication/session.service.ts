import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthenticationTransactionClient } from './authentication-transaction.service.js';
import { AuthenticationTransactionService } from './authentication-transaction.service.js';
import { SecurityEventService } from './security-event.service.js';
import type { FirstSessionIssuer } from './credential-replacement.service.js';

const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
@Injectable()
export class SessionService implements FirstSessionIssuer {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuthenticationTransactionService) private readonly transactions: AuthenticationTransactionService, @Inject(SecurityEventService) private readonly events: SecurityEventService) {}
  async issueFirstSession(transaction: AuthenticationTransactionClient, identityId: string): Promise<void> { await this.createInTransaction(transaction, identityId); }
  async create(identityId: unknown): Promise<string | null> { if (!uuid(identityId)) return null; try { return await this.transactions.execute((tx) => this.createInTransaction(tx, identityId)); } catch { return null; } }
  async createInTransaction(transaction: AuthenticationTransactionClient, identityId: string): Promise<string> {
    const session = await transaction.authenticationSession.create({ data: { identityId, familyId: crypto.randomUUID(), expiresAt: new Date(Date.now() + 30 * 86_400_000) } }); return session.id;
  }
  async validate(identityId: unknown, sessionId: unknown): Promise<boolean> {
    if (!uuid(identityId) || !uuid(sessionId)) return false;
    const session = await this.prisma.authenticationSession.findFirst({ where: { id: sessionId, identityId, status: 'ACTIVE', expiresAt: { gt: new Date() }, identity: { status: 'ACTIVE', OR: [{ roleAssignments: { some: { status: 'ACTIVE' } } }, { registrationApplicantAccesses: { some: { status: 'PENDING_ONBOARDING' } } }] } }, select: { id: true } }); return Boolean(session);
  }
  async logoutCurrent(identityId: unknown, sessionId: unknown): Promise<boolean> { return this.revoke(identityId, sessionId, false); }
  async logoutAll(identityId: unknown): Promise<boolean> { return this.revoke(identityId, undefined, true); }
  private async revoke(identityId: unknown, sessionId: unknown, all: boolean): Promise<boolean> {
    if (!uuid(identityId) || (!all && !uuid(sessionId))) return false;
    try { await this.transactions.execute(async (tx) => { const where = all ? { identityId, status: 'ACTIVE' as const } : { id: sessionId as string, identityId, status: 'ACTIVE' as const }; const result = await tx.authenticationSession.updateMany({ where, data: { status: 'REVOKED', revokedAt: new Date(), revocationReason: all ? 'logout-all' : 'logout-current' } }); if (result.count) await this.events.record(tx, { type: all ? 'SESSIONS_REVOKED' : 'SESSION_REVOKED', outcome: 'APPLIED', identityId }); }); return true; } catch { return false; }
  }
}
