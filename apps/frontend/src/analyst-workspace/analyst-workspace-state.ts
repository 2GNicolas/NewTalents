import type { AnalystOverview, AnalystWorkspaceApi } from './analyst-workspace-api';

export type AnalystWorkspaceState = Readonly<{ kind: 'idle' | 'loading' | 'ready' | 'restricted' | 'error'; overview: AnalystOverview | null }>;

export class AnalystWorkspaceStateMachine {
  private current: AnalystWorkspaceState = { kind: 'idle', overview: null };
  private generation = 0;
  private readonly listeners = new Set<() => void>();
  private disposed = false;
  private readonly unsubscribeAccessLoss?: () => void;

  constructor(private readonly api: AnalystWorkspaceApi) {
    this.unsubscribeAccessLoss = api.onAccessLost?.(() => this.clear());
  }
  get state(): AnalystWorkspaceState { return this.current; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(next: AnalystWorkspaceState) {
    if (this.disposed) return;
    this.current = next;
    this.listeners.forEach((listener) => listener());
  }

  async load(): Promise<void> {
    const generation = ++this.generation;
    this.publish({ kind: 'loading', overview: null });
    const result = await this.api.overview();
    if (this.disposed || generation !== this.generation) return;
    this.publish(result.kind === 'success' ? { kind: 'ready', overview: result.value }
      : { kind: result.kind === 'restricted' ? 'restricted' : 'error', overview: null });
  }

  clear(): void { this.generation++; this.publish({ kind: 'restricted', overview: null }); }
  dispose(): void { this.unsubscribeAccessLoss?.(); this.disposed = true; this.generation++; this.listeners.clear(); this.current = { kind: 'idle', overview: null }; }
}
