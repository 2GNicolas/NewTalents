import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  GetPublicAccessBlockCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  ListObjectsV2Command,
  S3Client,
  waitUntilObjectNotExists,
  type ServerSideEncryption,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'node:stream';

import { createOpaqueEvidenceObjectKey, isOpaqueEvidenceObjectKey, type EvidenceDeleteResult, type EvidenceObjectKey, type EvidenceOrphanCandidate, type EvidencePutInput, type EvidencePutResult, type PrivateEvidenceStore } from './private-evidence-store.js';

export type S3EvidenceClient = Readonly<{ send(command: unknown): Promise<any> }>;
export type S3UploadInput = Readonly<{ Bucket: string; Key: string; Body: Readable; ContentType: string; ServerSideEncryption: ServerSideEncryption }>;
export type S3EvidenceUploadFactory = (client: S3EvidenceClient, input: S3UploadInput) => Readonly<{ done(): Promise<unknown> }>;
export type S3WaitUntilAbsent = (client: S3EvidenceClient, input: Readonly<{ Bucket: string; Key: string }>) => Promise<boolean>;

export type S3PrivateEvidenceStoreOptions = Readonly<{
  bucket: string;
  region: string;
  encryption: 'AES256' | 'aws:kms';
  uploadFactory?: S3EvidenceUploadFactory;
  waitUntilAbsent?: S3WaitUntilAbsent;
}>;

const defaultUploadFactory: S3EvidenceUploadFactory = (client, input) => new Upload({ client: client as S3Client, params: input });
const defaultWaiter: S3WaitUntilAbsent = async (client, input) => {
  const result = await waitUntilObjectNotExists({ client: client as S3Client, maxWaitTime: 30, minDelay: 1, maxDelay: 3 }, input);
  return result.state === 'SUCCESS';
};

function missing(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { name?: unknown; $metadata?: { httpStatusCode?: unknown } };
  return candidate.name === 'NoSuchKey' || candidate.name === 'NotFound' || candidate.$metadata?.httpStatusCode === 404;
}

export class S3PrivateEvidenceStore implements PrivateEvidenceStore {
  private readonly uploadFactory: S3EvidenceUploadFactory;
  private readonly waitUntilAbsent: S3WaitUntilAbsent;
  private privateBucketCheck: Promise<void> | undefined;

  constructor(private readonly client: S3EvidenceClient, private readonly options: S3PrivateEvidenceStoreOptions) {
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(options.bucket) || options.bucket.includes('..') || /^(?:https?:|s3:)/.test(options.bucket)) throw new Error('Invalid private S3 bucket');
    if (!options.region.trim()) throw new Error('Invalid S3 region');
    this.uploadFactory = options.uploadFactory ?? defaultUploadFactory;
    this.waitUntilAbsent = options.waitUntilAbsent ?? defaultWaiter;
  }

  async put(input: EvidencePutInput): Promise<EvidencePutResult> {
    await this.assertPrivateBucket();
    const objectKey = createOpaqueEvidenceObjectKey();
    const upload = this.uploadFactory(this.client, {
      Bucket: this.options.bucket,
      Key: objectKey,
      Body: input.body,
      ContentType: input.contentType,
      ServerSideEncryption: this.options.encryption,
    });
    await upload.done();
    return Object.freeze({ objectKey });
  }

  async openStream(objectKey: EvidenceObjectKey): Promise<Readable | null> {
    await this.assertPrivateBucket();
    this.assertKey(objectKey);
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.options.bucket, Key: objectKey }));
      if (!(result.Body instanceof Readable)) throw new Error('S3 evidence body is not a Node stream');
      return result.Body;
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  async delete(objectKey: EvidenceObjectKey): Promise<EvidenceDeleteResult> {
    await this.assertPrivateBucket();
    this.assertKey(objectKey);
    let keyMarker: string | undefined;
    let versionIdMarker: string | undefined;
    const identifiers: Array<{ Key: string; VersionId?: string }> = [];
    do {
      const page = await this.client.send(new ListObjectVersionsCommand({
        Bucket: this.options.bucket,
        Prefix: objectKey,
        ...(keyMarker ? { KeyMarker: keyMarker } : {}),
        ...(versionIdMarker ? { VersionIdMarker: versionIdMarker } : {}),
      }));
      for (const item of [...(page.Versions ?? []), ...(page.DeleteMarkers ?? [])]) {
        if (item.Key === objectKey) identifiers.push({ Key: objectKey, ...(item.VersionId ? { VersionId: item.VersionId } : {}) });
      }
      keyMarker = page.IsTruncated ? page.NextKeyMarker : undefined;
      versionIdMarker = page.IsTruncated ? page.NextVersionIdMarker : undefined;
    } while (keyMarker || versionIdMarker);

    if (identifiers.length > 0) {
      for (let index = 0; index < identifiers.length; index += 1000) {
        await this.client.send(new DeleteObjectsCommand({ Bucket: this.options.bucket, Delete: { Objects: identifiers.slice(index, index + 1000), Quiet: true } }));
      }
    } else {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: objectKey }));
    }
    const verifiedAbsent = await this.waitUntilAbsent(this.client, { Bucket: this.options.bucket, Key: objectKey });
    return Object.freeze({ verifiedAbsent });
  }

  async exists(objectKey: EvidenceObjectKey): Promise<boolean> {
    await this.assertPrivateBucket();
    this.assertKey(objectKey);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.options.bucket, Key: objectKey }));
      return true;
    } catch (error) {
      if (missing(error)) return false;
      throw error;
    }
  }

  async listOrphanCandidates(olderThan: Date): Promise<readonly EvidenceOrphanCandidate[]> {
    await this.assertPrivateBucket();
    let continuationToken: string | undefined;
    const candidates: EvidenceOrphanCandidate[] = [];
    do {
      const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.options.bucket, ...(continuationToken ? { ContinuationToken: continuationToken } : {}) }));
      for (const object of page.Contents ?? []) {
        if (object.Key && object.LastModified && object.LastModified < olderThan && isOpaqueEvidenceObjectKey(object.Key)) {
          candidates.push(Object.freeze({ objectKey: object.Key, createdAt: object.LastModified }));
        }
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
    return Object.freeze(candidates);
  }

  private assertKey(objectKey: EvidenceObjectKey): void {
    if (!isOpaqueEvidenceObjectKey(objectKey)) throw new Error('Invalid evidence object key');
  }

  private async assertPrivateBucket(): Promise<void> {
    this.privateBucketCheck ??= (async () => {
      const result = await this.client.send(new GetPublicAccessBlockCommand({ Bucket: this.options.bucket }));
      const block = result.PublicAccessBlockConfiguration;
      if (!block?.BlockPublicAcls || !block.IgnorePublicAcls || !block.BlockPublicPolicy || !block.RestrictPublicBuckets) throw new Error('S3 evidence bucket must block all public access');
    })();
    return this.privateBucketCheck;
  }
}
