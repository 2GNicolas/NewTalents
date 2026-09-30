import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { exercisePrivateEvidenceStoreContract } from './private-evidence-store.contract.spec.js';
import type { EvidenceObjectKey } from './private-evidence-store.js';
import { LocalPrivateEvidenceStore } from './local-private-evidence-store.js';

let privateRoot: string;

beforeAll(async () => { privateRoot = await mkdtemp(join(tmpdir(), 'new-talents-private-evidence-')); });
afterAll(async () => { await rm(privateRoot, { recursive: true, force: true }); });

exercisePrivateEvidenceStoreContract('local filesystem', () => new LocalPrivateEvidenceStore(privateRoot));

describe('LocalPrivateEvidenceStore containment', () => {
  it('streams beneath the configured root and never returns a path', async () => {
    const store = new LocalPrivateEvidenceStore(privateRoot);
    const result = await store.put({ body: Readable.from(['streamed-content']), contentType: 'application/pdf' });
    expect(await readFile(join(privateRoot, result.objectKey), 'utf8')).toBe('streamed-content');
    expect(result).toEqual({ objectKey: result.objectKey });
    await store.delete(result.objectKey);
  });

  it('rejects traversal, malformed keys, and roots inside public/static directories', async () => {
    const store = new LocalPrivateEvidenceStore(privateRoot);
    for (const unsafe of ['../outside', '..\\outside', 'nested/key', '.', 'short']) {
      await expect(store.openStream(unsafe as EvidenceObjectKey)).rejects.toThrow('Invalid evidence object key');
    }
    expect(() => new LocalPrivateEvidenceStore(resolve('public/evidence'))).toThrow('Private evidence root must be outside public/static directories');
    expect(() => new LocalPrivateEvidenceStore('relative/evidence')).toThrow('Private evidence root must be absolute');
  });

  it('rejects a symlink escape even when the symlink name looks like an opaque key', async () => {
    const store = new LocalPrivateEvidenceStore(privateRoot);
    const outside = await mkdtemp(join(tmpdir(), 'new-talents-outside-'));
    const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as EvidenceObjectKey;
    await writeFile(join(outside, 'document'), 'outside');
    try {
      await symlink(outside, join(privateRoot, key), 'junction');
      await expect(store.openStream(key)).rejects.toThrow('Evidence object is not a regular private file');
      await expect(store.exists(key)).resolves.toBe(false);
    } finally {
      await rm(join(privateRoot, key), { force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('does not follow a pre-created directory at an opaque key', async () => {
    const key = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as EvidenceObjectKey;
    await mkdir(join(privateRoot, key));
    const store = new LocalPrivateEvidenceStore(privateRoot);
    await expect(store.openStream(key)).rejects.toThrow('Evidence object is not a regular private file');
    await rm(join(privateRoot, key), { recursive: true, force: true });
  });
});
