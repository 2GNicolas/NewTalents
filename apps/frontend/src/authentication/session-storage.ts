import { Platform } from 'react-native';

type WebStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type NativeSecureStore = Readonly<{
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}>;
type PlatformKind = 'web' | 'native';

export type SessionStorageOptions = Readonly<{
  platform?: PlatformKind;
  webStorage?: WebStorage;
  nativeSecureStore?: NativeSecureStore;
}>;

const refreshStorageKey = 'new-talents.auth.refresh';
const storageProbeKey = 'new-talents.auth.storage-probe';

function browserSessionStorage(): WebStorage | undefined {
  try { return globalThis.sessionStorage; } catch { return undefined; }
}

function defaultNativeSecureStore(): NativeSecureStore | undefined {
  try {
    // Loaded only on native execution paths. Expo Web never evaluates this module import.
    return require('expo-secure-store') as NativeSecureStore;
  } catch { return undefined; }
}

export class SessionStorage {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private readonly platform: PlatformKind;
  private readonly webStorage?: WebStorage;
  private readonly nativeSecureStore?: NativeSecureStore;
  private _persistence: 'web' | 'native' | 'memory' = 'memory';

  constructor(options: SessionStorageOptions = {}) {
    this.platform = options.platform ?? (Platform.OS === 'web' ? 'web' : 'native');
    this.webStorage = options.webStorage ?? (this.platform === 'web' ? browserSessionStorage() : undefined);
    this.nativeSecureStore = options.nativeSecureStore ?? (this.platform === 'native' ? defaultNativeSecureStore() : undefined);
    if (this.platform === 'web' && this.probeWebStorage()) this._persistence = 'web';
    if (this.platform === 'native' && this.nativeSecureStore) this._persistence = 'native';
  }

  get persistence() { return this._persistence; }

  getAccessToken(): string | null { return this.accessToken; }

  async getRefreshToken(): Promise<string | null> {
    try {
      if (this._persistence === 'web' && this.webStorage) return this.webStorage.getItem(refreshStorageKey) ?? this.refreshToken;
      if (this._persistence === 'native' && this.nativeSecureStore) return (await this.nativeSecureStore.getItemAsync(refreshStorageKey)) ?? this.refreshToken;
    } catch { this._persistence = 'memory'; }
    return this.refreshToken;
  }

  async save(material: Readonly<{ accessToken: string; refreshToken: string }>): Promise<void> {
    this.accessToken = material.accessToken;
    this.refreshToken = material.refreshToken;
    try {
      if (this._persistence === 'web' && this.webStorage) this.webStorage.setItem(refreshStorageKey, material.refreshToken);
      else if (this._persistence === 'native' && this.nativeSecureStore) await this.nativeSecureStore.setItemAsync(refreshStorageKey, material.refreshToken);
    } catch { this._persistence = 'memory'; }
  }

  async clear(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    const persistence = this._persistence;
    this._persistence = 'memory';
    try {
      if (persistence === 'web' && this.webStorage) this.webStorage.removeItem(refreshStorageKey);
      if (persistence === 'native' && this.nativeSecureStore) await this.nativeSecureStore.deleteItemAsync(refreshStorageKey);
    } catch { /* local memory has already been cleared safely */ }
  }

  private probeWebStorage(): boolean {
    if (!this.webStorage) return false;
    try {
      this.webStorage.setItem(storageProbeKey, '1');
      const valid = this.webStorage.getItem(storageProbeKey) === '1';
      this.webStorage.removeItem(storageProbeKey);
      return valid;
    } catch { return false; }
  }
}
