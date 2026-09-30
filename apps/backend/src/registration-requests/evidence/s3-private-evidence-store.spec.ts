import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import { exercisePrivateEvidenceStoreContract } from './private-evidence-store.contract.spec.js';
import { S3PrivateEvidenceStore, type S3EvidenceUploadFactory } from './s3-private-evidence-store.js';

function s3Harness() {
  const objects = new Map<string, Buffer>();
  const versions = new Map<string, string[]>([]);
  const commands: unknown[] = [];
  const client = {
    send: vi.fn(async (command: any) => {
      commands.push(command);
      const name = command.constructor.name;
      const key = command.input.Key as string;
      if (name === 'GetPublicAccessBlockCommand') return { PublicAccessBlockConfiguration: { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true } };
      if (name === 'GetObjectCommand') {
        const body = objects.get(key);
        if (!body) throw Object.assign(new Error('missing'), { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } });
        return { Body: Readable.from(body) };
      }
      if (name === 'HeadObjectCommand') {
        if (!objects.has(key)) throw Object.assign(new Error('missing'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
        return {};
      }
      if (name === 'ListObjectVersionsCommand') {
        return { Versions: (versions.get(command.input.Prefix) ?? []).map((VersionId) => ({ Key: command.input.Prefix, VersionId })), DeleteMarkers: [] };
      }
      if (name === 'DeleteObjectsCommand') {
        for (const item of command.input.Delete.Objects) if (item.Key) objects.delete(item.Key);
        return {};
      }
      return {};
    }),
  };
  const uploadFactory: S3EvidenceUploadFactory = (_client, input) => ({ done: async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of input.Body as Readable) chunks.push(Buffer.from(chunk));
    objects.set(input.Key, Buffer.concat(chunks));
    versions.set(input.Key, ['version-1']);
  } });
  const waiter = vi.fn(async (_client, input: { Key: string }) => !objects.has(input.Key));
  return { objects, versions, commands, client, uploadFactory, waiter };
}

exercisePrivateEvidenceStoreContract('S3-compatible', () => {
  const harness = s3Harness();
  return new S3PrivateEvidenceStore(harness.client, {
    bucket: 'new-talents-private-evidence', region: 'us-east-1', encryption: 'AES256', uploadFactory: harness.uploadFactory, waitUntilAbsent: harness.waiter,
  });
});

describe('S3PrivateEvidenceStore', () => {
  it('writes private encrypted objects by streaming without returning provider addressing', async () => {
    const harness = s3Harness();
    const observed = vi.fn(harness.uploadFactory);
    const store = new S3PrivateEvidenceStore(harness.client, { bucket: 'private-evidence', region: 'us-east-1', encryption: 'aws:kms', uploadFactory: observed, waitUntilAbsent: harness.waiter });
    const result = await store.put({ body: Readable.from(['synthetic']), contentType: 'image/png' });

    expect(observed).toHaveBeenCalledWith(harness.client, expect.objectContaining({ Bucket: 'private-evidence', Key: result.objectKey, ContentType: 'image/png', ServerSideEncryption: 'aws:kms', Body: expect.any(Readable) }));
    expect(observed.mock.calls[0]![1]).not.toHaveProperty('ACL');
    expect(result).toEqual({ objectKey: result.objectKey });
    expect(JSON.stringify(result)).not.toMatch(/bucket|url|region/i);
  });

  it('deletes all exact-key versions and verifies absence through the waiter', async () => {
    const harness = s3Harness();
    const store = new S3PrivateEvidenceStore(harness.client, { bucket: 'private-evidence', region: 'us-east-1', encryption: 'AES256', uploadFactory: harness.uploadFactory, waitUntilAbsent: harness.waiter });
    const { objectKey } = await store.put({ body: Readable.from(['synthetic']), contentType: 'application/pdf' });
    harness.versions.set(objectKey, ['v1', 'v2']);

    await expect(store.delete(objectKey)).resolves.toEqual({ verifiedAbsent: true });
    const deleteCommand: any = harness.commands.find((command: any) => command.constructor.name === 'DeleteObjectsCommand');
    expect(deleteCommand.input.Delete.Objects).toEqual([{ Key: objectKey, VersionId: 'v1' }, { Key: objectKey, VersionId: 'v2' }]);
    expect(harness.waiter).toHaveBeenCalledWith(harness.client, { Bucket: 'private-evidence', Key: objectKey });
  });

  it('treats a missing object as an idempotent verified deletion and rejects public-style bucket addressing', async () => {
    const harness = s3Harness();
    const store = new S3PrivateEvidenceStore(harness.client, { bucket: 'private-evidence', region: 'us-east-1', encryption: 'AES256', uploadFactory: harness.uploadFactory, waitUntilAbsent: harness.waiter });
    await expect(store.delete('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as never)).resolves.toEqual({ verifiedAbsent: true });
    expect(() => new S3PrivateEvidenceStore(harness.client, { bucket: 'https://public.example/evidence', region: 'us-east-1', encryption: 'AES256', uploadFactory: harness.uploadFactory, waitUntilAbsent: harness.waiter })).toThrow('Invalid private S3 bucket');
  });

  it('fails closed when the bucket does not block every form of public access', async () => {
    const harness = s3Harness();
    harness.client.send.mockImplementationOnce(async () => ({ PublicAccessBlockConfiguration: { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: false, RestrictPublicBuckets: true } }));
    const store = new S3PrivateEvidenceStore(harness.client, { bucket: 'private-evidence', region: 'us-east-1', encryption: 'AES256', uploadFactory: harness.uploadFactory, waitUntilAbsent: harness.waiter });
    await expect(store.put({ body: Readable.from(['synthetic']), contentType: 'application/pdf' })).rejects.toThrow('S3 evidence bucket must block all public access');
  });
});
