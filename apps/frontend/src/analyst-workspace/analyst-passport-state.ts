import type { AnalystPassportDetail, AnalystPassportPage, AnalystPassportResult, AnalystWorkspaceApi } from './analyst-workspace-api';

export type PassportViewState<T> = Readonly<{ kind: 'idle' | 'loading' | 'ready' | 'restricted' | 'error'; value: T | null }>;

export class AnalystPassportStateMachine<T> {
  private current: PassportViewState<T> = { kind: 'idle', value: null };
  private generation = 0;
  private disposed = false;
  private listeners = new Set<() => void>();
  private readonly unsubscribeAccessLoss?: () => void;
  constructor(private readonly read: () => Promise<AnalystPassportResult<T>>, onAccessLost?: (listener: () => void) => () => void) {
    this.unsubscribeAccessLoss = onAccessLost?.(() => this.clear());
  }
  get state() { return this.current; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(value: PassportViewState<T>) {
    if (this.disposed) return;
    this.current = value;
    this.listeners.forEach((listener) => listener());
  }
  async load() {
    const generation = ++this.generation;
    this.publish({ kind: 'loading', value: null });
    const result = await this.read();
    if (this.disposed || generation !== this.generation) return;
    this.publish(result.kind === 'success' ? { kind: 'ready', value: result.value }
      : { kind: result.kind === 'restricted' ? 'restricted' : 'error', value: null });
  }
  clear() { this.generation++; this.publish({ kind: 'restricted', value: null }); }
  dispose() { this.unsubscribeAccessLoss?.(); this.disposed = true; this.generation++; this.listeners.clear(); this.current = { kind: 'idle', value: null }; }
}

export function passportListState(api: AnalystWorkspaceApi) { return new AnalystPassportStateMachine(() => api.passports(), api.onAccessLost); }
export function passportDetailState(api: AnalystWorkspaceApi, passportId: string) {
  return new AnalystPassportStateMachine(() => api.passport(passportId), api.onAccessLost);
}
