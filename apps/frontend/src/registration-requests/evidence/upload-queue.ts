import { Platform } from 'react-native';

export type EvidenceCategory = 'IDENTITY_FRONT' | 'IDENTITY_BACK' | 'MINOR_CIVIL_IDENTITY' | 'REPRESENTATION_AUTHORITY' | 'RUT' | 'EXISTENCE_CERTIFICATE' | 'RESPONSIBLE_AUTHORITY' | 'OPERATION_PROOF' | 'ADULT_AUTHORIZATION' | 'ACADEMY_ACCOUNT_AUTHORIZATION';
type FileLike = Readonly<{ name: string; type: string; size: number }>;
export type EphemeralDocumentSource =
  | Readonly<{ kind: 'web'; file: FileLike }>
  | Readonly<{ kind: 'native'; uri: string; name: string; mimeType: string; size: number }>;

export type EvidenceUploadResult =
  | Readonly<{ kind: 'success'; evidence: Readonly<{ id: string; category: string; status: 'QUARANTINED' | 'SCANNING' | 'CLEAN' | 'REJECTED'; sizeBytes: number }> }>
  | Readonly<{ kind: 'connectivity-failure' | 'unavailable-backend' | 'session-expired' | 'version-conflict' | 'too-large' | 'unsupported' | 'rejected' }>;

export type EvidenceUploadTransport = Readonly<{
  upload: (input: Readonly<{
    requestId: string;
    expectedVersion: number;
    category: EvidenceCategory;
    source: EphemeralDocumentSource;
    idempotencyKey: string;
    accessToken?: string;
    signal: AbortSignal;
    onProgress: (progress: number) => void;
  }>) => Promise<EvidenceUploadResult>;
}>;

export type EvidenceQueueItem = Readonly<{
  id: string;
  category: EvidenceCategory;
  safeLabel: string;
  status: 'selected' | 'uploading' | 'scanning' | 'clean' | 'failed' | 'cancelled';
  progress?: number;
  evidenceId?: string;
  correctionReplacement?: true;
  error?: Exclude<EvidenceUploadResult['kind'], 'success'>;
}>;

type QueueDependencies = Readonly<{ transport: EvidenceUploadTransport; createIdempotencyKey?: () => string }>;
type UploadContext = Readonly<{ requestId: string; expectedVersion: number; accessToken?: string }>;

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

export class RegistrationEvidenceUploadQueue {
  private projected: EvidenceQueueItem[] = [];
  private readonly sources = new Map<string, EphemeralDocumentSource>();
  private readonly keys = new Map<string, string>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly dependencies: QueueDependencies) {}
  get items(): readonly EvidenceQueueItem[] { return Object.freeze([...this.projected]); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private emit() { this.listeners.forEach((listener) => listener()); }
  private replace(id: string, patch: Partial<EvidenceQueueItem>) { this.projected = this.projected.map((item) => item.id === id ? Object.freeze({ ...item, ...patch }) : item); this.emit(); }

  add(input: Readonly<{ category: EvidenceCategory; label: string; source: EphemeralDocumentSource }>): EvidenceQueueItem {
    for (const existing of this.projected.filter((item) => item.category === input.category)) {
      this.controllers.get(existing.id)?.abort();
      this.sources.delete(existing.id);
      this.keys.delete(existing.id);
    }
    this.projected = this.projected.filter((item) => item.category !== input.category);
    const id = createUuid();
    const item = Object.freeze({ id, category: input.category, safeLabel: input.label, status: 'selected' as const });
    this.sources.set(id, input.source);
    this.keys.set(id, (this.dependencies.createIdempotencyKey ?? createUuid)());
    this.projected = [...this.projected, item];
    this.emit();
    return item;
  }

  addReplacement(input: Readonly<{ category: EvidenceCategory; label: string; source: EphemeralDocumentSource }>, requestStatus: 'DRAFT' | 'SUBMITTED' | 'REQUIRES_CORRECTION' | 'APPROVED' | 'REJECTED'): EvidenceQueueItem {
    if (requestStatus !== 'REQUIRES_CORRECTION') throw new Error('evidence-replacement-not-allowed');
    const item = this.add(input);
    this.replace(item.id, { correctionReplacement: true });
    return this.projected.find((candidate) => candidate.id === item.id)!;
  }

  hasEphemeralReference(id: string): boolean { return this.sources.has(id); }

  hasCategory(category: EvidenceCategory): boolean {
    return this.projected.some((item) => item.category === category && item.status !== 'cancelled');
  }

  isCategoryClean(category: EvidenceCategory): boolean {
    return this.projected.some((item) => item.category === category && item.status === 'clean');
  }

  async uploadRequired(categories: readonly EvidenceCategory[], context: UploadContext): Promise<boolean> {
    for (const category of categories) {
      const item = [...this.projected].reverse().find((candidate) => candidate.category === category && candidate.status !== 'cancelled');
      if (!item) return false;
      if (item.status === 'selected' || item.status === 'failed') await this.upload(item.id, context);
      if (!this.isCategoryClean(category)) return false;
    }
    return true;
  }

  async upload(id: string, context: UploadContext): Promise<void> {
    const item = this.projected.find((candidate) => candidate.id === id);
    const source = this.sources.get(id);
    const idempotencyKey = this.keys.get(id);
    if (!item || !source || !idempotencyKey) return;
    const controller = new AbortController();
    this.controllers.set(id, controller);
    this.replace(id, { status: 'uploading', progress: undefined, error: undefined });
    try {
      const result = await this.dependencies.transport.upload({ ...context, category: item.category, source, idempotencyKey, signal: controller.signal, onProgress: (progress) => this.replace(id, { progress: Math.max(0, Math.min(100, Math.round(progress))) }) });
      if (controller.signal.aborted) { this.replace(id, { status: 'cancelled' }); return; }
      if (result.kind === 'success') {
        if (result.evidence.status === 'QUARANTINED' || result.evidence.status === 'REJECTED') {
          this.replace(id, { status: 'failed', error: result.evidence.status === 'QUARANTINED' ? 'unavailable-backend' : 'rejected', progress: 100 });
        } else this.replace(id, { status: result.evidence.status === 'CLEAN' ? 'clean' : 'scanning', progress: 100, evidenceId: result.evidence.id });
      } else {
        this.replace(id, { status: 'failed', error: result.kind });
      }
    } finally {
      controller.abort();
      this.controllers.delete(id);
    }
  }

  retry(id: string, context: UploadContext): Promise<void> { return this.upload(id, context); }
  cancel(id: string) { this.controllers.get(id)?.abort(); this.replace(id, { status: 'cancelled' }); }
  remove(id: string): boolean {
    const item = this.projected.find((candidate) => candidate.id === id);
    if (!item || item.status === 'uploading' || item.status === 'scanning' || item.status === 'clean') return false;
    this.controllers.get(id)?.abort();
    this.controllers.delete(id);
    this.sources.delete(id);
    this.keys.delete(id);
    this.projected = this.projected.filter((candidate) => candidate.id !== id);
    this.emit();
    return true;
  }

  clearEphemeralReferences(_reason: 'upload' | 'submit' | 'logout' | 'abandonment' | 'unmount') {
    this.controllers.forEach((controller) => controller.abort());
    this.controllers.clear();
    this.sources.clear();
    this.keys.clear();
  }

  dispose() { this.clearEphemeralReferences('unmount'); this.projected = []; this.listeners.clear(); }
}

function safeEvidence(value: unknown): EvidenceUploadResult {
  if (!value || typeof value !== 'object') return { kind: 'rejected' };
  const envelope = value as { data?: Record<string, unknown> };
  const item = envelope.data;
  if (!item || typeof item.id !== 'string' || typeof item.category !== 'string' || !['QUARANTINED', 'SCANNING', 'CLEAN', 'REJECTED'].includes(String(item.status)) || typeof item.sizeBytes !== 'number') return { kind: 'rejected' };
  return { kind: 'success', evidence: { id: item.id, category: item.category, status: item.status as 'QUARANTINED' | 'SCANNING' | 'CLEAN' | 'REJECTED', sizeBytes: item.sizeBytes } };
}

export function classifyEvidenceUploadFailure(status: number, code?: string): Exclude<EvidenceUploadResult['kind'], 'success'> {
  if (status === 401) return 'session-expired';
  if (status === 409 && code === 'registration_request_version_conflict') return 'version-conflict';
  if (status === 413) return 'too-large';
  if (status === 415) return 'unsupported';
  if (status >= 500) return 'unavailable-backend';
  return 'rejected';
}

function safeErrorCode(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export function createEvidenceUploadTransport(apiBaseUrl: string): EvidenceUploadTransport {
  return Object.freeze({
    upload: async (input) => {
      const form = new FormData();
      form.append('category', input.category);
      form.append('expectedVersion', String(input.expectedVersion));
      if (input.source.kind === 'web') form.append('file', input.source.file as unknown as Blob, input.source.file.name);
      else form.append('file', { uri: input.source.uri, name: input.source.name, type: input.source.mimeType } as unknown as Blob);
      const headers: Record<string, string> = { Accept: 'application/json', 'Idempotency-Key': input.idempotencyKey };
      if (input.accessToken) headers.Authorization = `Bearer ${input.accessToken}`;
      try {
        if (Platform.OS === 'web' && typeof XMLHttpRequest !== 'undefined') {
          return await new Promise<EvidenceUploadResult>((resolve) => {
            const xhr = new XMLHttpRequest();
            const abort = () => xhr.abort();
            input.signal.addEventListener('abort', abort, { once: true });
            xhr.open('POST', new URL(`/registration-requests/${encodeURIComponent(input.requestId)}/evidence`, apiBaseUrl).toString());
            Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
            xhr.upload.onprogress = (event) => { if (event.lengthComputable) input.onProgress((event.loaded / event.total) * 100); };
            xhr.onerror = () => resolve({ kind: 'connectivity-failure' });
            xhr.onabort = () => resolve({ kind: 'connectivity-failure' });
            xhr.onload = () => {
              if (xhr.status < 200 || xhr.status >= 300) {
                let code: string | undefined;
                try { code = safeErrorCode(JSON.parse(xhr.responseText)); } catch { /* The status alone remains safe to classify. */ }
                resolve({ kind: classifyEvidenceUploadFailure(xhr.status, code) });
                return;
              }
              try { resolve(safeEvidence(JSON.parse(xhr.responseText))); } catch { resolve({ kind: 'rejected' }); }
            };
            xhr.send(form);
          });
        }
        const response = await fetch(new URL(`/registration-requests/${encodeURIComponent(input.requestId)}/evidence`, apiBaseUrl).toString(), { method: 'POST', headers, body: form, signal: input.signal });
        if (!response.ok) {
          let code: string | undefined;
          try { code = safeErrorCode(await response.json()); } catch { /* The status alone remains safe to classify. */ }
          return { kind: classifyEvidenceUploadFailure(response.status, code) };
        }
        return safeEvidence(await response.json());
      } catch {
        return { kind: 'connectivity-failure' };
      }
    },
  });
}
