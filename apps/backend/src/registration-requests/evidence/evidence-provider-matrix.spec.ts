import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../database/prisma.service.js';
import { EvidenceDeletionService } from './evidence-deletion.service.js';
import { EvidenceIngestionService } from './evidence-ingestion.service.js';
import type { EvidenceMalwareScanner, EvidenceScanResult } from './evidence-malware-scanner.js';
import { LocalPrivateEvidenceStore } from './local-private-evidence-store.js';
import type { EvidenceObjectKey } from './private-evidence-store.js';
import { S3PrivateEvidenceStore, type S3EvidenceUploadFactory } from './s3-private-evidence-store.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe('Feature 006 evidence provider failure matrix', () => {
  it.each([
    [{ status: 'clean', code: 'CLEAN' }, 'clean', 'CLEAN'],
    [{ status: 'infected', code: 'MALWARE_DETECTED' }, 'rejected', 'MALWARE_DETECTED'],
    [{ status: 'indeterminate', code: 'SCANNER_TIMEOUT' }, 'quarantined', 'SCANNER_TIMEOUT'],
    [{ status: 'indeterminate', code: 'SCANNER_UNAVAILABLE' }, 'quarantined', 'SCANNER_UNAVAILABLE'],
  ] as const)('covers local streaming with scanner result %s', async (scanResult, outcome, code) => {
    const root = await mkdtemp(join(tmpdir(), 'new-talents-provider-matrix-'));
    roots.push(root);
    const scanner: EvidenceMalwareScanner = { scan: vi.fn().mockResolvedValue(scanResult as EvidenceScanResult) };
    const ingestion = new EvidenceIngestionService(new LocalPrivateEvidenceStore(root), scanner, { maxItemBytes: 10_485_760, maxRequestBytes: 41_943_040 });
    const result = await ingestion.ingest({ fileName: 'synthetic.pdf', declaredMime: 'application/pdf', body: Readable.from(['%PDF-1.7\ncanary']), existingRequestBytes: 0 });
    expect(result.outcome).toBe(outcome);
    expect(result.projection.status === 'CLEAN' ? 'CLEAN' : result.projection.reason).toBe(code);
  });

  it('fails closed on type mismatch before scanning', async () => {
    const root = await mkdtemp(join(tmpdir(), 'new-talents-provider-matrix-'));
    roots.push(root);
    const scanner: EvidenceMalwareScanner = { scan: vi.fn().mockResolvedValue({ status: 'clean', code: 'CLEAN' }) };
    const ingestion = new EvidenceIngestionService(new LocalPrivateEvidenceStore(root), scanner, { maxItemBytes: 10_485_760, maxRequestBytes: 41_943_040 });
    await expect(ingestion.ingest({ fileName: 'synthetic.png', declaredMime: 'application/pdf', body: Readable.from(['%PDF-1.7\ncanary']), existingRequestBytes: 0 })).resolves.toMatchObject({ outcome: 'rejected', projection: { reason: 'TYPE_MISMATCH' } });
    expect(scanner.scan).not.toHaveBeenCalled();
  });

  it('deletes all S3 versions and treats an absent object as verified idempotent deletion', async () => {
    const versions = new Map<string, string[]>();
    const commands: any[] = [];
    const client = { send: vi.fn(async (command: any) => {
      commands.push(command);
      if (command.constructor.name === 'GetPublicAccessBlockCommand') return { PublicAccessBlockConfiguration: { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true } };
      if (command.constructor.name === 'ListObjectVersionsCommand') return { Versions: (versions.get(command.input.Prefix) ?? []).map((VersionId) => ({ Key: command.input.Prefix, VersionId })), DeleteMarkers: [] };
      return {};
    }) };
    const uploadFactory: S3EvidenceUploadFactory = (_client, input) => ({ done: async () => { versions.set(input.Key, ['v1', 'v2']); } });
    const waiter = vi.fn().mockResolvedValue(true);
    const store = new S3PrivateEvidenceStore(client, { bucket: 'private-evidence', region: 'us-east-1', encryption: 'AES256', uploadFactory, waitUntilAbsent: waiter });
    const uploaded = await store.put({ body: Readable.from(['canary']), contentType: 'application/pdf' });
    await expect(store.delete(uploaded.objectKey)).resolves.toEqual({ verifiedAbsent: true });
    const versionedDelete = commands.find((command) => command.constructor.name === 'DeleteObjectsCommand');
    expect(versionedDelete.input.Delete.Objects).toEqual([{ Key: uploaded.objectKey, VersionId: 'v1' }, { Key: uploaded.objectKey, VersionId: 'v2' }]);

    const absent = 'A'.repeat(43) as EvidenceObjectKey;
    await expect(store.delete(absent)).resolves.toEqual({ verifiedAbsent: true });
    expect(commands.some((command) => command.constructor.name === 'DeleteObjectCommand' && command.input.Key === absent)).toBe(true);
  });

  it('reclaims an expired lease and stops automatically after exactly five attempts', async () => {
    const now = new Date('2026-09-28T12:00:00.000Z');
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const leasePrisma = { registrationEvidenceDeletionRecord: { findMany: vi.fn().mockResolvedValue([{ id: 'expired' }]), updateMany } } as unknown as PrismaService;
    const unavailableStore = { delete: vi.fn().mockRejectedValue(new Error('provider unavailable')), exists: vi.fn(), put: vi.fn(), openStream: vi.fn(), listOrphanCandidates: vi.fn() } as never;
    const config = { batchSize: 2, leaseSeconds: 60, backoffSeconds: 30, maxAttempts: 5, orphanGraceSeconds: 86_400 } as const;
    const leaseService = new EvidenceDeletionService(leasePrisma, unavailableStore, { authorize: vi.fn() } as never, config);
    await expect(leaseService.claimBatch(now)).resolves.toEqual(['expired']);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'expired' }), data: { status: 'IN_PROGRESS', leaseUntil: new Date('2026-09-28T12:01:00.000Z') } }));

    const update = vi.fn();
    const exhaustedPrisma = { registrationEvidenceDeletionRecord: { findUnique: vi.fn().mockResolvedValue({ id: 'expired', attempts: 4, evidenceItem: { id: 'evidence', objectKey: 'B'.repeat(43) } }), update } } as unknown as PrismaService;
    const exhaustedService = new EvidenceDeletionService(exhaustedPrisma, unavailableStore, { authorize: vi.fn() } as never, config);
    await expect(exhaustedService.processClaimed('expired')).resolves.toEqual({ outcome: 'recovery-required' });
    expect(update).toHaveBeenCalledWith({ where: { id: 'expired' }, data: expect.objectContaining({ attempts: 5, status: 'RECOVERY_REQUIRED', leaseUntil: null, nextAttemptAt: null }) });
  });
});
