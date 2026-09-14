import { describe, expect, it } from 'vitest';
import { TokenService } from './token.service.js';

const configuration = { authentication: { issuer: 'new-talents.test', audience: 'new-talents-client', signingSecret: 'test-signing-secret-that-is-long-enough-to-be-safe', accessTokenTtlSeconds: 900 } } as never;

describe('TokenService', () => {
  it('issues a minimal HS256 access JWT and validates its identity/session-only claims', async () => {
    const service = new TokenService(configuration);
    const token = await service.issueAccessToken({ identityId: '11111111-1111-4111-8111-111111111111', sessionId: '22222222-2222-4222-8222-222222222222' });
    const payload = await service.verifyAccessToken(token);
    expect(payload).toMatchObject({ identityId: '11111111-1111-4111-8111-111111111111', sessionId: '22222222-2222-4222-8222-222222222222' });
  });

  it('generates at least 256-bit opaque refresh tokens and SHA-256 digests', () => {
    const service = new TokenService(configuration);
    const refresh = service.createRefreshToken();
    expect(Buffer.from(refresh, 'base64url')).toHaveLength(32);
    expect(service.digestRefreshToken(refresh)).toMatch(/^[a-f0-9]{64}$/);
  });
});
