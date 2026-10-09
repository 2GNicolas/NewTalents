import { describe, expect, it, vi } from 'vitest';

import { AuthorizationService } from '../../authorization/authorization.service.js';
import { projectSessionAccess } from '../../authentication/session-access.projection.js';
import { PassportAuthorizationAdapter } from './passport-authorization.adapter.js';

const analystId = '11111111-1111-4111-8111-111111111111';
const otherAnalystId = '22222222-2222-4222-8222-222222222222';
const passportId = '33333333-3333-4333-8333-333333333333';

function prisma(input: Readonly<{ status?: 'ACTIVE' | 'INACTIVE'; role?: 'ANALYST' | 'ADMINISTRATOR'; custodian?: string | null; passport?: boolean }> = {}) {
  const custodian = Object.prototype.hasOwnProperty.call(input, 'custodian') ? input.custodian ?? null : analystId;
  return {
    identity: { findUnique: vi.fn().mockResolvedValue({ status: input.status ?? 'ACTIVE', roleAssignments: [{ role: input.role ?? 'ANALYST' }], analystOperationalProfile: { identityId: analystId } }) },
    passportCustody: { findUnique: vi.fn().mockResolvedValue(input.passport === false ? null : { currentAnalystIdentityId: custodian }) },
    playerPassport: { findUnique: vi.fn().mockResolvedValue(input.passport === false ? null : { id: passportId }) },
    academyMembership: { findFirst: vi.fn() },
    initialTutorResponsibility: { findUnique: vi.fn() },
    passportResponsibility: { findFirst: vi.fn() },
  };
}

describe('PassportAuthorizationAdapter current custody', () => {
  it('allows an active Analyst only for the passport in their current custody', async () => {
    const adapter = new PassportAuthorizationAdapter(prisma() as never, new AuthorizationService());
    await expect(adapter.authorize({ identityId: analystId, permission: 'passport.review', passportId })).resolves.toEqual({ allowed: true, policyVersion: '1' });

    const denied = new PassportAuthorizationAdapter(prisma({ custodian: otherAnalystId }) as never, new AuthorizationService());
    await expect(denied.authorize({ identityId: analystId, permission: 'passport.review', passportId })).resolves.toMatchObject({ allowed: false });
  });

  it('fails closed for inactive identity, revoked Analyst role, unassigned or missing passports', async () => {
    for (const database of [
      prisma({ status: 'INACTIVE' }),
      prisma({ role: 'ADMINISTRATOR' }),
      prisma({ custodian: null }),
      prisma({ passport: false }),
    ]) {
      const adapter = new PassportAuthorizationAdapter(database as never, new AuthorizationService());
      await expect(adapter.authorize({ identityId: analystId, permission: 'passport.review', passportId })).resolves.toMatchObject({ allowed: false });
    }
  });

  it('keeps Administrator internal history authority while custody-scoping Analysts', async () => {
    const administrator = new PassportAuthorizationAdapter(prisma({ role: 'ADMINISTRATOR', custodian: otherAnalystId }) as never, new AuthorizationService());
    await expect(administrator.authorize({ identityId: analystId, permission: 'passport.history.internal', passportId })).resolves.toEqual({ allowed: true, policyVersion: '1' });

    const analyst = new PassportAuthorizationAdapter(prisma({ custodian: otherAnalystId }) as never, new AuthorizationService());
    await expect(analyst.authorize({ identityId: analystId, permission: 'passport.history.internal', passportId })).resolves.toMatchObject({ allowed: false });
  });

  it('projects only a navigation hint while resource authority remains server-evaluated', () => {
    expect(projectSessionAccess({ roleAssignments: [{ role: 'ANALYST', status: 'ACTIVE' }] }).capabilities).toContain('passport.review');
    expect(projectSessionAccess({ roleAssignments: [{ role: 'ANALYST', status: 'REVOKED' }] }).capabilities).not.toContain('passport.review');
  });
});
