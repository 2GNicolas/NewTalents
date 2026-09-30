import { randomBytes } from 'node:crypto';
import type { Readable } from 'node:stream';

export const PRIVATE_EVIDENCE_STORE = Symbol('PRIVATE_EVIDENCE_STORE');

export type EvidenceObjectKey = string & { readonly __evidenceObjectKey: unique symbol };

export type EvidencePutInput = Readonly<{
  body: Readable;
  contentType: 'application/pdf' | 'image/jpeg' | 'image/png';
  contentLength?: number;
}>;

export type EvidencePutResult = Readonly<{ objectKey: EvidenceObjectKey }>;
export type EvidenceDeleteResult = Readonly<{ verifiedAbsent: boolean }>;
export type EvidenceOrphanCandidate = Readonly<{ objectKey: EvidenceObjectKey; createdAt: Date }>;

export interface PrivateEvidenceStore {
  put(input: EvidencePutInput): Promise<EvidencePutResult>;
  openStream(objectKey: EvidenceObjectKey): Promise<Readable | null>;
  delete(objectKey: EvidenceObjectKey): Promise<EvidenceDeleteResult>;
  exists(objectKey: EvidenceObjectKey): Promise<boolean>;
  listOrphanCandidates(olderThan: Date): Promise<readonly EvidenceOrphanCandidate[]>;
}

const OPAQUE_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createOpaqueEvidenceObjectKey(): EvidenceObjectKey {
  return randomBytes(32).toString('base64url') as EvidenceObjectKey;
}

export function isOpaqueEvidenceObjectKey(value: unknown): value is EvidenceObjectKey {
  return typeof value === 'string' && OPAQUE_KEY_PATTERN.test(value);
}
