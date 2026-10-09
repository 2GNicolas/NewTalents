import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, readdir, realpath, rm, unlink } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { createOpaqueEvidenceObjectKey, isOpaqueEvidenceObjectKey, type EvidenceDeleteResult, type EvidenceObjectKey, type EvidenceOrphanCandidate, type EvidencePutInput, type EvidencePutResult, type PrivateEvidenceStore } from './private-evidence-store.js';

function notFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

export class LocalPrivateEvidenceStore implements PrivateEvidenceStore {
  private readonly root: string;

  constructor(privateRoot: string) {
    if (!isAbsolute(privateRoot)) throw new Error('Private evidence root must be absolute');
    const root = resolve(privateRoot);
    const segments = root.toLowerCase().split(/[\\/]+/);
    if (segments.includes('public') || segments.includes('static')) throw new Error('Private evidence root must be outside public/static directories');
    this.root = root;
  }

  async put(input: EvidencePutInput): Promise<EvidencePutResult> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const objectKey = createOpaqueEvidenceObjectKey();
    const destination = this.objectPath(objectKey);
    try {
      await pipeline(input.body, createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
      return Object.freeze({ objectKey });
    } catch (error) {
      await rm(destination, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async openStream(objectKey: EvidenceObjectKey) {
    const path = this.objectPath(objectKey);
    const valid = await this.regularContainedFile(path);
    if (valid === null) return null;
    return createReadStream(valid);
  }

  async delete(objectKey: EvidenceObjectKey): Promise<EvidenceDeleteResult> {
    const path = this.objectPath(objectKey);
    const valid = await this.regularContainedFile(path);
    if (valid === null) return Object.freeze({ verifiedAbsent: true });
    await unlink(valid);
    return Object.freeze({ verifiedAbsent: !(await this.exists(objectKey)) });
  }

  async exists(objectKey: EvidenceObjectKey): Promise<boolean> {
    const path = this.objectPath(objectKey);
    try {
      return (await this.regularContainedFile(path)) !== null;
    } catch {
      return false;
    }
  }

  async listOrphanCandidates(olderThan: Date): Promise<readonly EvidenceOrphanCandidate[]> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const entries = await readdir(this.root, { withFileTypes: true });
    const candidates: EvidenceOrphanCandidate[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || entry.isSymbolicLink() || !isOpaqueEvidenceObjectKey(entry.name)) continue;
      const path = this.objectPath(entry.name);
      const metadata = await lstat(path);
      if (metadata.birthtime < olderThan) candidates.push(Object.freeze({ objectKey: entry.name, createdAt: metadata.birthtime }));
    }
    return Object.freeze(candidates);
  }

  private objectPath(objectKey: EvidenceObjectKey): string {
    if (!isOpaqueEvidenceObjectKey(objectKey)) throw new Error('Invalid evidence object key');
    const candidate = resolve(this.root, objectKey);
    const fromRoot = relative(this.root, candidate);
    if (!fromRoot || fromRoot.startsWith(`..${sep}`) || fromRoot === '..' || isAbsolute(fromRoot)) throw new Error('Evidence object escaped private root');
    return candidate;
  }

  private async regularContainedFile(path: string): Promise<string | null> {
    try {
      const metadata = await lstat(path);
      if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('Evidence object is not a regular private file');
      const canonicalRoot = await realpath(this.root);
      const canonicalFile = await realpath(path);
      const fromRoot = relative(canonicalRoot, canonicalFile);
      if (!fromRoot || fromRoot.startsWith(`..${sep}`) || fromRoot === '..' || isAbsolute(fromRoot)) throw new Error('Evidence object escaped private root');
      return canonicalFile;
    } catch (error) {
      if (notFound(error)) return null;
      throw error;
    }
  }
}
