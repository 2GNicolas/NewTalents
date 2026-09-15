import { RefreshCoordinator } from './refresh-coordinator';

const successfulRefresh = { kind: 'success' as const, value: { accessToken: 'test-access-not-usable', refreshToken: 'test-refresh-not-usable', tokenType: 'Bearer' as const, expiresIn: 900 } };

describe('RefreshCoordinator', () => {
  it('shares exactly one refresh flight and allows an eligible request one replay', async () => {
    let resolveRefresh!: (value: typeof successfulRefresh) => void;
    const refresh = jest.fn(() => new Promise<typeof successfulRefresh>((resolve) => { resolveRefresh = resolve; }));
    const coordinator = new RefreshCoordinator();

    const first = coordinator.coordinate(refresh);
    const second = coordinator.coordinate(refresh);
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
    resolveRefresh(successfulRefresh);
    await expect(Promise.all([first, second])).resolves.toEqual([successfulRefresh, successfulRefresh]);
    expect(coordinator.claimReplay('request-1')).toBe(true);
    expect(coordinator.claimReplay('request-1')).toBe(false);
  });

  it('makes stale completion harmless after invalidation and does not recursively refresh', async () => {
    let resolveRefresh!: (value: typeof successfulRefresh) => void;
    const coordinator = new RefreshCoordinator();
    const flight = coordinator.coordinate(() => new Promise<typeof successfulRefresh>((resolve) => { resolveRefresh = resolve; }));

    await Promise.resolve();
    coordinator.invalidate();
    resolveRefresh(successfulRefresh);
    await expect(flight).resolves.toEqual({ kind: 'stale' });
    expect(coordinator.hasInFlightRefresh).toBe(false);
  });
});
