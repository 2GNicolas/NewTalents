import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { AttemptControlService } from './attempt-control.service.js';
import { CredentialService } from './credential.service.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { projectSessionAccess, type SessionAccessProjection } from './session-access.projection.js';

type Source = Readonly<{ remoteAddress?: unknown; forwardedFor?: unknown }>;
export type LoginResult = Readonly<{ outcome: 'authenticated'; accessToken: string; refreshToken: string; sessionId: string; access: SessionAccessProjection }> | Readonly<{ outcome: 'invalid-credentials' | 'throttled' }>;
@Injectable()
export class AuthenticationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(CredentialService) private readonly credentials: CredentialService, @Inject(AttemptControlService) private readonly attempts: AttemptControlService, @Inject(SessionService) private readonly sessions: SessionService, @Inject(TokenService) private readonly tokens: TokenService, @Inject(RefreshTokenService) private readonly refreshes: RefreshTokenService) {}
  async login(input: Readonly<{ email: unknown; password: unknown; source: Source }>): Promise<LoginResult> {
    if (await this.attempts.throttled(input.email, input.source)) return { outcome: 'throttled' };
    const normalizedEmail = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const credential = await this.prisma.authenticationCredential.findUnique({ where: { normalizedEmail }, include: { identity: { include: { roleAssignments: { where: { status: 'ACTIVE' } }, memberships: { where: { status: 'ACTIVE' }, select: { academyId: true, status: true } }, registrationApplicantAccesses: { where: { status: 'PENDING_ONBOARDING' }, include: { request: { select: { status: true } } } } } } } });
    const authorizedAccess = credential !== null && (credential.identity.roleAssignments.length > 0 || (credential.identity.registrationApplicantAccesses?.length ?? 0) > 0);
    const valid = credential !== null && credential.status === 'ACTIVE' && credential.identity.status === 'ACTIVE' && authorizedAccess && await this.credentials.verifyPassword(credential.passwordHash, input.password);
    if (!valid) { await this.attempts.failed(input.email, input.source); return { outcome: 'invalid-credentials' }; }
    const sessionId = await this.sessions.create(credential.identityId);
    if (!sessionId) return { outcome: 'invalid-credentials' };
    const refreshToken = await this.refreshes.issue(sessionId);
    const accessToken = await this.tokens.issueAccessToken({ identityId: credential.identityId, sessionId });
    await this.attempts.succeeded(input.email, input.source);
    return { outcome: 'authenticated', sessionId, accessToken, refreshToken, access: projectSessionAccess(credential.identity) };
  }
}
