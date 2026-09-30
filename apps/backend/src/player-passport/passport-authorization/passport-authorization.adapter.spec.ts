import { describe, expect, it, vi } from 'vitest';

import { PassportAuthorizationAdapter } from './passport-authorization.adapter.js';
import { AuthorizationService } from '../../authorization/authorization.service.js';

const identityId = '11111111-1111-4111-8111-111111111111';
const passportId = '44444444-4444-4444-8444-444444444444';
const playerId = '33333333-3333-4333-8333-333333333333';
const academyId = '22222222-2222-4222-8222-222222222222';

describe('PassportAuthorizationAdapter', () => {
  it('loads identity status and active roles, the initial Tutor relationship, and resource facts before delegating', async () => {
    const prisma = {
      identity: {
        findUnique: vi.fn().mockResolvedValue({
          status: 'ACTIVE',
          roleAssignments: [{ role: 'TUTOR' }],
        }),
      },
      academyMembership: { findFirst: vi.fn() },
      playerPassport: {
        findUnique: vi.fn().mockResolvedValue({
          id: passportId,
          playerId,
          originKind: 'TUTOR',
          originAcademyId: null,
          createdByIdentityId: identityId,
          responsibilities: [],
        }),
      },
      initialTutorResponsibility: {
        findUnique: vi.fn().mockResolvedValue({ playerId, tutorIdentityId: identityId }),
      },
    };
    const authorization = { evaluate: vi.fn().mockReturnValue({ allowed: true, policyVersion: '1' }) };
    const adapter = new PassportAuthorizationAdapter(prisma as never, authorization as never);

    await expect(adapter.authorize({
      identityId,
      permission: 'passport.tutor.manage',
      passportId,
    })).resolves.toEqual({ allowed: true, policyVersion: '1' });

    expect(prisma.identity.findUnique).toHaveBeenCalledWith({
      where: { id: identityId },
      select: {
        status: true,
        roleAssignments: { where: { status: 'ACTIVE' }, select: { role: true } },
      },
    });
    expect(prisma.playerPassport.findUnique).toHaveBeenCalledWith({
      where: { id: passportId },
      select: {
        id: true,
        playerId: true,
        originKind: true,
        originAcademyId: true,
        createdByIdentityId: true,
        responsibilities: { select: { kind: true, academyId: true } },
      },
    });
    expect(prisma.initialTutorResponsibility.findUnique).toHaveBeenCalledWith({
      where: { playerId },
      select: { playerId: true, tutorIdentityId: true },
    });
    expect(prisma.academyMembership.findFirst).not.toHaveBeenCalled();
    expect(authorization.evaluate).toHaveBeenCalledWith({
      version: '1',
      permission: 'passport.tutor.manage',
      resource: { classification: 'protected', resourceId: playerId },
      subject: {
        kind: 'authenticated',
        identityId,
        status: 'ACTIVE',
        roles: [{ role: 'TUTOR', active: true }],
        tutorRelationship: { active: true, resourceId: playerId },
      },
    });
  });

  it('loads the active Academy membership and academy resource for an Academy manage decision', async () => {
    const prisma = {
      identity: {
        findUnique: vi.fn().mockResolvedValue({
          status: 'ACTIVE',
          roleAssignments: [{ role: 'ACADEMY_USER' }],
        }),
      },
      academyMembership: {
        findFirst: vi.fn().mockResolvedValue({ academyId, status: 'ACTIVE' }),
      },
      playerPassport: {
        findUnique: vi.fn().mockResolvedValue({
          id: passportId,
          playerId,
          originKind: 'ACADEMY',
          originAcademyId: academyId,
          createdByIdentityId: identityId,
          responsibilities: [{ kind: 'ACADEMY', academyId }],
        }),
      },
      initialTutorResponsibility: { findUnique: vi.fn() },
    };
    const authorization = { evaluate: vi.fn().mockReturnValue({ allowed: true, policyVersion: '1' }) };
    const adapter = new PassportAuthorizationAdapter(prisma as never, authorization as never);

    await expect(adapter.authorize({
      identityId,
      permission: 'passport.academy.manage',
      passportId,
    })).resolves.toEqual({ allowed: true, policyVersion: '1' });

    expect(prisma.academyMembership.findFirst).toHaveBeenCalledWith({
      where: { identityId, status: 'ACTIVE', identity: { status: 'ACTIVE' } },
      select: { academyId: true, status: true },
    });
    expect(authorization.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      permission: 'passport.academy.manage',
      resource: { classification: 'protected', academyId },
      subject: expect.objectContaining({
        academyMembership: { active: true, academyId },
      }),
    }));
  });

  it('derives the academy for create authorization from the active membership without reading a request body', async () => {
    const prisma = {
      identity: {
        findUnique: vi.fn().mockResolvedValue({
          status: 'ACTIVE',
          roleAssignments: [{ role: 'ACADEMY_USER' }],
        }),
      },
      academyMembership: {
        findFirst: vi.fn().mockResolvedValue({ academyId, status: 'ACTIVE' }),
      },
      playerPassport: { findUnique: vi.fn() },
      initialTutorResponsibility: { findUnique: vi.fn() },
    };
    const authorization = { evaluate: vi.fn().mockReturnValue({ allowed: true, policyVersion: '1' }) };
    const adapter = new PassportAuthorizationAdapter(prisma as never, authorization as never);

    await expect(adapter.authorize({
      identityId,
      permission: 'passport.academy.create',
    })).resolves.toEqual({ allowed: true, policyVersion: '1' });

    expect(prisma.playerPassport.findUnique).not.toHaveBeenCalled();
    expect(prisma.initialTutorResponsibility.findUnique).not.toHaveBeenCalled();
    expect(authorization.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      resource: { classification: 'protected', academyId },
      subject: expect.objectContaining({
        academyMembership: { active: true, academyId },
      }),
    }));
  });

  it('does not load membership or relationship facts for an internal review decision', async () => {
    const prisma = {
      identity: {
        findUnique: vi.fn().mockResolvedValue({
          status: 'ACTIVE',
          roleAssignments: [{ role: 'ANALYST' }],
        }),
      },
      academyMembership: { findFirst: vi.fn() },
      playerPassport: { findUnique: vi.fn() },
      initialTutorResponsibility: { findUnique: vi.fn() },
    };
    const authorization = { evaluate: vi.fn().mockReturnValue({ allowed: true, policyVersion: '1' }) };
    const adapter = new PassportAuthorizationAdapter(prisma as never, authorization as never);

    await expect(adapter.authorize({
      identityId,
      permission: 'passport.review',
      passportId,
    })).resolves.toEqual({ allowed: true, policyVersion: '1' });

    expect(prisma.academyMembership.findFirst).not.toHaveBeenCalled();
    expect(prisma.playerPassport.findUnique).not.toHaveBeenCalled();
    expect(prisma.initialTutorResponsibility.findUnique).not.toHaveBeenCalled();
    expect(authorization.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      resource: { classification: 'protected' },
      subject: expect.not.objectContaining({
        academyMembership: expect.anything(),
        tutorRelationship: expect.anything(),
      }),
    }));
  });

  it('requires a SELF or legal-representative relationship for USER particular management', async () => {
    const prisma = {
      identity: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', roleAssignments: [{ role: 'USER' }] }) },
      academyMembership: { findFirst: vi.fn() },
      playerPassport: { findUnique: vi.fn() },
      initialTutorResponsibility: { findUnique: vi.fn() },
    };
    const authorization = { evaluate: vi.fn() };
    const adapter = new PassportAuthorizationAdapter(prisma as never, authorization as never);
    await expect(adapter.authorize({ identityId, permission: 'passport.tutor.manage', passportId })).resolves.toMatchObject({ allowed: false });
  });

  it('does not treat historical TUTOR alone as USER authority', async () => {
    const prisma = {
      identity: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', roleAssignments: [{ role: 'TUTOR' }] }) },
      academyMembership: { findFirst: vi.fn() },
      playerPassport: { findUnique: vi.fn() },
      initialTutorResponsibility: { findUnique: vi.fn() },
    };
    const authorization = { evaluate: vi.fn() };
    const adapter = new PassportAuthorizationAdapter(prisma as never, authorization as never);
    await expect(adapter.authorize({ identityId, permission: 'passport.tutor.manage', passportId })).resolves.toMatchObject({ allowed: false });
  });

  it('does not convert PENDING_ONBOARDING access into passport or product authority', async () => {
    const prisma = {
      identity: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', roleAssignments: [] }) },
      academyMembership: { findFirst: vi.fn() },
      playerPassport: { findUnique: vi.fn() },
      initialTutorResponsibility: { findUnique: vi.fn() },
    };
    const authorization = new AuthorizationService();
    const adapter = new PassportAuthorizationAdapter(prisma as never, authorization);

    await expect(adapter.authorize({ identityId, permission: 'passport.particular.create' })).resolves.toEqual({ allowed: false, reason: 'no-active-role', policyVersion: '1' });
    expect(prisma.playerPassport.findUnique).not.toHaveBeenCalled();
  });
});
