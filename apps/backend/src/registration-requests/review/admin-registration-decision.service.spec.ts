import { beforeAll, describe, expect, it, vi } from 'vitest';

const servicePath: string = './admin-registration-decision.service.js';
let Service: new (...dependencies: any[]) => any;

beforeAll(async () => {
  const module = await vi.importActual<Record<string, unknown>>(servicePath);
  Service = module.AdminRegistrationDecisionService as typeof Service;
});

describe('AdminRegistrationDecisionService contract', () => {
  it('allows only an authorized Admin on the current SUBMITTED version and records an immutable correction', async () => {
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }) };
    const tx = {
      $queryRawUnsafe: vi.fn(), registrationCorrectionRequest: { create: vi.fn() },
      registrationReviewDecision: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      registrationRequest: { findUnique: vi.fn().mockResolvedValue({ status: 'SUBMITTED', version: 4 }), update: vi.fn() },
      registrationRequestEvent: { aggregate: vi.fn().mockResolvedValue({ _max: { sequence: 2 } }), create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (work) => work(tx)) };
    const service = new Service(prisma, authorization);
    await expect(service.requestCorrection('admin', 'request', { expectedVersion: 4, idempotencyKey: '44444444-4444-4444-8444-444444444444', safeReason: 'Corrige la evidencia indicada.', correctionTargets: ['IDENTITY_BACK'] })).resolves.toMatchObject({ outcome: 'applied' });
    expect(authorization.authorize).toHaveBeenCalledWith(expect.objectContaining({ permission: 'registration.review.request-correction', expectedVersion: 4 }));
  });

  it.each(['', '   ', 'x'.repeat(1001)])('rejects an unsafe correction/rejection reason without mutation', async (safeReason) => {
    const prisma = { $transaction: vi.fn() };
    const service = new Service(prisma, { authorize: vi.fn() }, {}, {});
    await expect(service.reject('admin', 'request', { expectedVersion: 1, idempotencyKey: '44444444-4444-4444-8444-444444444444', safeReason })).resolves.toEqual({ outcome: 'invalid' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('makes rejection final, creates no outcome, withdraws evidence immediately and schedules durable deletion once', async () => {
    const tx = {
      $queryRawUnsafe: vi.fn(),
      registrationReviewDecision: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      registrationEvidenceItem: { updateMany: vi.fn() }, registrationEvidenceDeletionRecord: { createMany: vi.fn() },
      registrationRequest: { findUnique: vi.fn().mockResolvedValue({ status: 'SUBMITTED', version: 2, applicantAccess: { requestId: 'request' }, evidenceItems: [{ id: 'evidence' }] }), update: vi.fn() },
      registrationApplicantAccess: { update: vi.fn() },
      registrationRequestEvent: { aggregate: vi.fn().mockResolvedValue({ _max: { sequence: 1 } }), create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (work) => work(tx)) };
    const outcomes = { materialize: vi.fn() };
    const service = new Service(prisma, { authorize: vi.fn().mockResolvedValue({ allowed: true }) }, {}, outcomes);
    await service.reject('admin', 'request', { expectedVersion: 2, idempotencyKey: '44444444-4444-4444-8444-444444444444', safeReason: 'La evidencia no acredita la solicitud.' });
    expect(tx.registrationEvidenceItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'DELETION_PENDING' }) }));
    expect(tx.registrationEvidenceDeletionRecord.createMany).toHaveBeenCalled();
    expect(outcomes.materialize).not.toHaveBeenCalled();
  });
});
