import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { createOpaqueEvidenceObjectKey, isOpaqueEvidenceObjectKey, type PrivateEvidenceStore } from './private-evidence-store.js';

export function exercisePrivateEvidenceStoreContract(name: string, createStore: () => Promise<PrivateEvidenceStore> | PrivateEvidenceStore) {
  describe(`${name} PrivateEvidenceStore contract`, () => {
    it('streams put/open, uses opaque random keys, and deletes idempotently with verified absence', async () => {
      const store = await createStore();
      const first = await store.put({ body: Readable.from(['synthetic-', 'evidence']), contentType: 'application/pdf' });
      const second = await store.put({ body: Readable.from(['synthetic-evidence']), contentType: 'application/pdf' });
      expect(first.objectKey).not.toBe(second.objectKey);
      expect(isOpaqueEvidenceObjectKey(first.objectKey)).toBe(true);
      expect(first).not.toHaveProperty('url');
      expect(first).not.toHaveProperty('path');
      expect(await store.exists(first.objectKey)).toBe(true);

      const opened = await store.openStream(first.objectKey);
      expect(opened).not.toBeNull();
      let content = '';
      for await (const chunk of opened!) content += Buffer.from(chunk).toString('utf8');
      expect(content).toBe('synthetic-evidence');

      await expect(store.delete(first.objectKey)).resolves.toEqual({ verifiedAbsent: true });
      await expect(store.delete(first.objectKey)).resolves.toEqual({ verifiedAbsent: true });
      expect(await store.exists(first.objectKey)).toBe(false);
      expect(await store.openStream(first.objectKey)).toBeNull();
      await store.delete(second.objectKey);
    });
  });
}

describe('opaque evidence object keys', () => {
  it('creates unguessable provider-neutral keys without path components', () => {
    const keys = new Set(Array.from({ length: 100 }, () => createOpaqueEvidenceObjectKey()));
    expect(keys.size).toBe(100);
    for (const key of keys) {
      expect(isOpaqueEvidenceObjectKey(key)).toBe(true);
      expect(key).not.toMatch(/[\\/.:]/);
    }
  });
});
