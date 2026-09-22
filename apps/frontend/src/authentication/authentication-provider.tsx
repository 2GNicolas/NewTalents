import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { createAuthenticationApi, type AuthenticationApi } from './authentication-api';
import { AuthenticationStateMachine, type AuthenticationState } from './authentication-state';
import type { AuthenticationResult, InitialAccessInput, LoginInput, SessionMaterial } from './authentication-types';
import { RefreshCoordinator, type CoordinatedRefreshResult } from './refresh-coordinator';
import { SessionStorage } from './session-storage';

type LogoutScope = 'current' | 'all';
type ProviderDependencies = Readonly<{ api?: AuthenticationApi; storage?: SessionStorage; refreshCoordinator?: RefreshCoordinator; stateMachine?: AuthenticationStateMachine }>;

export type AuthenticationProviderValue = Readonly<{
  state: AuthenticationState;
  restore: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  activateInitialAccess: (input: InitialAccessInput) => Promise<void>;
  prepareLogin: () => void;
  prepareActivation: () => void;
  continueAfterActivation: () => void;
  refresh: () => Promise<void>;
  logout: (scope: LogoutScope) => Promise<void>;
  clearLocalSession: () => Promise<void>;
  getAccessToken: () => string | null;
}>;

const AuthenticationContext = createContext<AuthenticationProviderValue | null>(null);

function isRetryable(result: AuthenticationResult<unknown>) {
  return result.kind === 'connectivity-failure' || result.kind === 'unavailable-backend';
}

export function AuthenticationProvider({ children, dependencies }: PropsWithChildren<{ dependencies?: ProviderDependencies }>) {
  const api = useRef<AuthenticationApi>(dependencies?.api ?? createAuthenticationApi()).current;
  const storage = useRef<SessionStorage>(dependencies?.storage ?? new SessionStorage()).current;
  const coordinator = useRef<RefreshCoordinator>(dependencies?.refreshCoordinator ?? new RefreshCoordinator()).current;
  const machine = useRef<AuthenticationStateMachine>(dependencies?.stateMachine ?? new AuthenticationStateMachine()).current;
  const [state, setState] = useState<AuthenticationState>(machine.state);
  const mounted = useRef(true);
  const sync = useCallback(() => { if (mounted.current) setState(machine.state); }, [machine]);

  const clearLocalSession = useCallback(async () => {
    coordinator.invalidate();
    await storage.clear();
    machine.completeUnauthenticated();
    sync();
  }, [coordinator, machine, storage, sync]);

  const applyRefresh = useCallback(async (refreshToken: string, restoration: boolean) => {
    const started = restoration ? machine.beginRestorationRefresh() : machine.beginRefresh();
    if (!started) return;
    sync();
    const result: CoordinatedRefreshResult = await coordinator.coordinate(() => api.refresh(refreshToken));
    if (result.kind === 'stale' || !mounted.current) return;
    if (result.kind === 'success') {
      await storage.save(result.value);
      machine.completeAuthenticated();
    } else if (result.kind === 'rejected-refresh') {
      coordinator.invalidate();
      await storage.clear();
      machine.completeSessionExpired();
    } else if (result.kind === 'connectivity-failure') {
      if (restoration) machine.completeConnectivityFailure();
      else machine.completeRetryableSessionFailure('connectivity-failure');
    } else {
      if (restoration) machine.completeBackendUnavailable();
      else machine.completeRetryableSessionFailure('backend-unavailable');
    }
    sync();
  }, [api, coordinator, machine, storage, sync]);

  const restore = useCallback(async () => {
    const refreshToken = await storage.getRefreshToken();
    if (!refreshToken) {
      machine.completeRestorationWithoutSession();
      sync();
      return;
    }
    await applyRefresh(refreshToken, true);
  }, [applyRefresh, machine, storage, sync]);

  const completeSessionOperation = useCallback(async (result: AuthenticationResult<SessionMaterial>) => {
    if (result.kind === 'success') {
      await storage.save(result.value);
      machine.completeAuthenticated();
    } else if (result.kind === 'connectivity-failure') machine.completeUnauthenticated('connectivity-failure');
    else if (result.kind === 'unavailable-backend') machine.completeUnauthenticated('backend-unavailable');
    else machine.completeUnauthenticated(result.kind);
    sync();
  }, [machine, storage, sync]);

  const login = useCallback(async (input: LoginInput) => {
    machine.recordLoginSecret(input.password);
    if (!machine.beginLogin()) { machine.clearSecrets(); return; }
    sync();
    await completeSessionOperation(await api.login(input));
  }, [api, completeSessionOperation, machine, sync]);

  const activateInitialAccess = useCallback(async (input: InitialAccessInput) => {
    machine.recordActivationSecrets(input.temporaryCredential, input.newPassword);
    if (!machine.beginActivation()) { machine.clearSecrets(); return; }
    sync();
    const result = await api.activateInitialAccess(input);
    if (result.kind === 'success') {
      await storage.save(result.value);
      machine.completeActivationSucceeded();
    } else if (result.kind === 'unavailable-backend') machine.completeActivationFailure('backend-unavailable');
    else machine.completeActivationFailure(result.kind);
    sync();
  }, [api, machine, storage, sync]);

  const continueAfterActivation = useCallback(() => {
    if (machine.continueAfterActivation()) sync();
  }, [machine, sync]);

  const prepareLogin = useCallback(() => {
    if (machine.prepareLogin()) sync();
  }, [machine, sync]);

  const prepareActivation = useCallback(() => {
    if (machine.prepareActivation()) sync();
  }, [machine, sync]);

  const refresh = useCallback(async () => {
    const refreshToken = await storage.getRefreshToken();
    if (!refreshToken) {
      machine.completeSessionExpired();
      sync();
      return;
    }
    await applyRefresh(refreshToken, false);
  }, [applyRefresh, machine, storage, sync]);

  const logout = useCallback(async (scope: LogoutScope) => {
    if (!machine.beginLogout(scope)) return;
    sync();
    const accessToken = storage.getAccessToken();
    if (!accessToken) {
      await clearLocalSession();
      return;
    }
    const result = scope === 'current' ? await api.logoutCurrent(accessToken) : await api.logoutAll(accessToken);
    if (result.kind === 'success' || result.kind === 'generic-authentication-failure') {
      await clearLocalSession();
      return;
    }
    if (isRetryable(result)) {
      if (result.kind === 'connectivity-failure') machine.completeRetryableSessionFailure('connectivity-failure');
      else machine.completeRetryableSessionFailure('backend-unavailable');
      sync();
      return;
    }
    await clearLocalSession();
  }, [api, clearLocalSession, machine, storage, sync]);

  const getAccessToken = useCallback(() => storage.getAccessToken(), [storage]);

  useEffect(() => {
    void restore();
    return () => {
      mounted.current = false;
      coordinator.invalidate();
      machine.dispose();
    };
  }, [coordinator, machine, restore]);

  const value = useMemo<AuthenticationProviderValue>(() => Object.freeze({ state, restore, login, activateInitialAccess, prepareLogin, prepareActivation, continueAfterActivation, refresh, logout, clearLocalSession, getAccessToken }), [activateInitialAccess, clearLocalSession, continueAfterActivation, getAccessToken, login, logout, prepareActivation, prepareLogin, refresh, restore, state]);
  return <AuthenticationContext.Provider value={value}>{children}</AuthenticationContext.Provider>;
}

export function useAuthentication(): AuthenticationProviderValue {
  const value = useContext(AuthenticationContext);
  if (!value) throw new Error('useAuthentication must be used within AuthenticationProvider');
  return value;
}
