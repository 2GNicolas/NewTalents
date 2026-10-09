import { describe, expect, it } from 'vitest';
import { AuthorizationService } from './authorization.service.js';
import type { AuthorizationRequest } from './authorization.contract.js';

const id = '11111111-1111-4111-8111-111111111111';
const request = (overrides: Partial<AuthorizationRequest> = {}): AuthorizationRequest => ({ version: '1', permission: 'foundation.internal.evaluate', resource: { classification: 'protected' }, subject: { kind: 'authenticated', identityId: id, status: 'ACTIVE', roles: [{ role: 'ANALYST', active: true }] }, ...overrides });
describe('AuthorizationService', () => {
  const service = new AuthorizationService();
  it('allows only active applicable roles and denies inactive, unknown, revoked, and unrelated roles', () => {
    expect(service.evaluate(request())).toEqual({ allowed: true, policyVersion: '1' });
    expect(service.evaluate(request({ subject: { kind: 'authenticated', identityId: id, status: 'INACTIVE', roles: [{ role: 'ANALYST', active: true }] } })).allowed).toBe(false);
    expect(service.evaluate(request({ subject: { kind: 'authenticated', identityId: id, status: 'ACTIVE', roles: [{ role: 'TUTOR', active: true }, { role: 'ANALYST', active: false }] } })).allowed).toBe(false);
  });
  it('enforces academy and tutor facts without treating a minor as an account role', () => {
    expect(service.evaluate(request({ permission: 'foundation.academy.scoped-resource', resource: { classification: 'protected', academyId: 'a' }, subject: { kind: 'authenticated', identityId: id, status: 'ACTIVE', roles: [{ role: 'ACADEMY_USER', active: true }], academyMembership: { active: true, academyId: 'a' } } })).allowed).toBe(true);
    expect(service.evaluate(request({ permission: 'foundation.academy.scoped-resource', resource: { classification: 'protected', academyId: 'a' }, subject: { kind: 'authenticated', identityId: id, status: 'ACTIVE', roles: [{ role: 'ACADEMY_USER', active: true }], academyMembership: { active: false, academyId: 'a' } } })).allowed).toBe(false);
    expect(service.evaluate(request({ permission: 'foundation.tutor.related-resource', resource: { classification: 'protected', resourceId: 'r' }, subject: { kind: 'authenticated', identityId: id, status: 'ACTIVE', roles: [{ role: 'TUTOR', active: true }], tutorRelationship: { active: true, resourceId: 'r' } } })).allowed).toBe(true);
    expect(service.evaluate(request({ permission: 'foundation.tutor.related-resource', resource: { classification: 'protected', resourceId: 'r' }, subject: { kind: 'authenticated', identityId: id, status: 'ACTIVE', roles: [{ role: 'TUTOR', active: true }] } })).allowed).toBe(false);
  });
  it('allows anonymous only with explicit public and minor authorization and denies malformed or unknown requests safely', () => {
    expect(service.evaluate({ version: '1', permission: 'foundation.public.read', resource: { classification: 'public', publicAuthorized: true, minorPublicAuthorized: true }, subject: { kind: 'anonymous' } })).toEqual({ allowed: true, policyVersion: '1' });
    expect(service.evaluate({ version: '1', permission: 'foundation.public.read', resource: { classification: 'protected', publicAuthorized: true }, subject: { kind: 'anonymous' } }).allowed).toBe(false);
    expect(service.evaluate({ ...request(), permission: 'unknown' }).allowed).toBe(false);
    expect(service.evaluate({} as AuthorizationRequest)).toEqual({ allowed: false, reason: 'invalid-context', policyVersion: '1' });
  });
});
