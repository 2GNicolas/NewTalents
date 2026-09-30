import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import { Transform, type Readable, type TransformCallback } from 'node:stream';

import type { EvidenceMalwareScanner, EvidenceScanResult } from './evidence-malware-scanner.js';
import type { EvidenceObjectKey, PrivateEvidenceStore } from './private-evidence-store.js';

type AllowedMime = 'application/pdf' | 'image/jpeg' | 'image/png';
type RejectionReason = 'ITEM_TOO_LARGE' | 'REQUEST_TOTAL_TOO_LARGE' | 'TYPE_MISMATCH' | 'MALWARE_DETECTED' | 'INVALID_INPUT';
type QuarantineReason = Extract<EvidenceScanResult, { status: 'indeterminate' }>['code'];
type InternalEvidenceMetadata = Readonly<{ objectKey: EvidenceObjectKey; contentDigest: string }>;
type SafeEvidenceProjection = Readonly<{ status: 'CLEAN' | 'REJECTED' | 'QUARANTINED'; sizeBytes: number; declaredMime: string; detectedMime?: AllowedMime; reason?: RejectionReason | QuarantineReason }>;

export type EvidenceIngestionResult =
  | Readonly<{ outcome: 'clean'; projection: SafeEvidenceProjection; internal: InternalEvidenceMetadata }>
  | Readonly<{ outcome: 'rejected'; projection: SafeEvidenceProjection; internal?: InternalEvidenceMetadata }>
  | Readonly<{ outcome: 'quarantined'; projection: SafeEvidenceProjection; internal: InternalEvidenceMetadata }>;

class EvidenceLimitError extends Error {
  constructor(readonly reason: 'ITEM_TOO_LARGE' | 'REQUEST_TOTAL_TOO_LARGE', readonly sizeBytes: number) { super(reason); }
}

class EvidenceInspectionTransform extends Transform {
  private readonly digest = createHash('sha256');
  private prefix = Buffer.alloc(0);
  sizeBytes = 0;

  constructor(private readonly existingRequestBytes: number, private readonly maxItemBytes: number, private readonly maxRequestBytes: number) { super(); }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.sizeBytes += value.length;
    if (this.sizeBytes > this.maxItemBytes) return callback(new EvidenceLimitError('ITEM_TOO_LARGE', this.sizeBytes));
    if (this.existingRequestBytes + this.sizeBytes > this.maxRequestBytes) return callback(new EvidenceLimitError('REQUEST_TOTAL_TOO_LARGE', this.sizeBytes));
    this.digest.update(value);
    if (this.prefix.length < 8) this.prefix = Buffer.concat([this.prefix, value.subarray(0, 8 - this.prefix.length)]);
    callback(null, value);
  }

  detectedMime(): AllowedMime | null {
    if (this.prefix.subarray(0, 5).equals(Buffer.from('%PDF-'))) return 'application/pdf';
    if (this.prefix.length >= 3 && this.prefix[0] === 0xff && this.prefix[1] === 0xd8 && this.prefix[2] === 0xff) return 'image/jpeg';
    if (this.prefix.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    return null;
  }

  contentDigest(): string { return this.digest.digest('hex'); }
}

const EXTENSION_MIME = new Map<string, AllowedMime>([['.pdf', 'application/pdf'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png']]);
const ALLOWED_MIME = new Set<AllowedMime>(['application/pdf', 'image/jpeg', 'image/png']);

export class EvidenceIngestionService {
  constructor(
    private readonly store: PrivateEvidenceStore,
    private readonly scanner: EvidenceMalwareScanner,
    private readonly limits: Readonly<{ maxItemBytes: number; maxRequestBytes: number }>,
  ) {}

  async ingest(input: Readonly<{ fileName: unknown; declaredMime: unknown; body: Readable; existingRequestBytes: unknown }>): Promise<EvidenceIngestionResult> {
    const declaredMime = typeof input.declaredMime === 'string' ? input.declaredMime.toLowerCase() : '';
    const fileName = typeof input.fileName === 'string' ? input.fileName : '';
    const existingRequestBytes = input.existingRequestBytes;
    if (!Number.isSafeInteger(existingRequestBytes) || Number(existingRequestBytes) < 0 || !ALLOWED_MIME.has(declaredMime as AllowedMime) || !EXTENSION_MIME.has(extname(fileName).toLowerCase())) {
      input.body.destroy();
      return this.rejected('TYPE_MISMATCH', 0, declaredMime);
    }

    const inspection = new EvidenceInspectionTransform(Number(existingRequestBytes), this.limits.maxItemBytes, this.limits.maxRequestBytes);
    // The store owns the downstream pipeline; this listener prevents a source-side
    // error from becoming process-level while the same error is awaited below.
    inspection.on('error', () => undefined);
    input.body.pipe(inspection);
    let stored: Awaited<ReturnType<PrivateEvidenceStore['put']>>;
    try {
      stored = await this.store.put({ body: inspection, contentType: declaredMime as AllowedMime });
    } catch (error) {
      input.body.destroy();
      if (error instanceof EvidenceLimitError) return this.rejected(error.reason, error.sizeBytes, declaredMime);
      throw error;
    }

    const detectedMime = inspection.detectedMime();
    const internal = Object.freeze({ objectKey: stored.objectKey, contentDigest: inspection.contentDigest() });
    if (!detectedMime || detectedMime !== declaredMime || EXTENSION_MIME.get(extname(fileName).toLowerCase()) !== detectedMime) {
      return this.rejected('TYPE_MISMATCH', inspection.sizeBytes, declaredMime, detectedMime ?? undefined, internal);
    }

    const scanStream = await this.store.openStream(stored.objectKey);
    if (!scanStream) return this.quarantined('SCANNER_ERROR', inspection.sizeBytes, declaredMime, detectedMime, internal);
    const scan = await this.scanner.scan(scanStream);
    if (scan.status === 'clean') return Object.freeze({ outcome: 'clean', projection: Object.freeze({ status: 'CLEAN', sizeBytes: inspection.sizeBytes, declaredMime, detectedMime }), internal });
    if (scan.status === 'infected') return this.rejected('MALWARE_DETECTED', inspection.sizeBytes, declaredMime, detectedMime, internal);
    return this.quarantined(scan.code, inspection.sizeBytes, declaredMime, detectedMime, internal);
  }

  private rejected(reason: RejectionReason, sizeBytes: number, declaredMime: string, detectedMime?: AllowedMime, internal?: InternalEvidenceMetadata): EvidenceIngestionResult {
    return Object.freeze({ outcome: 'rejected', projection: Object.freeze({ status: 'REJECTED', reason, sizeBytes, declaredMime, ...(detectedMime ? { detectedMime } : {}) }), ...(internal ? { internal } : {}) });
  }

  private quarantined(reason: QuarantineReason, sizeBytes: number, declaredMime: string, detectedMime: AllowedMime, internal: InternalEvidenceMetadata): EvidenceIngestionResult {
    return Object.freeze({ outcome: 'quarantined', projection: Object.freeze({ status: 'QUARANTINED', reason, sizeBytes, declaredMime, detectedMime }), internal });
  }
}
