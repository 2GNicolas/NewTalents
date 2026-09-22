import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { AuthenticationTransactionService } from './authentication-transaction.service.js';
import { TokenService } from './token.service.js';
import { SecurityEventService } from './security-event.service.js';

export type RefreshResult =
  | Readonly<{ outcome: 'rotated'; refreshToken: string; accessToken: string; expiresIn: number }>
  | Readonly<{ outcome: 'denied' | 'unavailable' }>;

@Injectable()
export class RefreshTokenService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthenticationTransactionService) private readonly transactions: AuthenticationTransactionService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(SecurityEventService) private readonly events: SecurityEventService,
  ) {}

  async issue(sessionId: string): Promise<string> {
    const token = this.tokens.createRefreshToken();
    await this.prisma.refreshTokenHistory.create({
      data: {
        sessionId,
        digest: this.tokens.digestRefreshToken(token),
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    return token;
  }

  async rotate(raw: unknown): Promise<RefreshResult> {
    if (typeof raw !== 'string' || raw.length < 32) return { outcome: 'denied' };
    try {
      return await this.transactions.execute(async (tx) => {
        const digest = this.tokens.digestRefreshToken(raw);
        const current = await tx.refreshTokenHistory.findUnique({ where: { digest }, include: { session: true } });
        if (!current || current.status !== 'ISSUED' || current.expiresAt <= new Date() || current.session.status !== 'ACTIVE') {
          if (current) {
            await tx.authenticationSession.updateMany({
              where: { id: current.sessionId, status: 'ACTIVE' },
              data: { status: 'REVOKED', revokedAt: new Date(), revocationReason: 'refresh-reuse' },
            });
          }
          return { outcome: 'denied' } as const;
        }
        const consumed = await tx.refreshTokenHistory.updateMany({
          where: { id: current.id, status: 'ISSUED' },
          data: { status: 'CONSUMED', consumedAt: new Date(), replacedAt: new Date() },
        });
        if (consumed.count !== 1) return { outcome: 'denied' } as const;
        const accessToken = await this.tokens.issueAccessToken({
          identityId: current.session.identityId,
          sessionId: current.sessionId,
        });
        const successor = this.tokens.createRefreshToken();
        await tx.refreshTokenHistory.create({
          data: {
            sessionId: current.sessionId,
            digest: this.tokens.digestRefreshToken(successor),
            predecessorId: current.id,
            expiresAt: new Date(Date.now() + 30 * 86_400_000),
          },
        });
        await this.events.record(tx, {
          type: 'REFRESH_ROTATED',
          outcome: 'APPLIED',
          identityId: current.session.identityId,
        });
        return {
          outcome: 'rotated',
          refreshToken: successor,
          accessToken,
          expiresIn: this.tokens.accessTokenTtlSeconds,
        } as const;
      });
    } catch {
      return { outcome: 'unavailable' };
    }
  }
}