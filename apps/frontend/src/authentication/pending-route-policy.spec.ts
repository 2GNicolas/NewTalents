import { resolveRootRouteAction } from './authenticated-route-policy';
import type { SessionAccessProjection } from './authentication-types';

const pending: SessionAccessProjection = {
  classification: 'pending-onboarding',
  requestId: '22222222-2222-4222-8222-222222222222',
  capabilities: ['registration.request.own.view'],
};

describe('pending applicant route policy', () => {
  it('restores a pending session only to its own request boundary', () => {
    expect(resolveRootRouteAction('authenticated', '/', pending)).toEqual({ type: 'replace', href: '/(pending)/registration/22222222-2222-4222-8222-222222222222' });
    expect(resolveRootRouteAction('authenticated', '/registration/22222222-2222-4222-8222-222222222222', pending)).toEqual({ type: 'none' });
  });

  it.each(['/passports', '/academy', '/analysis', '/admin'])('denies pending product route %s without reading JWT roles', (pathname) => {
    expect(resolveRootRouteAction('authenticated', pathname, pending)).toEqual({ type: 'replace', href: '/(pending)/registration/22222222-2222-4222-8222-222222222222' });
  });

  it('uses refreshed backend capabilities after approval', () => {
    const approved: SessionAccessProjection = { classification: 'product', capabilities: ['passport.particular.manage'] };
    expect(resolveRootRouteAction('authenticated', '/registration/22222222-2222-4222-8222-222222222222', approved)).toEqual({ type: 'replace', href: '/(authenticated)/passports' });
  });

  it('fails closed when a pending projection lacks own-view capability or a request id', () => {
    expect(resolveRootRouteAction('authenticated', '/passports', { classification: 'pending-onboarding', capabilities: [] })).toEqual({ type: 'replace', href: '/(auth)/login' });
  });
});
