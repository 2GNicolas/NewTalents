import { AUTH_OPERATION_PATHS, createAuthenticationApi } from './authentication-api';

const issued = { accessToken: 'test-access-not-usable', refreshToken: 'test-refresh-not-usable', tokenType: 'Bearer' as const, expiresIn: 900 };

function response(status: number, body?: object, headers?: Record<string, string>) {
  return new Response(body ? JSON.stringify(body) : undefined, { status, headers: { 'content-type': 'application/json', ...headers } });
}

describe('Feature 003 authentication API boundary', () => {
  it('maps exactly the five approved operations and no administrative operations', () => {
    expect(AUTH_OPERATION_PATHS).toEqual({
      login: '/auth/login',
      activateInitialAccess: '/auth/initial-credential/replace',
      refresh: '/auth/refresh',
      logoutCurrent: '/auth/logout',
      logoutAll: '/auth/logout-all',
    });
    expect(Object.values(AUTH_OPERATION_PATHS)).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/provision|reissue|administrator|registration|recovery/i),
    ]));
  });

  it('maps a successful refresh to replacement session material', async () => {
    const fetcher = jest.fn().mockImplementation(() => Promise.resolve(response(200, issued, { 'cache-control': 'no-store' })));
    const api = createAuthenticationApi({ apiBaseUrl: 'https://api.example.test/base/' }, fetcher);

    await expect(api.refresh('test-refresh-not-usable')).resolves.toEqual({ kind: 'success', value: issued });
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.example.test/auth/refresh');
    expect(fetcher.mock.calls[0]?.[1].headers.Authorization).toBeUndefined();
  });
  it('sends login and activation JSON to the configured base URL and maps issued material', async () => {
    const fetcher = jest.fn().mockImplementation(() => Promise.resolve(response(200, issued, { 'cache-control': 'no-store' })));
    const api = createAuthenticationApi({ apiBaseUrl: 'https://api.example.test/base/' }, fetcher);

    await expect(api.login({ email: 'persona@example.test', password: 'test-password-not-usable' })).resolves.toEqual({ kind: 'success', value: issued });
    await expect(api.activateInitialAccess({ email: 'persona@example.test', temporaryCredential: 'test-temporary-not-usable', newPassword: 'test-password-not-usable' })).resolves.toEqual({ kind: 'success', value: issued });

    expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.example.test/auth/login');
    expect(fetcher.mock.calls[1]?.[0]).toBe('https://api.example.test/auth/initial-credential/replace');
    expect(fetcher.mock.calls[0]?.[1].headers.Authorization).toBeUndefined();
  });

  it('maps generic, throttled, rejected-refresh, invalid-request, unavailable, and connectivity responses safely', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(response(401, { error: 'authentication_failed' }))
      .mockResolvedValueOnce(response(429, { error: 'throttled' }, { 'retry-after': '30' }))
      .mockResolvedValueOnce(response(409, { error: 'refresh_reused' }))
      .mockResolvedValueOnce(response(400, { error: 'invalid_request' }))
      .mockResolvedValueOnce(response(500, { error: 'internal_error' }))
      .mockRejectedValueOnce(new TypeError('network unavailable'));
    const api = createAuthenticationApi({ apiBaseUrl: 'https://api.example.test' }, fetcher);

    await expect(api.login({ email: 'persona@example.test', password: 'test-password-not-usable' })).resolves.toEqual({ kind: 'generic-authentication-failure' });
    await expect(api.login({ email: 'persona@example.test', password: 'test-password-not-usable' })).resolves.toEqual({ kind: 'throttled', retryAfterSeconds: 30 });
    await expect(api.refresh('test-refresh-not-usable')).resolves.toEqual({ kind: 'rejected-refresh' });
    await expect(api.login({ email: 'persona@example.test', password: 'test-password-not-usable' })).resolves.toEqual({ kind: 'invalid-request' });
    await expect(api.login({ email: 'persona@example.test', password: 'test-password-not-usable' })).resolves.toEqual({ kind: 'unavailable-backend' });
    await expect(api.login({ email: 'persona@example.test', password: 'test-password-not-usable' })).resolves.toEqual({ kind: 'connectivity-failure' });
  });

  it('adds Bearer material only to the two logout operations', async () => {
    const fetcher = jest.fn().mockResolvedValue(response(204));
    const api = createAuthenticationApi({ apiBaseUrl: 'https://api.example.test' }, fetcher);

    await api.logoutCurrent('test-access-not-usable');
    await api.logoutAll('test-access-not-usable');

    expect(fetcher.mock.calls.map((call) => call[0])).toEqual(['https://api.example.test/auth/logout', 'https://api.example.test/auth/logout-all']);
    expect(fetcher.mock.calls.every((call) => call[1].headers.Authorization === 'Bearer test-access-not-usable')).toBe(true);
  });
});
