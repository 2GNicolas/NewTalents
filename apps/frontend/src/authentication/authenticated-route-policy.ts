import { useEffect } from 'react';

import { AUTHENTICATED_PRODUCT_ENTRY } from './authenticated-destination';
import { isPublicRegistrationRoute } from './public-entry-policy';
import type { AuthenticationState } from './authentication-state';
import type { SessionAccessProjection } from './authentication-types';

const AUTH_ROUTES = ['/login', '/activate-initial-access'] as const;
const PASSPORT_ROUTE_PREFIX = '/passports';
const ACADEMY_REGISTRATION_ROUTE = '/registration';
const ADMIN_REGISTRATION_ROUTE = '/admin/registration';
const ADMIN_ROUTE = '/admin';

function requiredAdministratorCapability(pathname: string): string | undefined {
  if (pathname === ADMIN_ROUTE) return 'registration.review.list';
  if (pathname === ADMIN_REGISTRATION_ROUTE || pathname.startsWith(`${ADMIN_REGISTRATION_ROUTE}/`)) return 'registration.review.list';
  if (pathname === '/admin/dossiers') return 'registration.dossier.list';
  if (pathname.startsWith('/admin/dossiers/')) return 'registration.dossier.view';
  if (pathname === '/admin/custody') return 'passport.custody.list';
  if (pathname.startsWith('/admin/custody/')) return 'passport.custody.view';
  return undefined;
}

export function authenticatedEntry(access?: SessionAccessProjection | null): string {
  if (access?.classification === 'product' && access.capabilities.includes('registration.review.list')) return '/(admin)/admin';
  if (access?.classification === 'product' && access.capabilities.some((capability) => capability.startsWith('registration.request.academy.'))) return access.academyId ? `/(academy)/registration?academyId=${encodeURIComponent(access.academyId)}` : '/(academy)/registration';
  return AUTHENTICATED_PRODUCT_ENTRY;
}

export function usesAnalystCustodyCollection(access?: SessionAccessProjection | null): boolean {
  return access?.classification === 'product' && access.capabilities.includes('passport.review');
}

export type RootRouteAction =
  | Readonly<{ type: 'none' }>
  | Readonly<{ type: 'replace'; href: string }>;

export function isAuthenticationRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isPassportRoute(pathname: string): boolean {
  return pathname === PASSPORT_ROUTE_PREFIX || pathname.startsWith(`${PASSPORT_ROUTE_PREFIX}/`);
}

export function resolveRootRouteAction(phase: AuthenticationState['phase'], pathname: string, access?: SessionAccessProjection | null): RootRouteAction {
  if (phase === 'authenticated' && access?.classification === 'pending-onboarding') {
    if (!access.requestId || !access.capabilities.includes('registration.request.own.view')) return { type: 'replace', href: '/(auth)/login' };
    const destination = `/(pending)/registration/${access.requestId}`;
    const ownPath = `/registration/${access.requestId}`;
    return pathname === ownPath || pathname.startsWith(`${ownPath}/`) ? { type: 'none' } : { type: 'replace', href: destination };
  }
  if (phase === 'authenticated' && access?.classification === 'product' && (pathname === ACADEMY_REGISTRATION_ROUTE || pathname.startsWith(`${ACADEMY_REGISTRATION_ROUTE}/`))) {
    return access.capabilities.some((capability) => capability.startsWith('registration.request.academy.')) ? { type: 'none' } : { type: 'replace', href: AUTHENTICATED_PRODUCT_ENTRY };
  }
  if (phase === 'authenticated' && access?.classification === 'product' && (pathname === ADMIN_ROUTE || pathname.startsWith(`${ADMIN_ROUTE}/`))) {
    const requiredCapability = requiredAdministratorCapability(pathname);
    return requiredCapability && access.capabilities.includes(requiredCapability)
      ? { type: 'none' }
      : { type: 'replace', href: access.capabilities.includes('registration.review.list') ? '/(admin)/admin' : AUTHENTICATED_PRODUCT_ENTRY };
  }
  if (phase === 'authenticated' && access === null) return { type: 'none' };
  if (phase === 'authenticated' && !isPassportRoute(pathname)) {
    return { type: 'replace', href: authenticatedEntry(access) };
  }
  if (phase === 'activation-success' && !isAuthenticationRoute(pathname)) {
    return { type: 'replace', href: '/(auth)/activate-initial-access' };
  }
  if (phase === 'unauthenticated' && (pathname === '/' || isPublicRegistrationRoute(pathname))) return { type: 'none' };
  if ((phase === 'unauthenticated' || phase === 'session-expired') && !isAuthenticationRoute(pathname)) {
    return { type: 'replace', href: '/(auth)/login' };
  }
  return { type: 'none' };
}

export function useAuthenticatedRouteSync(
  state: AuthenticationState,
  pathname: string,
  replace: (href: string) => void,
  access?: SessionAccessProjection | null,
  disabled = false,
): void {
  useEffect(() => {
    if (disabled) return;
    const action = resolveRootRouteAction(state.phase, pathname, access);
    if (action.type === 'replace') replace(action.href);
  }, [access, disabled, pathname, replace, state.phase]);
}
