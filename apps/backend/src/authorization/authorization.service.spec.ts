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
  it('keeps legacy role governance intact while limiting USER to explicit particular passport permissions', () => {
    const subject = (role: 'ADMINISTRATOR' | 'ANALYST' | 'USER' | 'TUTOR' | 'ACADEMY_USER') => ({
      kind: 'authenticated' as const,
      identityId: id,
      status: 'ACTIVE' as const,
      roles: [{ role, active: true }],
    });

    expect(service.evaluate(request({ subject: subject('ADMINISTRATOR') })).allowed).toBe(true);
    expect(service.evaluate(request({ subject: subject('ANALYST') })).allowed).toBe(true);
    expect(service.evaluate(request({ subject: subject('USER') })).allowed).toBe(false);
    expect(service.evaluate(request({
      permission: 'foundation.privileged.role-change',
      subject: subject('ADMINISTRATOR'),
    })).allowed).toBe(true);
    expect(service.evaluate(request({
      permission: 'foundation.privileged.role-change',
      subject: subject('USER'),
    })).allowed).toBe(false);

    expect(service.evaluate(request({
      permission: 'passport.particular.create',
      subject: subject('USER'),
    })).allowed).toBe(true);
    expect(service.evaluate(request({
      permission: 'passport.particular.create',
      subject: subject('TUTOR'),
    })).allowed).toBe(false);
    expect(service.evaluate(request({
      permission: 'passport.review',
      resource: { classification: 'protected', analystCustodyActive: false },
      subject: subject('USER'),
    })).allowed).toBe(false);
    expect(service.evaluate(request({
      permission: 'passport.activate',
      subject: subject('USER'),
    })).allowed).toBe(false);
    expect(service.evaluate(request({
      permission: 'passport.academy.manage',
      resource: { classification: 'protected', academyId: 'academy' },
      subject: subject('USER'),
    })).allowed).toBe(false);
    expect(service.evaluate(request({
      permission: 'passport.academy.manage',
      resource: { classification: 'protected', academyId: 'academy' },
      subject: {
        ...subject('ACADEMY_USER'),
        academyMembership: { active: true, academyId: 'academy' },
      },
    })).allowed).toBe(true);
  });
  it('allows anonymous only with explicit public and minor authorization and denies malformed or unknown requests safely', () => {
    expect(service.evaluate({ version: '1', permission: 'foundation.public.read', resource: { classification: 'public', publicAuthorized: true, minorPublicAuthorized: true }, subject: { kind: 'anonymous' } })).toEqual({ allowed: true, policyVersion: '1' });
    expect(service.evaluate({ version: '1', permission: 'foundation.public.read', resource: { classification: 'protected', publicAuthorized: true }, subject: { kind: 'anonymous' } }).allowed).toBe(false);
    expect(service.evaluate({ ...request(), permission: 'unknown' }).allowed).toBe(false);
    expect(service.evaluate({} as AuthorizationRequest)).toEqual({ allowed: false, reason: 'invalid-context', policyVersion: '1' });
  });

  it('projects pending applicants only onto their own current request facts', () => {
    const pending = {
      kind: 'authenticated' as const,
      identityId: id,
      status: 'PENDING_ONBOARDING' as const,
      roles: [],
      pendingAccess: { active: true, requestId: 'request-1' },
    };
    const own = {
      classification: 'protected' as const,
      resourceId: 'request-1',
      requestOwner: true,
      requestStatus: 'DRAFT' as const,
      requestVersionCurrent: true,
    };

    expect(service.evaluate(request({ permission: 'registration.request.own.view', resource: own, subject: pending })).allowed).toBe(true);
    expect(service.evaluate(request({ permission: 'registration.request.own.edit-draft', resource: own, subject: pending })).allowed).toBe(true);
    expect(service.evaluate(request({ permission: 'registration.request.own.view', resource: { ...own, resourceId: 'request-2' }, subject: pending }))).toEqual({ allowed: false, reason: 'insufficient-resource-facts', policyVersion: '1' });
    expect(service.evaluate(request({ permission: 'passport.particular.create', subject: pending }))).toEqual({ allowed: false, reason: 'pending-access-restriction', policyVersion: '1' });
    expect(service.evaluate(request({ permission: 'registration.review.view', resource: own, subject: pending })).allowed).toBe(false);
  });

  it('requires academy resource facts and responsible authority instead of a role label alone', () => {
    const academySubject = {
      kind: 'authenticated' as const,
      identityId: id,
      status: 'ACTIVE' as const,
      roles: [{ role: 'ACADEMY_USER' as const, active: true }],
      academyMembership: { active: true, academyId: 'academy-1' },
    };
    const academyFacts = {
      classification: 'protected' as const,
      academyId: 'academy-1',
      academyContextMatches: true,
      academyApproved: true,
      academyMembershipActive: true,
    };

    expect(service.evaluate(request({ permission: 'registration.request.academy.create-adult-player', resource: academyFacts, subject: academySubject })).allowed).toBe(true);
    expect(service.evaluate(request({ permission: 'registration.request.academy.create-additional-account', resource: academyFacts, subject: academySubject })).allowed).toBe(false);
    expect(service.evaluate(request({ permission: 'registration.request.academy.create-additional-account', resource: { ...academyFacts, academyResponsibleAuthority: true }, subject: academySubject })).allowed).toBe(true);
    expect(service.evaluate(request({ permission: 'registration.request.academy.view', resource: { ...academyFacts, academyContextMatches: false }, subject: academySubject })).allowed).toBe(false);
    const academyOwnedDraft = { ...academyFacts, resourceId: 'request-1', requestOwner: true, requestStatus: 'DRAFT' as const, requestVersionCurrent: true };
    expect(service.evaluate(request({ permission: 'registration.request.own.view', resource: academyOwnedDraft, subject: academySubject })).allowed).toBe(true);
    expect(service.evaluate(request({ permission: 'registration.request.own.upload-evidence', resource: academyOwnedDraft, subject: academySubject })).allowed).toBe(true);
    expect(service.evaluate(request({ permission: 'registration.request.own.view', resource: { ...academyOwnedDraft, academyContextMatches: false }, subject: academySubject })).allowed).toBe(false);
  });

  it('requires an explicit Administrator capability and denies Analysts private registration operations', () => {
    const admin = { kind: 'authenticated' as const, identityId: id, status: 'ACTIVE' as const, roles: [{ role: 'ADMINISTRATOR' as const, active: true }] };
    const analyst = { kind: 'authenticated' as const, identityId: id, status: 'ACTIVE' as const, roles: [{ role: 'ANALYST' as const, active: true }] };
    const submitted = { classification: 'protected' as const, requestStatus: 'SUBMITTED' as const, requestVersionCurrent: true };

    expect(service.evaluate(request({ permission: 'registration.review.view', resource: submitted, subject: admin })).allowed).toBe(false);
    expect(service.evaluate(request({ permission: 'registration.review.view', resource: { ...submitted, administratorCapability: true }, subject: admin })).allowed).toBe(true);
    expect(service.evaluate(request({ permission: 'registration.review.view-evidence', resource: { ...submitted, administratorCapability: true, evidenceCompleteAndClean: true }, subject: analyst })).allowed).toBe(false);
    expect(service.evaluate(request({ permission: 'registration.review.approve', resource: { ...submitted, administratorCapability: true, manualDossierConfirmed: true, deletionState: 'COMPLETED', duplicateConflictAbsent: true, ageRouteCompatible: true, representationComplete: true }, subject: admin })).allowed).toBe(true);
  });

  it('covers every approved Feature 006 capability with its required facts', () => {
    const publicPermissions = [
      'registration.request.create.personal-adult',
      'registration.request.create.represented-minor',
      'registration.request.create.formal-academy',
      'registration.request.create.natural-person-academy',
    ] as const;
    for (const permission of publicPermissions) expect(service.evaluate({ version: '1', permission, resource: { classification: 'public', supportedRegistrationType: true }, subject: { kind: 'anonymous' } }).allowed).toBe(true);

    const pending = { kind: 'authenticated' as const, identityId: id, status: 'PENDING_ONBOARDING' as const, roles: [], pendingAccess: { active: true, requestId: 'request-1' } };
    const ownBase = { classification: 'protected' as const, resourceId: 'request-1', requestOwner: true, requestVersionCurrent: true };
    const ownCases = [
      ['registration.request.own.view', { ...ownBase, requestStatus: 'SUBMITTED' as const }],
      ['registration.request.own.edit-draft', { ...ownBase, requestStatus: 'DRAFT' as const }],
      ['registration.request.own.submit', { ...ownBase, requestStatus: 'DRAFT' as const, evidenceCompleteAndClean: true, ageRouteCompatible: true, representationComplete: true }],
      ['registration.request.own.correct', { ...ownBase, requestStatus: 'REQUIRES_CORRECTION' as const }],
      ['registration.request.own.resubmit', { ...ownBase, requestStatus: 'REQUIRES_CORRECTION' as const, evidenceCompleteAndClean: true, ageRouteCompatible: true, representationComplete: true }],
      ['registration.request.own.upload-evidence', { ...ownBase, requestStatus: 'DRAFT' as const }],
      ['registration.request.own.view-deletion-status', { ...ownBase, requestStatus: 'SUBMITTED' as const }],
    ] as const;
    for (const [permission, resource] of ownCases) expect(service.evaluate(request({ permission, resource, subject: pending })).allowed).toBe(true);

    const academySubject = { kind: 'authenticated' as const, identityId: id, status: 'ACTIVE' as const, roles: [{ role: 'ACADEMY_USER' as const, active: true }], academyMembership: { active: true, academyId: 'academy-1' } };
    const academyFacts = { classification: 'protected' as const, academyId: 'academy-1', academyContextMatches: true, academyApproved: true, academyMembershipActive: true, academyResponsibleAuthority: true };
    for (const permission of ['registration.request.academy.list', 'registration.request.academy.view', 'registration.request.academy.create-additional-account', 'registration.request.academy.create-adult-player', 'registration.request.academy.create-minor-player'] as const) expect(service.evaluate(request({ permission, resource: academyFacts, subject: academySubject })).allowed).toBe(true);

    const admin = { kind: 'authenticated' as const, identityId: id, status: 'ACTIVE' as const, roles: [{ role: 'ADMINISTRATOR' as const, active: true }] };
    const adminBase = { classification: 'protected' as const, administratorCapability: true };
    const adminCases = [
      ['registration.review.list', adminBase],
      ['registration.review.view', adminBase],
      ['registration.review.view-evidence', { ...adminBase, requestStatus: 'SUBMITTED' as const, requestVersionCurrent: true, evidenceCompleteAndClean: true }],
      ['registration.review.request-correction', { ...adminBase, requestStatus: 'SUBMITTED' as const, requestVersionCurrent: true }],
      ['registration.review.confirm-dossier', { ...adminBase, requestStatus: 'SUBMITTED' as const, requestVersionCurrent: true, evidenceCompleteAndClean: true, duplicateConflictAbsent: true }],
      ['registration.review.approve', { ...adminBase, requestStatus: 'SUBMITTED' as const, requestVersionCurrent: true, manualDossierConfirmed: true, deletionState: 'COMPLETED' as const, duplicateConflictAbsent: true, ageRouteCompatible: true, representationComplete: true }],
      ['registration.review.reject', { ...adminBase, requestStatus: 'SUBMITTED' as const, requestVersionCurrent: true }],
      ['registration.review.view-deletion-status', adminBase],
      ['registration.review.retry-deletion', { ...adminBase, deletionState: 'RECOVERY_REQUIRED' as const }],
    ] as const;
    for (const [permission, resource] of adminCases) expect(service.evaluate(request({ permission, resource, subject: admin })).allowed).toBe(true);
  });
});
