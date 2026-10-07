import {
  authenticatedEntry,
  isAuthenticationRoute,
  isPassportRoute,
  resolveRootRouteAction,
  usesAnalystCustodyCollection,
} from './authenticated-route-policy';

describe('Feature 005 authenticated route policy', () => {
  it('lands an Administrator on the existing dashboard after login or session restoration', () => {
    const access = { classification: 'product' as const, capabilities: ['registration.review.list'] };
    expect(authenticatedEntry(access)).toBe('/(admin)/admin');
    expect(resolveRootRouteAction('authenticated', '/login', access)).toEqual({ type: 'replace', href: '/(admin)/admin' });
    expect(resolveRootRouteAction('authenticated', '/', access)).toEqual({ type: 'replace', href: '/(admin)/admin' });
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

  it('keeps every Feature 007 Administrator destination only with its backend-projected capability', () => {
    const administratorAccess = {
      classification: 'product' as const,
      capabilities: ['registration.review.list', 'registration.dossier.list', 'registration.dossier.view', 'passport.custody.list', 'passport.custody.view'],
    };
    for (const pathname of ['/admin', '/admin/registration', '/admin/dossiers', '/admin/dossiers/dossier-1', '/admin/custody', '/admin/custody/passport-1']) {
      expect(resolveRootRouteAction('authenticated', pathname, administratorAccess)).toEqual({ type: 'none' });
    }
    expect(resolveRootRouteAction('authenticated', '/admin/dossiers', {
      classification: 'product', capabilities: ['registration.review.list'],
    })).toEqual({ type: 'replace', href: '/(admin)/admin' });
    expect(resolveRootRouteAction('authenticated', '/admin/custody', {
      classification: 'product', capabilities: ['registration.review.list'],
    })).toEqual({ type: 'replace', href: '/(admin)/admin' });
  });

  it('selects Analyst custody from backend capabilities and never from visible role text', () => {
    expect(usesAnalystCustodyCollection({ classification: 'product', capabilities: ['passport.review'] })).toBe(true);
    expect(usesAnalystCustodyCollection({ classification: 'product', capabilities: [], role: 'ANALYST' } as never)).toBe(false);
  });
});
