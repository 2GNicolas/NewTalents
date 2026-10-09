import { describe, expect, it, vi } from 'vitest';

import { AuthorizationService } from './authorization.service.js';
import { permissionCatalog } from './permission-catalog.js';
import { AdministratorAllowanceAuthorization } from '../passport-match-allowance/application/administrator-allowance-authorization.js';

const identityId = '11111111-1111-4111-8111-111111111111';
const permissions = ['passport.allowance.list', 'passport.allowance.view', 'passport.allowance.read', 'passport.allowance.write', 'passport.allowance.history'] as const;

describe('Feature 008 live Administrator authorization', () => {
  const evaluator = new AuthorizationService();
  const request = (permission: string, resource: Record<string, unknown>, role = 'ADMINISTRATOR', status = 'ACTIVE') => ({
    version: '1', permission, resource: { classification: 'protected', administratorCapability: true, ...resource },
    subject: { kind: 'authenticated', identityId, status, roles: [{ role, active: true }] },
  });

  it('registers scoped permissions and requires active Administrator facts', () => {
    for (const permission of permissions) expect(permissionCatalog).toHaveProperty(permission);
    expect(evaluator.evaluate(request('passport.allowance.list', {})).allowed).toBe(true);
    for (const permission of permissions.slice(1, 4)) {
      const facts = { passportExists: true, passportActive: true };
      expect(evaluator.evaluate(request(permission, facts)).allowed).toBe(true);
      expect(evaluator.evaluate(request(permission, facts, 'ANALYST')).allowed).toBe(false);
      expect(evaluator.evaluate(request(permission, facts, 'ADMINISTRATOR', 'INACTIVE')).allowed).toBe(false);
      expect(evaluator.evaluate(request(permission, { passportExists: false })).allowed).toBe(false);
    }
    expect(evaluator.evaluate(request('passport.allowance.view', { passportExists: true, passportActive: false })).allowed).toBe(true);
    expect(evaluator.evaluate(request('passport.allowance.history', { passportExists: true })).allowed).toBe(true);
    expect(evaluator.evaluate(request('passport.allowance.write', { passportExists: true, passportActive: false })).allowed).toBe(false);
    expect(evaluator.evaluate(request('passport.custody.list', {}, 'ANALYST')).allowed).toBe(false);
  });

  it('reloads identity and role assignments for each operation, not visible role text', async () => {
    const prisma = { identity: { findUnique: vi.fn().mockResolvedValueOnce({ status: 'ACTIVE', roleAssignments: [{ role: 'ADMINISTRATOR' }] })
      .mockResolvedValueOnce({ status: 'ACTIVE', roleAssignments: [] }) } };
    const adapter = new AdministratorAllowanceAuthorization(prisma as never, evaluator);
    expect((await adapter.authorize(identityId, 'passport.allowance.list')).allowed).toBe(true);
    expect((await adapter.authorize(identityId, 'passport.allowance.list')).allowed).toBe(false);
    expect(prisma.identity.findUnique).toHaveBeenCalledTimes(2);
  });
});
