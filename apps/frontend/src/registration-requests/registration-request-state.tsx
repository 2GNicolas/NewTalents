import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { useAuthentication } from '../authentication/authentication-provider';
import { loadPublicEnvironment } from '../config/public-environment';
import { createEvidenceUploadTransport, RegistrationEvidenceUploadQueue } from './evidence/upload-queue';
import {
  createRegistrationRequestApi,
  type RegistrationApiResult,
  type RegistrationDraft,
  type RegistrationRequestApi,
  type RegistrationRequestSnapshot,
} from './registration-request-api';

export type { RegistrationDraft, RegistrationRequestApi, RegistrationRequestSnapshot } from './registration-request-api';

type RegistrationNotice = 'version-conflict' | 'connectivity-failure' | 'unavailable-backend' | 'denied-or-not-found' | 'registration-conflict' | 'session-expired' | 'validation-error' | 'invalid-response';
type RegistrationPhase = 'idle' | 'loading' | 'ready' | 'saving' | 'submitting' | 'failed';
export type RegistrationRequestState = Readonly<{
  phase: RegistrationPhase;
  snapshot: RegistrationRequestSnapshot | null;
  draft: RegistrationDraft | null;
  notice?: RegistrationNotice;
  validationIssues: readonly Readonly<{ field: string; code: string; message?: string }>[];
}>;

type RetryableOperation = Readonly<{ kind: 'restore'; requestId: string }> | Readonly<{ kind: 'submit' | 'resubmit'; requestId: string; version: number; idempotencyKey: string }>;
type StateDependencies = Readonly<{ api: RegistrationRequestApi; createIdempotencyKey?: () => string; refreshCapabilities?: () => Promise<void>; evidenceQueue?: RegistrationEvidenceUploadQueue }>;

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const chars = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return chars.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

const initialState = (): RegistrationRequestState => Object.freeze({ phase: 'idle', snapshot: null, draft: null, validationIssues: Object.freeze([]) });

export class RegistrationRequestStateMachine {
  private current: RegistrationRequestState = initialState();
  private readonly listeners = new Set<() => void>();
  private retryable: RetryableOperation | null = null;
  private disposed = false;

  constructor(private readonly dependencies: StateDependencies) {}

  get state(): RegistrationRequestState { return this.current; }
  get evidenceQueue(): RegistrationEvidenceUploadQueue | undefined { return this.dependencies.evidenceQueue; }

  private safeDraft(draft: RegistrationDraft): RegistrationDraft {
    const credentials = 'credentials' in draft.details ? draft.details.credentials : undefined;
    const safeCredentials = credentials?.email ? { email: credentials.email } : undefined;
    return Object.freeze({ ...draft, details: Object.freeze({ ...draft.details, ...(safeCredentials ? { credentials: safeCredentials } : { credentials: undefined }) }) }) as RegistrationDraft;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(state: RegistrationRequestState) {
    if (this.disposed) return;
    this.current = Object.freeze(state);
    this.listeners.forEach((listener) => listener());
  }

  hydrate(snapshot: RegistrationRequestSnapshot) {
    this.setState({ phase: 'ready', snapshot, draft: this.current.draft?.type === snapshot.type ? this.current.draft : null, validationIssues: Object.freeze([]) });
  }

  async create(draft: RegistrationDraft, idempotencyKey?: string): Promise<boolean> {
    this.setState({ ...this.current, phase: 'saving', notice: undefined, validationIssues: Object.freeze([]) });
    const result = await this.dependencies.api.create(draft, idempotencyKey);
    if (result.kind === 'success') {
      this.setState({ phase: 'ready', snapshot: result.value, draft: this.safeDraft(draft), validationIssues: Object.freeze([]) });
      return true;
    }
    await this.apply(result, 'save');
    return false;
  }

  validateIdentity(input: Parameters<RegistrationRequestApi['validateIdentity']>[0]) {
    return this.dependencies.api.validateIdentity(input);
  }

  setDraft(draft: RegistrationDraft) {
    const changedType = this.current.draft !== null && this.current.draft.type !== draft.type;
    this.setState({ ...this.current, phase: this.current.snapshot ? 'ready' : 'idle', draft: this.safeDraft(draft), ...(changedType ? { notice: undefined } : {}) });
  }

  can(capability: string): boolean { return this.current.snapshot?.capabilities.includes(capability) ?? false; }

  async restore(requestId: string): Promise<boolean> {
    this.retryable = { kind: 'restore', requestId };
    this.setState({ ...this.current, phase: 'loading', notice: undefined, validationIssues: Object.freeze([]) });
    const result = await this.dependencies.api.read(requestId);
    await this.apply(result, 'restore');
    return result.kind === 'success';
  }

  async save(draftOverride?: RegistrationDraft): Promise<boolean> {
    const snapshot = this.current.snapshot;
    const draft = draftOverride ?? this.current.draft;
    if (!snapshot || !draft || !this.can('registration.request.own.edit-draft')) return false;
    this.setState({ ...this.current, phase: 'saving', draft: this.safeDraft(draft), notice: undefined, validationIssues: Object.freeze([]) });
    const result = await this.dependencies.api.update(snapshot.id, snapshot.version, draft);
    if (result.kind === 'version-conflict') {
      const latest = await this.dependencies.api.read(snapshot.id);
      await this.apply(latest, 'version-conflict');
      if (latest.kind !== 'success') return false;
      return this.saveOnce(draft);
    }
    await this.apply(result, 'save');
    return result.kind === 'success';
  }

  private async saveOnce(draftOverride?: RegistrationDraft): Promise<boolean> {
    const snapshot = this.current.snapshot;
    const draft = draftOverride ?? this.current.draft;
    if (!snapshot || !draft || !this.can('registration.request.own.edit-draft')) return false;
    this.setState({ ...this.current, phase: 'saving', draft: this.safeDraft(draft), notice: undefined, validationIssues: Object.freeze([]) });
    const result = await this.dependencies.api.update(snapshot.id, snapshot.version, draft);
    await this.apply(result, 'save');
    return result.kind === 'success';
  }

  setClientValidationIssues(issues: readonly Readonly<{ field: string; code: string; message?: string }>[]) {
    this.retryable = null;
    this.setState({ ...this.current, phase: 'failed', notice: 'validation-error', validationIssues: Object.freeze([...issues]) });
  }

  async submit(): Promise<boolean> { return this.transition('submit'); }
  async resubmit(): Promise<boolean> { return this.transition('resubmit'); }

  private async transition(kind: 'submit' | 'resubmit', retry?: RetryableOperation, recovered = false): Promise<boolean> {
    const snapshot = this.current.snapshot;
    if (!snapshot) return false;
    const capability = kind === 'submit' ? 'registration.request.own.submit' : 'registration.request.own.resubmit';
    if (!this.can(capability)) return false;
    const operation = retry && retry.kind !== 'restore'
      ? retry
      : { kind, requestId: snapshot.id, version: snapshot.version, idempotencyKey: (this.dependencies.createIdempotencyKey ?? createUuid)() } as const;
    this.retryable = operation;
    this.setState({ ...this.current, phase: 'submitting', notice: undefined, validationIssues: Object.freeze([]) });
    const result = await this.dependencies.api[kind](operation.requestId, operation.version, operation.idempotencyKey);
    if (result.kind === 'version-conflict' && !recovered) {
      const latest = await this.dependencies.api.read(operation.requestId);
      if (latest.kind !== 'success') { await this.apply(latest, 'version-conflict'); return false; }
      if (latest.value.status === 'SUBMITTED') {
        await this.apply(latest, kind);
        return true;
      }
      this.setState({ phase: 'ready', snapshot: latest.value, draft: this.current.draft, notice: 'version-conflict', validationIssues: Object.freeze([]) });
      const recoveredOperation = { ...operation, version: latest.value.version };
      this.retryable = recoveredOperation;
      return this.transition(kind, recoveredOperation, true);
    }
    await this.apply(result, kind);
    return result.kind === 'success' && result.value.status === 'SUBMITTED';
  }

  async retry(): Promise<boolean> {
    const operation = this.retryable;
    if (!operation) return false;
    if (operation.kind === 'restore') return this.restore(operation.requestId);
    return this.transition(operation.kind, operation);
  }

  private async apply(result: RegistrationApiResult<RegistrationRequestSnapshot>, context: 'restore' | 'save' | 'submit' | 'resubmit' | 'version-conflict') {
    if (result.kind === 'success') {
      this.retryable = null;
      const approved = result.value.status === 'APPROVED';
      if (result.value.status === 'SUBMITTED') this.dependencies.evidenceQueue?.clearEphemeralReferences('submit');
      this.setState({ phase: 'ready', snapshot: result.value, draft: approved || result.value.status === 'SUBMITTED' ? null : this.current.draft, ...(context === 'version-conflict' ? { notice: 'version-conflict' as const } : {}), validationIssues: Object.freeze([]) });
      if (approved) await this.dependencies.refreshCapabilities?.();
      return;
    }
    const notice: RegistrationNotice = result.kind;
    const retryable = result.kind === 'connectivity-failure' || result.kind === 'unavailable-backend';
    if (!retryable && result.kind !== 'version-conflict') this.retryable = null;
    this.setState({ ...this.current, phase: 'failed', notice, validationIssues: result.kind === 'validation-error' ? result.issues : Object.freeze([]) });
  }

  dispose() {
    this.retryable = null;
    this.current = initialState();
    this.dependencies.evidenceQueue?.dispose();
    this.disposed = true;
    this.listeners.clear();
  }
}

type RegistrationContextValue = Readonly<{ state: RegistrationRequestState; machine: RegistrationRequestStateMachine; uploadQueue: RegistrationEvidenceUploadQueue }>;
const RegistrationContext = createContext<RegistrationContextValue | null>(null);

export function RegistrationRequestProvider({ children, requestId, api }: PropsWithChildren<{ requestId?: string; api?: RegistrationRequestApi }>) {
  const authentication = useAuthentication();
  const uploadQueue = useRef<RegistrationEvidenceUploadQueue | null>(null);
  if (!uploadQueue.current) {
    const environment = loadPublicEnvironment();
    const transport = environment.ok
      ? createEvidenceUploadTransport(environment.apiBaseUrl)
      : { upload: async () => ({ kind: 'unavailable-backend' as const }) };
    uploadQueue.current = new RegistrationEvidenceUploadQueue({ transport });
  }
  const machine = useRef<RegistrationRequestStateMachine | null>(null);
  if (!machine.current) {
    const client = api ?? createRegistrationRequestApi({ getAccessToken: authentication.getAccessToken }, fetch);
    machine.current = new RegistrationRequestStateMachine({ api: client, refreshCapabilities: authentication.refreshCapabilities, evidenceQueue: uploadQueue.current });
  }
  const owner = machine.current;
  const [state, setState] = useState(owner.state);
  useEffect(() => owner.subscribe(() => setState(owner.state)), [owner]);
  useEffect(() => {
    if (requestId) void owner.restore(requestId);
    return () => owner.dispose();
  }, [owner, requestId]);
  useEffect(() => {
    if (authentication.state.phase === 'unauthenticated' || authentication.state.phase === 'session-expired') uploadQueue.current?.clearEphemeralReferences('logout');
  }, [authentication.state.phase]);
  const value = useMemo(() => Object.freeze({ state, machine: owner, uploadQueue: uploadQueue.current! }), [owner, state]);
  return <RegistrationContext.Provider value={value}>{children}</RegistrationContext.Provider>;
}

export function useRegistrationRequest(): RegistrationContextValue {
  const value = useContext(RegistrationContext);
  if (!value) throw new Error('useRegistrationRequest must be used within RegistrationRequestProvider');
  return value;
}
