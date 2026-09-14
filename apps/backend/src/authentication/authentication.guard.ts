import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenService } from './token.service.js';
import { SessionService } from './session.service.js';
import { PUBLIC_ROUTE } from './public-route.decorator.js';
export type RequestActor = Readonly<{ identityId: string; sessionId: string }>;
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly tokens: TokenService, private readonly sessions: SessionService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown>; actor?: RequestActor }>();
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !/^Bearer [^\s]+$/.test(header)) return false;
    const verified = await this.tokens.verifyAccessToken(header.slice(7));
    if (!verified || !await this.sessions.validate(verified.identityId, verified.sessionId)) return false;
    request.actor = { identityId: verified.identityId, sessionId: verified.sessionId };
    return true;
  }
}
