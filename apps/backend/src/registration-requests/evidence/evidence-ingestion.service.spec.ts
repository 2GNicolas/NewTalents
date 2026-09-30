import { createServer, type Server } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EvidenceMalwareScanner, EvidenceScanResult } from './evidence-malware-scanner.js';
import { ClamAvInstreamScanner } from './clamav-instream-scanner.js';
import { EvidenceIngestionService } from './evidence-ingestion.service.js';
import { LocalPrivateEvidenceStore } from './local-private-evidence-store.js';

const signatures = {
  pdf: Buffer.from('%PDF-1.7\nsynthetic document'),
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from('synthetic jpeg')]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.from('synthetic png')]),
};

const roots: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function service(scanResult: EvidenceScanResult, limits = { maxItemBytes: 10_485_760, maxRequestBytes: 41_943_040 }) {
  const root = await mkdtemp(join(tmpdir(), 'new-talents-ingestion-'));
  roots.push(root);
  const scanner: EvidenceMalwareScanner = { scan: vi.fn().mockResolvedValue(scanResult) };
  return { ingestion: new EvidenceIngestionService(new LocalPrivateEvidenceStore(root), scanner, limits), scanner };
}

describe('EvidenceIngestionService', () => {
  it.each([
    ['document.pdf', 'application/pdf', signatures.pdf, 'application/pdf'],
    ['photo.jpg', 'image/jpeg', signatures.jpeg, 'image/jpeg'],
    ['image.png', 'image/png', signatures.png, 'image/png'],
  ] as const)('streams and marks a valid clean %s without exposing internal storage or digest', async (fileName, declaredMime, body, detectedMime) => {
    const { ingestion, scanner } = await service({ status: 'clean', code: 'CLEAN' });
    const result = await ingestion.ingest({ fileName, declaredMime, body: Readable.from([body.subarray(0, 3), body.subarray(3)]), existingRequestBytes: 0 });

    expect(result.outcome).toBe('clean');
    expect(result.projection).toEqual({ status: 'CLEAN', sizeBytes: body.length, declaredMime, detectedMime });
    expect(JSON.stringify(result.projection)).not.toMatch(/objectKey|digest|path|bucket|url/i);
    expect(scanner.scan).toHaveBeenCalledOnce();
    if (result.outcome === 'clean') {
      expect(result.internal.objectKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(result.internal.contentDigest).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('enforces the approved 10 MiB item and 40 MiB request totals while streaming and never scans an oversized object', async () => {
    const { ingestion, scanner } = await service({ status: 'clean', code: 'CLEAN' });
    const oneMiB = Buffer.alloc(1_048_576);
    oneMiB.write('%PDF-1.7');
    const oversized = Readable.from((function* () { for (let index = 0; index < 11; index += 1) yield oneMiB; })());
    await expect(ingestion.ingest({ fileName: 'document.pdf', declaredMime: 'application/pdf', body: oversized, existingRequestBytes: 0 })).resolves.toMatchObject({ outcome: 'rejected', projection: { reason: 'ITEM_TOO_LARGE' } });
    await expect(ingestion.ingest({ fileName: 'document.pdf', declaredMime: 'application/pdf', body: Readable.from([Buffer.from('%PDF-1.7')]), existingRequestBytes: 41_943_035 })).resolves.toMatchObject({ outcome: 'rejected', projection: { reason: 'REQUEST_TOTAL_TOO_LARGE' } });
    expect(scanner.scan).not.toHaveBeenCalled();
  });

  it.each([
    ['document.png', 'application/pdf', signatures.pdf],
    ['document.pdf', 'image/png', signatures.pdf],
    ['document.pdf', 'application/pdf', Buffer.from('not a pdf')],
    ['document.exe', 'application/octet-stream', Buffer.from('MZ synthetic')],
  ] as const)('rejects extension, declared MIME and magic-byte mismatch for %s', async (fileName, declaredMime, body) => {
    const { ingestion, scanner } = await service({ status: 'clean', code: 'CLEAN' });
    const result = await ingestion.ingest({ fileName, declaredMime, body: Readable.from([body]), existingRequestBytes: 0 });
    expect(result).toMatchObject({ outcome: 'rejected', projection: { status: 'REJECTED', reason: 'TYPE_MISMATCH' } });
    expect(scanner.scan).not.toHaveBeenCalled();
  });

  it('rejects synthetic malware and keeps scanner uncertainty quarantined fail-closed', async () => {
    const infected = await service({ status: 'infected', code: 'MALWARE_DETECTED' });
    await expect(infected.ingestion.ingest({ fileName: 'document.pdf', declaredMime: 'application/pdf', body: Readable.from([signatures.pdf]), existingRequestBytes: 0 })).resolves.toMatchObject({ outcome: 'rejected', projection: { status: 'REJECTED', reason: 'MALWARE_DETECTED' } });

    for (const code of ['SCANNER_TIMEOUT', 'SCANNER_UNAVAILABLE', 'SCANNER_MALFORMED_RESPONSE', 'SCANNER_ERROR'] as const) {
      const uncertain = await service({ status: 'indeterminate', code });
      await expect(uncertain.ingestion.ingest({ fileName: 'document.pdf', declaredMime: 'application/pdf', body: Readable.from([signatures.pdf]), existingRequestBytes: 0 })).resolves.toMatchObject({ outcome: 'quarantined', projection: { status: 'QUARANTINED', reason: code } });
    }
  });
});

async function fakeClam(response?: string, delayMs = 0) {
  let received = Buffer.alloc(0);
  const server = createServer((socket) => {
    socket.on('data', (chunk) => {
      received = Buffer.concat([received, chunk]);
      if (received.length >= 4 && received.subarray(-4).equals(Buffer.alloc(4)) && response !== undefined) setTimeout(() => socket.end(response), delayMs);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Synthetic scanner did not bind');
  return { port: address.port, received: () => received };
}

describe('ClamAvInstreamScanner', () => {
  it('frames INSTREAM chunks and recognizes a complete clean response', async () => {
    const fake = await fakeClam('stream: OK\0');
    const scanner = new ClamAvInstreamScanner({ host: '127.0.0.1', port: fake.port, timeoutMs: 500 });
    await expect(scanner.scan(Readable.from(['synthetic-', 'canary']))).resolves.toEqual({ status: 'clean', code: 'CLEAN' });
    expect(fake.received().subarray(0, 10).toString()).toBe('zINSTREAM\0');
    expect(fake.received().subarray(-4)).toEqual(Buffer.alloc(4));
  });

  it('recognizes FOUND and fails closed on timeout, unavailability, and malformed responses', async () => {
    const infected = await fakeClam('stream: Synthetic-Test-Signature FOUND\0');
    await expect(new ClamAvInstreamScanner({ host: '127.0.0.1', port: infected.port, timeoutMs: 500 }).scan(Readable.from(['canary']))).resolves.toEqual({ status: 'infected', code: 'MALWARE_DETECTED' });

    const malformed = await fakeClam('unexpected response\0');
    await expect(new ClamAvInstreamScanner({ host: '127.0.0.1', port: malformed.port, timeoutMs: 500 }).scan(Readable.from(['canary']))).resolves.toEqual({ status: 'indeterminate', code: 'SCANNER_MALFORMED_RESPONSE' });

    const timeout = await fakeClam(undefined);
    await expect(new ClamAvInstreamScanner({ host: '127.0.0.1', port: timeout.port, timeoutMs: 20 }).scan(Readable.from(['canary']))).resolves.toEqual({ status: 'indeterminate', code: 'SCANNER_TIMEOUT' });

    const unavailable = new ClamAvInstreamScanner({ host: '127.0.0.1', port: 1, timeoutMs: 50 });
    await expect(unavailable.scan(Readable.from(['canary']))).resolves.toEqual({ status: 'indeterminate', code: 'SCANNER_UNAVAILABLE' });
  });
});
