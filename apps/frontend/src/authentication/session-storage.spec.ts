import { SessionStorage } from './session-storage';

const session = { accessToken: 'test-access-not-usable', refreshToken: 'test-refresh-not-usable' };

function createWebStorage(shouldThrow = false) {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => { if (shouldThrow) throw new Error('blocked'); return values.get(key) ?? null; }),
    setItem: jest.fn((key: string, value: string) => { if (shouldThrow) throw new Error('blocked'); values.set(key, value); }),
    removeItem: jest.fn((key: string) => { if (shouldThrow) throw new Error('blocked'); values.delete(key); }),
  };
}

describe('SessionStorage', () => {
  it('keeps access material in memory while persisting only renewable material to safe web session storage', async () => {
    const webStorage = createWebStorage();
    const storage = new SessionStorage({ platform: 'web', webStorage });

    await storage.save(session);
    expect(storage.getAccessToken()).toBe(session.accessToken);
    expect(await storage.getRefreshToken()).toBe(session.refreshToken);
    expect(webStorage.setItem).toHaveBeenCalled();
    expect(JSON.stringify(webStorage.setItem.mock.calls)).not.toContain(session.accessToken);
  });

  it('falls back to memory when browser session storage is unavailable or blocked and never uses local storage', async () => {
    const storage = new SessionStorage({ platform: 'web', webStorage: createWebStorage(true) });

    await storage.save(session);
    expect(storage.persistence).toBe('memory');
    expect(await storage.getRefreshToken()).toBe(session.refreshToken);
    expect((globalThis as { localStorage?: unknown }).localStorage).toBeUndefined();
  });

  it('uses the injected native secure store and clears every local credential atomically', async () => {
    const nativeSecureStore = {
      getItemAsync: jest.fn().mockResolvedValue('test-refresh-not-usable'),
      setItemAsync: jest.fn().mockResolvedValue(undefined),
      deleteItemAsync: jest.fn().mockResolvedValue(undefined),
    };
    const storage = new SessionStorage({ platform: 'native', nativeSecureStore });

    await storage.save(session);
    await storage.clear();

    expect(nativeSecureStore.setItemAsync).toHaveBeenCalledWith('new-talents.auth.refresh', session.refreshToken);
    expect(nativeSecureStore.deleteItemAsync).toHaveBeenCalledWith('new-talents.auth.refresh');
    expect(storage.getAccessToken()).toBeNull();
    expect(await storage.getRefreshToken()).toBeNull();
  });
});
