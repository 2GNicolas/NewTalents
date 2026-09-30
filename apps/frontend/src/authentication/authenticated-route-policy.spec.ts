import {
  authenticatedEntry,
  isAuthenticationRoute,
  isPassportRoute,
  resolveRootRouteAction,
} from './authenticated-route-policy';

describe('Feature 005 authenticated route policy', () => {
  it('lands an Administrator in the registration inbox after login', () => {
    const access = { classification: 'product' as const, capabilities: ['registration.review.list'] };
    expect(authenticatedEntry(access)).toBe('/(admin)/admin/registration');
    expect(resolveRootRouteAction('authenticated', '/login', access)).toEqual({ type: 'replace', href: '/(admin)/admin/registration' });
  });
  it('preserves an authenticated nested passport URL during restoration and after refresh', () => {
    const pathname = '/passports/13810119-eded-43b7-805c-8765abc1eec6/sections/resumen';
    expect(isPassportRoute(pathname)).toBe(true);
    expect(resolveRootRouteAction('restoring', pathname)).toEqual({ type: 'none' });
    expect(resolveRootRouteAction('refreshing', pathname)).toEqual({ type: 'none' });
    expect(resolveRootRouteAction('authenticated', pathname)).toEqual({ type: 'none' });
  });

  it('redirects the neutral root to the product entry only after authentication resolves', () => {
    expect(resolveRootRouteAction('authenticated', '/')).toEqual({
      type: 'replace',
      href: '/(authenticated)/passports',
    });
    expect(resolveRootRouteAction('restoring', '/')).toEqual({ type: 'none' });
  });

  it('redirects a reusable-session loss to login only after restoration proves rejection', () => {
    const pathname = '/passports/13810119-eded-43b7-805c-8765abc1eec6/sections/resumen';
    expect(resolveRootRouteAction('session-expired', pathname)).toEqual({
      type: 'replace',
      href: '/(auth)/login',
    });
    expect(resolveRootRouteAction('unauthenticated', pathname)).toEqual({
      type: 'replace',
      href: '/(auth)/login',
    });
  });

  it('does not treat retryable restoration transport failures as an unauthenticated session', () => {
    const pathname = '/passports/13810119-eded-43b7-805c-8765abc1eec6/sections/resumen';
    expect(resolveRootRouteAction('connectivity-failure', pathname)).toEqual({ type: 'none' });
    expect(resolveRootRouteAction('backend-unavailable', pathname)).toEqual({ type: 'none' });
  });

  it('recognizes authentication-group routes without relying on group segment names', () => {
    expect(isAuthenticationRoute('/login')).toBe(true);
    expect(isAuthenticationRoute('/activate-initial-access')).toBe(true);
    expect(isAuthenticationRoute('/passports')).toBe(false);
  });

  it('keeps academy registration routes only for a backend-projected academy capability', () => {
    expect(authenticatedEntry({ classification: 'product', academyId: 'academy-1', capabilities: ['registration.request.academy.list'] })).toBe('/(academy)/registration?academyId=academy-1');
    expect(resolveRootRouteAction('authenticated', '/registration', { classification: 'product', capabilities: ['registration.request.academy.list'] })).toEqual({ type: 'none' });
    expect(resolveRootRouteAction('authenticated', '/registration/player-adult', { classification: 'product', capabilities: [] })).toEqual({ type: 'replace', href: '/(authenticated)/passports' });
  });

  it('keeps Administrator registration routes only for the backend-projected review capability', () => {
    expect(resolveRootRouteAction('authenticated', '/admin/registration', { classification: 'product', capabilities: ['registration.review.list'] })).toEqual({ type: 'none' });
    expect(resolveRootRouteAction('authenticated', '/admin/registration/request-1', { classification: 'product', capabilities: ['registration.request.academy.list'] })).toEqual({ type: 'replace', href: '/(authenticated)/passports' });
  });
});
