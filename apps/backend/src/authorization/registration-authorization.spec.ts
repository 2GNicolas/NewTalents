import { describe, expect, it } from 'vitest';

import { AUTHORIZATION_CONTRACT_VERSION } from './authorization.contract.js';
import { AuthorizationService } from './authorization.service.js';
import { permissionCatalog } from './permission-catalog.js';

const registrationPermissions = [
  'registration.request.create.personal-adult',
  'registration.request.create.represented-minor',
  'registration.request.create.formal-academy',
  'registration.request.create.natural-person-academy',
  'registration.request.own.view',
  'registration.request.own.edit-draft',
  'registration.request.own.submit',
  'registration.request.own.correct',
  'registration.request.own.resubmit',
  'registration.request.own.upload-evidence',
  'registration.request.own.view-deletion-status',
  'registration.request.academy.list',
  'registration.request.academy.view',
  'registration.request.academy.create-additional-account',
  'registration.request.academy.create-adult-player',
  'registration.request.academy.create-minor-player',
  'registration.review.list',
  'registration.review.view',
  'registration.review.view-evidence',
  'registration.review.request-correction',
  'registration.review.confirm-dossier',
  'registration.review.approve',
  'registration.review.reject',
  'registration.review.view-deletion-status',
  'registration.review.retry-deletion',
] as const;

describe('Feature 006 registration authorization catalog', () => {
  const service = new AuthorizationService();

  it('contains exactly every approved registration capability', () => {
    expect(Object.keys(permissionCatalog).filter((permission) => permission.startsWith('registration.')).sort()).toEqual([...registrationPermissions].sort());
  });

  it('denies by default when ownership, current version, academy membership, evidence, age, representation, dossier, deletion, or explicit Administrator facts are absent', () => {
    const pending = { kind: 'authenticated' as const, identityId: '11111111-1111-4111-8111-111111111111', status: 'PENDING_ONBOARDING' as const, roles: [], pendingAccess: { active: true, requestId: 'request-1' } };
    const admin = { kind: 'authenticated' as const, identityId: '11111111-1111-4111-8111-111111111111', status: 'ACTIVE' as const, roles: [{ role: 'ADMINISTRATOR' as const, active: true }] };

    expect(service.evaluate({ version: AUTHORIZATION_CONTRACT_VERSION, permission: 'registration.request.own.submit', resource: { classification: 'protected', resourceId: 'request-1', requestOwner: true, requestStatus: 'DRAFT' }, subject: pending }).allowed).toBe(false);
    expect(service.evaluate({ version: AUTHORIZATION_CONTRACT_VERSION, permission: 'registration.request.academy.create-adult-player', resource: { classification: 'protected', academyId: 'academy-1' }, subject: { ...admin, roles: [{ role: 'ACADEMY_USER', active: true }] } }).allowed).toBe(false);
    expect(service.evaluate({ version: AUTHORIZATION_CONTRACT_VERSION, permission: 'registration.review.approve', resource: { classification: 'protected', requestStatus: 'SUBMITTED', requestVersionCurrent: true }, subject: admin }).allowed).toBe(false);
  });
});
