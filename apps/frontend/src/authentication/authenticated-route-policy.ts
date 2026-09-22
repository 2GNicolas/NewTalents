import { useEffect } from 'react';

import { AUTHENTICATED_PRODUCT_ENTRY } from './authenticated-destination';
import type { AuthenticationState } from './authentication-state';

const AUTH_ROUTES = ['/login', '/activate-initial-access'] as const;
const PASSPORT_ROUTE_PREFIX = '/passports';

export type RootRouteAction =
  | Readonly<{ type: 'none' }>
  | Readonly<{ type: 'replace'; href: string }>;

export function isAuthenticationRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isPassportRoute(pathname: string): boolean {
  return pathname === PASSPORT_ROUTE_PREFIX || pathname.startsWith(`${PASSPORT_ROUTE_PREFIX}/`);
}

export function resolveRootRouteAction(phase: AuthenticationState['phase'], pathname: string): RootRouteAction {
  if (phase === 'authenticated' && !isPassportRoute(pathname)) {
    return { type: 'replace', href: AUTHENTICATED_PRODUCT_ENTRY };
  }
  if (phase === 'activation-success' && !isAuthenticationRoute(pathname)) {
    return { type: 'replace', href: '/(auth)/activate-initial-access' };
  }
  if ((phase === 'unauthenticated' || phase === 'session-expired') && !isAuthenticationRoute(pathname)) {
    return { type: 'replace', href: '/(auth)/login' };
  }
  return { type: 'none' };
}

export function useAuthenticatedRouteSync(
  state: AuthenticationState,
  pathname: string,
  replace: (href: string) => void,
): void {
  useEffect(() => {
    const action = resolveRootRouteAction(state.phase, pathname);
    if (action.type === 'replace') replace(action.href);
  }, [pathname, replace, state.phase]);
}