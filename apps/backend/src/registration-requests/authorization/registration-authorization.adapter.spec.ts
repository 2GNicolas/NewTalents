import { describe, expect, it, vi } from 'vitest';

import { RegistrationAuthorizationAdapter } from './registration-authorization.adapter.js';

const identityId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const academyId = '33333333-3333-4333-8333-333333333333';

describe('RegistrationAuthorizationAdapter', () => {
  it('projects pending ownership from persisted facts and safely hides absent or unrelated requests', async () => {
    const prisma = {
      identity: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', roleAssignments: [], registrationApplicantAccesses: [{ requestId, status: 'PENDING_ONBOARDING' }] }) },
      registrationRequest: { findUnique: vi.fn().mockResolvedValue({ id: requestId, ownerIdentityId: identityId, academyContextId: null, type: 'PERSONAL_ADULT', status: 'DRAFT', version: 2 }) },
      academyMembership: { findFirst: vi.fn() },
    };
    const adapter = new RegistrationAuthorizationAdapter(prisma as never);

    await expect(adapter.authorize({ identityId, permission: 'registration.request.own.edit-draft', requestId, expectedVersion: 2 })).resolves.toEqual({ allowed: true, policyVersion: '1' });

    prisma.registrationRequest.findUnique.mockResolvedValueOnce(null);
    await expect(adapter.authorize({ identityId, permission: 'registration.request.own.view', requestId })).resolves.toEqual({ allowed: false, reason: 'insufficient-resource-facts', policyVersion: '1' });
    prisma.registrationRequest.findUnique.mockResolvedValueOnce({ id: requestId, ownerIdentityId: '44444444-4444-4444-8444-444444444444', academyContextId: null, type: 'PERSONAL_ADULT', status: 'DRAFT', version: 2 });
    await expect(adapter.authorize({ identityId, permission: 'registration.request.own.view', requestId })).resolves.toEqual({ allowed: false, reason: 'insufficient-resource-facts', policyVersion: '1' });
  });

  it('derives academy context from an active membership and re-evaluates it for every operation', async () => {
    const membership = vi.fn().mockResolvedValueOnce({ academyId, status: 'ACTIVE' }).mockResolvedValueOnce(null);
    const prisma = {
      identity: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', roleAssignments: [{ role: 'ACADEMY_USER' }], registrationApplicantAccesses: [] }) },
      registrationRequest: { findUnique: vi.fn() },
      academyMembership: { findFirst: membership },
      academy: { findUnique: vi.fn().mockResolvedValue({ id: academyId }) },
    };
    const adapter = new RegistrationAuthorizationAdapter(prisma as never);

    await expect(adapter.authorize({ identityId, permission: 'registration.request.academy.create-adult-player', academyId })).resolves.toMatchObject({ allowed: true });
    await expect(adapter.authorize({ identityId, permission: 'registration.request.academy.create-adult-player', academyId })).resolves.toEqual({ allowed: false, reason: 'inactive-academy-membership', policyVersion: '1' });
    expect(membership).toHaveBeenCalledTimes(2);
  });

  it('authorizes lifecycle access for an academy-owned request only in the active matching academy', async () => {
    const prisma = {
      identity: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', roleAssignments: [{ role: 'ACADEMY_USER' }], registrationApplicantAccesses: [] }) },
      registrationRequest: { findUnique: vi.fn().mockResolvedValue({ id: requestId, ownerIdentityId: identityId, academyContextId: academyId, type: 'ADDITIONAL_ACADEMY_ACCOUNT', status: 'DRAFT', version: 0 }) },
      academyMembership: { findFirst: vi.fn().mockResolvedValue({ academyId, status: 'ACTIVE' }) },
      academy: { findUnique: vi.fn().mockResolvedValue({ id: academyId }) },
    };
    const adapter = new RegistrationAuthorizationAdapter(prisma as never);

    await expect(adapter.authorize({ identityId, permission: 'registration.request.own.upload-evidence', requestId, expectedVersion: 0 })).resolves.toMatchObject({ allowed: true });
    expect(prisma.academyMembership.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ academyId }) }));
  });

  it('requires explicit Administrator permission and never gives an Analyst review or evidence access', async () => {
    const prisma = {
      identity: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', roleAssignments: [{ role: 'ANALYST' }], registrationApplicantAccesses: [] }) },
      registrationRequest: { findUnique: vi.fn().mockResolvedValue({ id: requestId, ownerIdentityId: identityId, academyContextId: null, type: 'PERSONAL_ADULT', status: 'SUBMITTED', version: 1 }) },
      academyMembership: { findFirst: vi.fn() },
    };
    const adapter = new RegistrationAuthorizationAdapter(prisma as never);
    await expect(adapter.authorize({ identityId, permission: 'registration.review.view-evidence', requestId, expectedVersion: 1, evidenceCompleteAndClean: true })).resolves.toEqual({ allowed: false, reason: 'no-active-role', policyVersion: '1' });

    prisma.identity.findUnique.mockResolvedValueOnce({ status: 'ACTIVE', roleAssignments: [{ role: 'ADMINISTRATOR' }], registrationApplicantAccesses: [] });
    await expect(adapter.authorize({ identityId, permission: 'registration.review.view-evidence', requestId, expectedVersion: 1, evidenceCompleteAndClean: true })).resolves.toMatchObject({ allowed: true });
  });
});
