import { describe, expect, it, vi } from 'vitest';
import { PrivilegedChangesService } from './privileged-changes.service.js';
import type { AuthorizationRequest } from '../authorization/authorization.contract.js';

const actor: AuthorizationRequest = { version: '1', permission: 'ignored', resource: { classification: 'protected' }, subject: { kind: 'authenticated', identityId: '11111111-1111-4111-8111-111111111111', status: 'ACTIVE', roles: [{ role: 'ADMINISTRATOR', active: true }] } };
describe('PrivilegedChangesService', () => {
  it('allows only an active Administrator through the evaluator and records an applied role change', async () => {
    const prisma = { $transaction: vi.fn(async (callback) => callback({ identity: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE' }) }, roleAssignment: { create: vi.fn() }, authorizationChangeRecord: { create: vi.fn() } })) };
    const evaluator = { evaluate: vi.fn().mockReturnValue({ allowed: true }) };
    const service = new PrivilegedChangesService(prisma as never, evaluator as never);
    await expect(service.assignRole(actor, '22222222-2222-4222-8222-222222222222', 'ANALYST')).resolves.toEqual({ outcome: 'applied' });
    expect(evaluator.evaluate).toHaveBeenCalled();
  });
  it('denies non-Administrators without mutation and records a safe denial', async () => {
    const transaction = { authorizationChangeRecord: { create: vi.fn() } };
    const prisma = { $transaction: vi.fn(async (callback) => callback(transaction)) };
    const evaluator = { evaluate: vi.fn().mockReturnValue({ allowed: false }) };
    const service = new PrivilegedChangesService(prisma as never, evaluator as never);
    const denied: AuthorizationRequest = { ...actor, subject: { kind: 'authenticated', identityId: actor.subject.kind === 'authenticated' ? actor.subject.identityId : '', status: 'ACTIVE', roles: [{ role: 'ANALYST', active: true }] } };
    await expect(service.assignRole(denied, '22222222-2222-4222-8222-222222222222', 'ANALYST')).resolves.toEqual({ outcome: 'denied' });
    expect(transaction.authorizationChangeRecord.create).toHaveBeenCalled();
  });
});
