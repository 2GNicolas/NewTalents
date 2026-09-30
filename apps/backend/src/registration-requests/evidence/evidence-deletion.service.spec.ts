import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../database/prisma.service.js';
import type { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';
import { EvidenceDeletionService } from './evidence-deletion.service.js';
import { EvidenceDeletionWorker } from './evidence-deletion.worker.js';
import type { EvidenceObjectKey, PrivateEvidenceStore } from './private-evidence-store.js';

const requestId = '20000000-0000-4000-8000-000000000002';
const evidenceId = '30000000-0000-4000-8000-000000000003';
const actorId = '10000000-0000-4000-8000-000000000001';
const oldKey = 'A'.repeat(43) as EvidenceObjectKey;
const newKey = 'B'.repeat(43) as EvidenceObjectKey;

const config = { batchSize: 2, leaseSeconds: 60, backoffSeconds: 30, maxAttempts: 5, orphanGraceSeconds: 86_400 } as const;

function store(overrides: Partial<PrivateEvidenceStore> = {}): PrivateEvidenceStore {
  return {
    put: vi.fn(), openStream: vi.fn().mockResolvedValue(Readable.from([])),
    delete: vi.fn().mockResolvedValue({ verifiedAbsent: true }), exists: vi.fn().mockResolvedValue(false),
    listOrphanCandidates: vi.fn().mockResolvedValue([]), ...overrides,
  };
}

describe('EvidenceDeletionService replacement', () => {
  it('atomically replaces only an explicitly corrected category and schedules the old object once', async () => {
    const tx = {
      registrationRequest: { findUnique: vi.fn().mockResolvedValue({ status: 'REQUIRES_CORRECTION', version: 7, corrections: [{ correctionTargets: ['IDENTITY_FRONT'] }] }) },
      registrationEvidenceItem: {
        findFirst: vi.fn().mockResolvedValue({ id: evidenceId, category: 'IDENTITY_FRONT', status: 'CLEAN', replacedById: null }),
        create: vi.fn().mockResolvedValue({ id: '40000000-0000-4000-8000-000000000004' }), update: vi.fn(),
      },
      registrationEvidenceDeletionRecord: { upsert: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (callback) => callback(tx)) } as unknown as PrismaService;
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }) } as unknown as RegistrationAuthorizationAdapter;
    const service = new EvidenceDeletionService(prisma, store(), authorization, config);
    await expect(service.replaceCorrectedEvidence({ actorIdentityId: actorId, requestId, expectedVersion: 7, category: 'IDENTITY_FRONT', replacement: { objectKey: newKey, declaredMime: 'application/pdf', detectedMime: 'application/pdf', sizeBytes: 32, contentDigest: 'd'.repeat(64), scannerResultCode: 'CLEAN' } })).resolves.toEqual({ outcome: 'replaced', evidenceId: '40000000-0000-4000-8000-000000000004' });
    expect(tx.registrationEvidenceItem.update).toHaveBeenCalledWith({ where: { id: evidenceId }, data: { status: 'REPLACED', replacedById: '40000000-0000-4000-8000-000000000004' } });
    expect(tx.registrationEvidenceDeletionRecord.upsert).toHaveBeenCalledOnce();
  });

  it('rejects non-correction or unrequested categories and cleans a new object after transaction failure', async () => {
    const evidenceStore = store();
    const prisma = { $transaction: vi.fn().mockRejectedValue(new Error('conflict')) } as unknown as PrismaService;
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }) } as unknown as RegistrationAuthorizationAdapter;
    const service = new EvidenceDeletionService(prisma, evidenceStore, authorization, config);
    await expect(service.replaceCorrectedEvidence({ actorIdentityId: actorId, requestId, expectedVersion: 7, category: 'IDENTITY_FRONT', replacement: { objectKey: newKey, declaredMime: 'application/pdf', detectedMime: 'application/pdf', sizeBytes: 32, contentDigest: 'd'.repeat(64), scannerResultCode: 'CLEAN' } })).resolves.toEqual({ outcome: 'conflict' });
    expect(evidenceStore.delete).toHaveBeenCalledWith(newKey);
  });
});

describe('EvidenceDeletionService bounded recovery', () => {
  it('verifies absence, treats missing objects as success, and completes durable deletion', async () => {
    const record = { id: '50000000-0000-4000-8000-000000000005', attempts: 0, evidenceItem: { id: evidenceId, objectKey: oldKey } };
    const prisma = {
      registrationEvidenceDeletionRecord: { findUnique: vi.fn().mockResolvedValue(record), update: vi.fn(), count: vi.fn().mockResolvedValue(0) },
      registrationEvidenceItem: { update: vi.fn() },
      $transaction: vi.fn(async (operations) => Promise.all(operations)),
    } as unknown as PrismaService;
    const service = new EvidenceDeletionService(prisma, store(), { authorize: vi.fn() } as any, config);
    await expect(service.processClaimed(record.id)).resolves.toEqual({ outcome: 'completed' });
    expect((prisma as any).registrationEvidenceDeletionRecord.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', verifiedAbsentAt: expect.any(Date) }) }));
    expect((prisma as any).registrationEvidenceItem.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'DELETED' }) }));
  });

  it('uses lease recovery and exactly five automatic attempts before RECOVERY_REQUIRED', async () => {
    const update = vi.fn();
    const prisma = { registrationEvidenceDeletionRecord: { findUnique: vi.fn().mockResolvedValue({ id: 'r', attempts: 4, evidenceItem: { id: evidenceId, objectKey: oldKey } }), update } } as unknown as PrismaService;
    const service = new EvidenceDeletionService(prisma, store({ delete: vi.fn().mockRejectedValue(new Error('provider secret')) }), { authorize: vi.fn() } as any, config);
    await expect(service.processClaimed('r')).resolves.toEqual({ outcome: 'recovery-required' });
    expect(update).toHaveBeenCalledWith({ where: { id: 'r' }, data: expect.objectContaining({ attempts: 5, status: 'RECOVERY_REQUIRED', leaseUntil: null, lastSafeErrorCode: 'PROVIDER_DELETE_FAILED' }) });
  });

  it('allows only an authorized explicit idempotent retry and resets a bounded cycle', async () => {
    const prisma = { registrationEvidenceDeletionRecord: { findUnique: vi.fn().mockResolvedValue({ id: 'r', requestId, status: 'RECOVERY_REQUIRED' }), update: vi.fn().mockResolvedValue({}) } } as unknown as PrismaService;
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }) } as unknown as RegistrationAuthorizationAdapter;
    const service = new EvidenceDeletionService(prisma, store(), authorization, config);
    await expect(service.retryRecovery({ actorIdentityId: actorId, deletionRecordId: 'r' })).resolves.toEqual({ outcome: 'scheduled' });
    await expect(service.retryRecovery({ actorIdentityId: actorId, deletionRecordId: 'r' })).resolves.toEqual({ outcome: 'scheduled' });
    expect(authorization.authorize).toHaveBeenCalledWith(expect.objectContaining({ permission: 'registration.review.retry-deletion', deletionState: 'RECOVERY_REQUIRED' }));
  });

  it('restarts every exhausted record for the current request version without exposing record ids', async () => {
    const prisma = {
      registrationRequest: { findUnique: vi.fn().mockResolvedValue({ id: requestId, version: 8, approvalExecutionStatus: 'RECOVERY_REQUIRED' }), update: vi.fn() },
      registrationEvidenceDeletionRecord: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      registrationApprovalExecution: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      $transaction: vi.fn(async (operations) => Promise.all(operations)),
    } as unknown as PrismaService;
    const authorization = { authorize: vi.fn().mockResolvedValue({ allowed: true }) } as unknown as RegistrationAuthorizationAdapter;
    const service = new EvidenceDeletionService(prisma, store(), authorization, config);
    await expect(service.retryRequestRecovery({ actorIdentityId: actorId, requestId, expectedVersion: 8 })).resolves.toEqual({ outcome: 'scheduled' });
    expect(authorization.authorize).toHaveBeenCalledWith(expect.objectContaining({ requestId, expectedVersion: 8, deletionState: 'RECOVERY_REQUIRED' }));
    expect((prisma as any).registrationEvidenceDeletionRecord.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { requestId, requestVersion: 8, status: 'RECOVERY_REQUIRED' } }));
  });

  it('cross-checks only old opaque Feature 006 candidates and never deletes DB-known or unrelated objects', async () => {
    const orphan = 'C'.repeat(43) as EvidenceObjectKey;
    const known = 'D'.repeat(43) as EvidenceObjectKey;
    const evidenceStore = store({ listOrphanCandidates: vi.fn().mockResolvedValue([{ objectKey: orphan, createdAt: new Date(0) }, { objectKey: known, createdAt: new Date(0) }]) });
    const prisma = { registrationEvidenceItem: { findMany: vi.fn().mockResolvedValue([{ objectKey: known }]) } } as unknown as PrismaService;
    const service = new EvidenceDeletionService(prisma, evidenceStore, { authorize: vi.fn() } as any, config);
    await expect(service.reconcileOrphans(new Date(100_000_000))).resolves.toEqual({ inspected: 2, deleted: 1 });
    expect(evidenceStore.delete).toHaveBeenCalledWith(orphan);
    expect(evidenceStore.delete).not.toHaveBeenCalledWith(known);
  });

  it('runs a bounded worker batch and reclaims expired leases', async () => {
    const service = { claimBatch: vi.fn().mockResolvedValue(['a', 'b']), processClaimed: vi.fn().mockResolvedValue({ outcome: 'completed' }) };
    const worker = new EvidenceDeletionWorker(service as any);
    await expect(worker.runOnce(new Date())).resolves.toEqual({ claimed: 2, completed: 2, deferred: 0, recoveryRequired: 0 });
    expect(service.processClaimed).toHaveBeenCalledTimes(2);
  });
});
