import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';
import type { BackendRuntimeConfiguration } from '../config/environment.schema.js';

const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{8}$/i.test(value);
const opaque = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

@Injectable()
export class TokenService {
  private readonly key: Uint8Array;
  constructor(private readonly configuration: Pick<BackendRuntimeConfiguration, 'authentication'>) {
    this.key = new TextEncoder().encode(configuration.authentication.signingSecret);
  }
  async issueAccessToken(input: Readonly<{ identityId: string; sessionId: string }>): Promise<string> {
    if (!opaque(input.identityId) || !opaque(input.sessionId)) throw new Error('Invalid token input');
    return new SignJWT({ sid: input.sessionId, typ: 'access' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(input.identityId).setJti(randomBytes(16).toString('base64url'))
      .setIssuedAt().setIssuer(this.configuration.authentication.issuer).setAudience(this.configuration.authentication.audience)
      .setExpirationTime(`${this.configuration.authentication.accessTokenTtlSeconds}s`).sign(this.key);
  }
  get accessTokenTtlSeconds(): number { return this.configuration.authentication.accessTokenTtlSeconds; }
  async verifyAccessToken(token: unknown): Promise<Readonly<{ identityId: string; sessionId: string; tokenId: string }> | null> {
    if (typeof token !== 'string') return null;
    try {
      const { payload, protectedHeader } = await jwtVerify(token, this.key, { algorithms: ['HS256'], issuer: this.configuration.authentication.issuer, audience: this.configuration.authentication.audience });
      if (protectedHeader.alg !== 'HS256' || payload.typ !== 'access' || !opaque(payload.sub) || !opaque(payload.sid) || typeof payload.jti !== 'string' || !payload.iat || !payload.exp) return null;
      return { identityId: payload.sub, sessionId: payload.sid, tokenId: payload.jti };
    } catch { return null; }
  }
  createRefreshToken(): string { return randomBytes(32).toString('base64url'); }
  digestRefreshToken(token: string): string { return createHash('sha256').update(token, 'utf8').digest('hex'); }
}