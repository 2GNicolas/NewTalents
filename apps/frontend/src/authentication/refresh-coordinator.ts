import type { AuthenticationResult, SessionMaterial } from './authentication-types';

export type CoordinatedRefreshResult = AuthenticationResult<SessionMaterial> | Readonly<{ kind: 'stale' }>;

export class RefreshCoordinator {
  private inFlight: Promise<CoordinatedRefreshResult> | null = null;
  private epoch = 0;
  private readonly replayedRequests = new Set<string>();

  get hasInFlightRefresh() { return this.inFlight !== null; }

  coordinate(refresh: () => Promise<AuthenticationResult<SessionMaterial>>): Promise<CoordinatedRefreshResult> {
    if (this.inFlight) return this.inFlight;
    const epoch = this.epoch;
    let flight!: Promise<CoordinatedRefreshResult>;
    flight = Promise.resolve()
      .then(refresh)
      .then((result) => epoch === this.epoch ? result : { kind: 'stale' } as const)
      .finally(() => { if (this.inFlight === flight) this.inFlight = null; });
    this.inFlight = flight;
    return flight;
  }

  claimReplay(requestId: string): boolean {
    if (this.replayedRequests.has(requestId)) return false;
    this.replayedRequests.add(requestId);
    return true;
  }

  invalidate() {
    this.epoch += 1;
    this.inFlight = null;
    this.replayedRequests.clear();
  }
}
