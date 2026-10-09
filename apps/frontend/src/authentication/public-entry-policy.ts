import { AUTHENTICATED_PRODUCT_ENTRY } from './authenticated-destination';
import type { SessionAccessProjection } from './authentication-types';

export const PUBLIC_REGISTRATION_CTA = 'Crear solicitud de registro' as const;

const PUBLIC_REGISTRATION_FORM_ROUTES = [
  '/registration/personal-adult',
  '/registration/represented-minor',
  '/registration/academy-formal',
  '/registration/academy-natural-person',
  '/registration/status-preview',
] as const;

export function isPublicRegistrationRoute(pathname: string): boolean {
  return pathname === '/registration' || PUBLIC_REGISTRATION_FORM_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function resolvePublicEntryDestination(access: SessionAccessProjection | null): string {
  if (!access) return '/(public)/registration';
  if (access.classification === 'product') return AUTHENTICATED_PRODUCT_ENTRY;
  if (!access.requestId || !access.capabilities.includes('registration.request.own.view')) return '/(auth)/login';
  return `/(pending)/registration/${access.requestId}`;
}
