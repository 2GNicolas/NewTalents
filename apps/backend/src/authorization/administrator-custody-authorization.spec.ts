import { describe, expect, it } from 'vitest';

import { projectSessionAccess } from '../authentication/session-access.projection.js';
import type { AuthorizationRequest, ResourceFacts } from './authorization.contract.js';
import { AuthorizationService } from './authorization.service.js';
import { permissionCatalog } from './permission-catalog.js';

const identityId = '11111111-1111-4111-8111-111111111111';
const activeAdministrator = {
  kind: 'authenticated' as const,
  identityId,
  status: 'ACTIVE' as const,
  roles: [{ role: 'ADMINISTRATOR' as const, active: true }],
};
const activeAnalyst = {
  kind: 'authenticated' as const,
  identityId,
  status: 'ACTIVE' as const,
  roles: [{ role: 'ANALYST' as const, active: true }],
};

const authorizationRequest = (
  permission: string,
  resource: ResourceFacts,
  subject: AuthorizationRequest['subject'] = activeAdministrator,
): AuthorizationRequest => ({ version: '1', permission, resource, subject });

describe('Feature 007 Administrator and custody authorization', () => {
  const authorization = new AuthorizationService();

  it('registers only the approved Feature 007 capabilities', () => {
    expect(Object.keys(permissionCatalog)).toEqual(expect.arrayContaining([
      'registration.review.progress',
      'registration.dossier.list',
      'registration.dossier.view',
      'passport.custody.list',
      'passport.custody.view',
      'passport.custody.list-analysts',
      'passport.custody.assign',
      'passport.custody.change',
      'passport.custody.remove',
    ]));
  });

  it('requires current active Administrator authority and the facts for each resource operation', () => {
    const adminFacts = { classification: 'protected' as const, administratorCapability: true };
    const cases = [
      ['registration.review.progress', { ...adminFacts, requestVersionCurrent: true }],
      ['registration.dossier.list', adminFacts],
      ['registration.dossier.view', { ...adminFacts, dossierConfirmed: true }],
      ['passport.custody.list', adminFacts],
      ['passport.custody.view', { ...adminFacts, passportBasicActive: true }],
      ['passport.custody.list-analysts', adminFacts],
      ['passport.custody.assign', { ...adminFacts, passportBasicActive: true, custodyVersionCurrent: true, custodyAssigned: false, targetAnalystEligible: true }],
      ['passport.custody.change', { ...adminFacts, passportBasicActive: true, custodyVersionCurrent: true, custodyAssigned: true, targetAnalystEligible: true }],
      ['passport.custody.remove', { ...adminFacts, passportBasicActive: true, custodyVersionCurrent: true, custodyAssigned: true }],
    ] as const;

    for (const [permission, resource] of cases) {
      expect(authorization.evaluate(authorizationRequest(permission, resource))).toEqual({ allowed: true, policyVersion: '1' });
      expect(authorization.evaluate(authorizationRequest(permission, { classification: 'protected' }))).toEqual({
        allowed: false,
        reason: 'insufficient-resource-facts',
        policyVersion: '1',
      });
    }

    expect(authorization.evaluate(authorizationRequest('passport.custody.list', adminFacts, {
      ...activeAdministrator,
      status: 'INACTIVE',
    }))).toEqual({ allowed: false, reason: 'inactive-identity', policyVersion: '1' });
    expect(authorization.evaluate(authorizationRequest('passport.custody.list', adminFacts, {
      ...activeAdministrator,
      roles: [{ role: 'ADMINISTRATOR', active: false }],
    }))).toEqual({ allowed: false, reason: 'no-active-role', policyVersion: '1' });
  });

  it('fails closed for stale custody, ineligible Analysts, unconfirmed dossiers, and role labels without active facts', () => {
    const base = { classification: 'protected' as const, administratorCapability: true };
    for (const resource of [
      { ...base, passportBasicActive: true, custodyVersionCurrent: false, custodyAssigned: false, targetAnalystEligible: true },
      { ...base, passportBasicActive: true, custodyVersionCurrent: true, custodyAssigned: false, targetAnalystEligible: false },
    ]) {
      expect(authorization.evaluate(authorizationRequest('passport.custody.assign', resource))).toEqual({
        allowed: false,
        reason: 'insufficient-resource-facts',
        policyVersion: '1',
      });
    }
    expect(authorization.evaluate(authorizationRequest('registration.dossier.view', base))).toEqual({
      allowed: false,
      reason: 'insufficient-resource-facts',
      policyVersion: '1',
    });
    expect(authorization.evaluate({
      ...authorizationRequest('passport.custody.list', base, { kind: 'authenticated', identityId, status: 'ACTIVE', roles: [] }),
      visibleRole: 'ADMINISTRATOR',
    })).toEqual({ allowed: false, reason: 'no-active-role', policyVersion: '1' });
  });

  it('requires an active Analyst role and current custody for passport review', () => {
    expect(authorization.evaluate(authorizationRequest('passport.review', {
      classification: 'protected',
      analystCustodyActive: true,
    }, activeAnalyst))).toEqual({ allowed: true, policyVersion: '1' });
    expect(authorization.evaluate(authorizationRequest('passport.review', {
      classification: 'protected',
      analystCustodyActive: false,
    }, activeAnalyst))).toEqual({ allowed: false, reason: 'insufficient-resource-facts', policyVersion: '1' });
    expect(authorization.evaluate(authorizationRequest('passport.review', {
      classification: 'protected',
      analystCustodyActive: true,
    }, { ...activeAnalyst, roles: [{ role: 'ANALYST', active: false }] }))).toEqual({
      allowed: false,
      reason: 'no-active-role',
      policyVersion: '1',
    });
  });

  it('projects Feature 007 capabilities only from active role assignments', () => {
    const active = projectSessionAccess({ roleAssignments: [{ role: 'ADMINISTRATOR', status: 'ACTIVE' }] });
    expect(active.capabilities).toEqual(expect.arrayContaining([
      'registration.review.progress',
      'registration.dossier.list',
      'registration.dossier.view',
      'passport.custody.list',
      'passport.custody.view',
      'passport.custody.list-analysts',
      'passport.custody.assign',
      'passport.custody.change',
      'passport.custody.remove',
    ]));

    const revoked = projectSessionAccess({ roleAssignments: [{ role: 'ADMINISTRATOR', status: 'REVOKED' }] });
    expect(revoked.capabilities).toEqual([]);
  });
});
