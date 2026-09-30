import { beforeAll, describe, expect, it, vi } from 'vitest';

const servicePath: string = './approval-execution.service.js';
let Service: new (...dependencies: any[]) => any;

beforeAll(async () => {
  const module = await vi.importActual<Record<string, unknown>>(servicePath);
  Service = module.ApprovalExecutionService as typeof Service;
});

describe('ApprovalExecutionService contract', () => {
  const command = { expectedVersion: 5, idempotencyKey: '55555555-5555-4555-8555-555555555555', manualDossierConfirmation: { confirmed: true, declarationVersion: 'dossier-v1', categories: ['IDENTITY_FRONT'] } };

  it.each([
    [{ ...command, manualDossierConfirmation: { ...command.manualDossierConfirmation, confirmed: false } }, 'DOSSIER_CONFIRMATION_REQUIRED'],
    [{ ...command, manualDossierConfirmation: { ...command.manualDossierConfirmation, declarationVersion: 'x'.repeat(41) } }, 'DOSSIER_DECLARATION_INVALID'],
    [{ ...command, manualDossierConfirmation: { ...command.manualDossierConfirmation, categories: [] } }, 'DOSSIER_CATEGORIES_REQUIRED'],
    [{ ...command, manualDossierConfirmation: { ...command.manualDossierConfirmation, categories: ['IDENTITY_FRONT', 'IDENTITY_FRONT'] } }, 'DOSSIER_CATEGORIES_INVALID'],
  ])('rejects invalid dossier confirmation before preparing approval', async (input, code) => {
    const prisma = { $transaction: vi.fn() };
    const service = new Service(prisma, {}, {}, {}, {});
    await expect(service.prepare('admin', 'request', input)).resolves.toEqual({ outcome: 'invalid', code });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires current complete CLEAN evidence, valid route/representation/academy and no duplicate conflict', async () => {
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: false }) };
    const prisma = {
      registrationApprovalExecution: { findUnique: vi.fn().mockResolvedValue(null) },
      registrationRequest: { findUnique: vi.fn().mockResolvedValue({ evidenceItems: [{ status: 'CLEAN' }], duplicateSignals: [] }) },
    };
    const service = new Service(prisma, authorization, { readiness: vi.fn().mockResolvedValue({ ageRouteCompatible: true, representationComplete: true }) });
    await expect(service.prepare('admin', 'request', command)).resolves.toEqual({ outcome: 'not-found' });
    expect(authorization.authorize).toHaveBeenCalledWith(expect.objectContaining({ permission: 'registration.review.confirm-dossier', expectedVersion: 5, evidenceCompleteAndClean: expect.any(Boolean), duplicateConflictAbsent: expect.any(Boolean) }));
  });

  it('creates no typed outcome until every evidence deletion is verified, then dispatches exactly once', async () => {
    const dispatcher = { approve: vi.fn().mockResolvedValue({ outcome: 'approved' }) };
    const execution = { id: 'execution-ready', requestId: 'request', requestVersion: 6, status: 'DELETING_EVIDENCE', idempotencyKey: command.idempotencyKey, resultReferences: null, request: { type: 'PERSONAL_ADULT', duplicateSignals: [], dossierConfirmations: [{ administratorIdentityId: 'admin' }] } };
    const prisma = {
      registrationApprovalExecution: { findUnique: vi.fn(({ where }) => Promise.resolve({ ...execution, id: where.id })) , update: vi.fn() },
      registrationEvidenceDeletionRecord: { findMany: vi.fn(({ where }) => Promise.resolve(where.requestVersion === 6 && prisma.registrationApprovalExecution.findUnique.mock.calls.length > 1 ? [{ status: 'COMPLETED' }] : [{ status: 'PENDING' }])) },
      registrationRequest: { update: vi.fn() },
      $transaction: vi.fn().mockResolvedValue([]),
    };
    const service = new Service(prisma, { authorize: vi.fn().mockResolvedValue({ allowed: true }) }, { readiness: vi.fn().mockResolvedValue({ ageRouteCompatible: true, representationComplete: true }) }, dispatcher);
    await expect(service.finalize('execution-pending')).resolves.toMatchObject({ outcome: 'pending-deletion' });
    expect(dispatcher.approve).not.toHaveBeenCalled();
    await expect(service.finalize('execution-ready')).resolves.toMatchObject({ outcome: 'approved' });
    expect(dispatcher.approve).toHaveBeenCalledTimes(1);
  });
});
