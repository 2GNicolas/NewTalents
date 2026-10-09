import { loadPublicEnvironment, type FrontendPublicConfiguration } from '../config/public-environment';
import type { AuthenticationResult, InitialAccessInput, LoginInput, SessionMaterial } from './authentication-types';

export const AUTH_OPERATION_PATHS = Object.freeze({
  login: '/auth/login',
  activateInitialAccess: '/auth/initial-credential/replace',
  refresh: '/auth/refresh',
  logoutCurrent: '/auth/logout',
  logoutAll: '/auth/logout-all',
});

type ApiConfiguration = Readonly<{ apiBaseUrl: string }>;
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type AuthenticationApi = Readonly<{
  login: (input: LoginInput) => Promise<AuthenticationResult<SessionMaterial>>;
  activateInitialAccess: (input: InitialAccessInput) => Promise<AuthenticationResult<SessionMaterial>>;
  refresh: (refreshToken: string) => Promise<AuthenticationResult<SessionMaterial>>;
  logoutCurrent: (accessToken: string) => Promise<AuthenticationResult<void>>;
  logoutAll: (accessToken: string) => Promise<AuthenticationResult<void>>;
}>;

function configuredBaseUrl(configuration?: ApiConfiguration): string | null {
  if (configuration) return configuration.apiBaseUrl;
  const publicConfiguration: FrontendPublicConfiguration = loadPublicEnvironment();
  return publicConfiguration.ok ? publicConfiguration.apiBaseUrl : null;
}

function parseIssuedMaterial(value: unknown): SessionMaterial | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.accessToken !== 'string' || typeof candidate.refreshToken !== 'string' || candidate.tokenType !== 'Bearer' || typeof candidate.expiresIn !== 'number') return null;
  return Object.freeze({ accessToken: candidate.accessToken, refreshToken: candidate.refreshToken, tokenType: 'Bearer', expiresIn: candidate.expiresIn });
}

function retryAfter(response: Response): number | undefined {
  const value = response.headers.get('retry-after');
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function classify<T>(response: Response, isRefresh: boolean, parseSuccess: (value: unknown) => T | null): Promise<AuthenticationResult<T>> {
  if (response.ok) {
    if (response.status === 204) return { kind: 'success', value: undefined as T };
    try {
      const value = parseSuccess(await response.json());
      return value === null ? { kind: 'invalid-request' } : { kind: 'success', value };
    } catch {
      return { kind: 'invalid-request' };
    }
  }
  if (response.status === 429) return { kind: 'throttled', retryAfterSeconds: retryAfter(response) };
  if (isRefresh && (response.status === 401 || response.status === 409)) return { kind: 'rejected-refresh' };
  if (response.status === 401) return { kind: 'generic-authentication-failure' };
  if (response.status === 400) return { kind: 'invalid-request' };
  if (response.status >= 500) return { kind: 'unavailable-backend' };
  return { kind: 'invalid-request' };
}

export function createAuthenticationApi(configuration?: ApiConfiguration, fetcher: Fetcher = fetch): AuthenticationApi {
  const baseUrl = configuredBaseUrl(configuration);
  const request = async <T>(path: string, body?: object, accessToken?: string, isRefresh = false, parseSuccess: (value: unknown) => T | null = (value) => value as T): Promise<AuthenticationResult<T>> => {
    if (!baseUrl) return { kind: 'unavailable-backend' };
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (body) headers['Content-Type'] = 'application/json';
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const response = await fetcher(new URL(path, baseUrl).toString(), { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined });
      return await classify(response, isRefresh, parseSuccess);
    } catch {
      return { kind: 'connectivity-failure' };
    }
  };

  return Object.freeze({
    login: (input) => request(AUTH_OPERATION_PATHS.login, input, undefined, false, parseIssuedMaterial),
    activateInitialAccess: (input) => request(AUTH_OPERATION_PATHS.activateInitialAccess, input, undefined, false, parseIssuedMaterial),
    refresh: (refreshToken) => request(AUTH_OPERATION_PATHS.refresh, { refreshToken }, undefined, true, parseIssuedMaterial),
    logoutCurrent: (accessToken) => request<void>(AUTH_OPERATION_PATHS.logoutCurrent, undefined, accessToken),
    logoutAll: (accessToken) => request<void>(AUTH_OPERATION_PATHS.logoutAll, undefined, accessToken),
  });
}
