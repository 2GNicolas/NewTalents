import { loadPublicEnvironment, type FrontendPublicConfiguration } from '../config/public-environment';
import type { CreateDraftInput, CreateRepresentationConfirmationInput, EditableDraftResponse, EditDraftInput, InternalPassportHistoryResponse, PassportApiResult, PassportHistoryResponse, PassportListContext, PassportListResponse, PassportPresentationResponse, PassportStatusResponse, RepresentationConfirmationResponse, ResolveDuplicateInput, ReturnInput, VersionInput } from './passport-types';

export const PASSPORT_OPERATION_PATHS = Object.freeze({
  representationConfirmation: '/passport-representation-confirmations', list: '/passports', createDraft: '/passports/drafts', status: '/passports/:passportId', presentation: '/passports/:passportId/presentation', editableDraft: '/passports/:passportId/draft', editDraft: '/passports/:passportId/draft', submit: '/passports/:passportId/submit', returnForCorrection: '/passports/:passportId/return', resolveDuplicate: '/passports/:passportId/possible-duplicate/resolve', approve: '/passports/:passportId/approve', activate: '/passports/:passportId/activate', history: '/passports/:passportId/history', internalHistory: '/passports/:passportId/internal-history',
});

type ApiConfiguration = Readonly<{ apiBaseUrl: string }>;
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type HttpMethod = 'GET' | 'POST' | 'PATCH';
export type PassportListRequest = Readonly<{ context: PassportListContext; academyId?: string }>;

export type PassportApi = Readonly<{
  createRepresentationConfirmation: (input: CreateRepresentationConfirmationInput, token: string) => Promise<PassportApiResult<RepresentationConfirmationResponse>>;
  list: (request: PassportListRequest, token: string) => Promise<PassportApiResult<PassportListResponse>>;
  createDraft: (input: CreateDraftInput, token: string) => Promise<PassportApiResult<PassportStatusResponse>>;
  status: (passportId: string, token: string) => Promise<PassportApiResult<PassportStatusResponse>>;
  presentation: (passportId: string, token: string) => Promise<PassportApiResult<PassportPresentationResponse>>;
  editableDraft: (passportId: string, token: string) => Promise<PassportApiResult<EditableDraftResponse>>;
  editDraft: (passportId: string, input: EditDraftInput, token: string) => Promise<PassportApiResult<PassportStatusResponse>>;
  submit: (passportId: string, input: VersionInput, token: string) => Promise<PassportApiResult<PassportStatusResponse>>;
  returnForCorrection: (passportId: string, input: ReturnInput, token: string) => Promise<PassportApiResult<PassportStatusResponse>>;
  resolveDuplicate: (passportId: string, input: ResolveDuplicateInput, token: string) => Promise<PassportApiResult<PassportStatusResponse>>;
  approve: (passportId: string, input: VersionInput, token: string) => Promise<PassportApiResult<PassportStatusResponse>>;
  activate: (passportId: string, input: VersionInput, token: string) => Promise<PassportApiResult<PassportStatusResponse>>;
  history: (passportId: string, token: string) => Promise<PassportApiResult<PassportHistoryResponse>>;
  internalHistory: (passportId: string, token: string) => Promise<PassportApiResult<InternalPassportHistoryResponse>>;
}>;

function configuredBaseUrl(configuration?: ApiConfiguration): string | null {
  if (configuration) return configuration.apiBaseUrl;
  const publicConfiguration: FrontendPublicConfiguration = loadPublicEnvironment();
  return publicConfiguration.ok ? publicConfiguration.apiBaseUrl : null;
}
function path(template: string, passportId: string): string { return template.replace(':passportId', encodeURIComponent(passportId)); }
function object<T>(value: unknown): T | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as T : null; }
function listPath(request: PassportListRequest): string {
  const query = new URLSearchParams({ context: request.context });
  if (request.context === 'ACADEMY' && request.academyId) query.set('academyId', request.academyId);
  return `${PASSPORT_OPERATION_PATHS.list}?${query.toString()}`;
}
async function classify<T>(response: Response, parse: (value: unknown) => T | null): Promise<PassportApiResult<T>> {
  if (response.ok) {
    try { const value = parse(await response.json()); return value === null ? { kind: 'unavailable-backend' } : { kind: 'success', value }; }
    catch { return { kind: 'unavailable-backend' }; }
  }
  if (response.status === 400) return { kind: 'validation' };
  if (response.status === 401) return { kind: 'authentication-failed' };
  if (response.status === 403) return { kind: 'forbidden' };
  if (response.status === 404) return { kind: 'not-found-safe' };
  if (response.status === 409) {
    try {
      const body = await response.json() as { code?: unknown };
      if (body.code === 'duplicate_passport') return { kind: 'duplicate-passport' };
      if (body.code === 'unresolved_duplicate_signal') return { kind: 'unresolved-signal' };
    } catch { /* discard non-disclosing conflict body */ }
    return { kind: 'invalid-state' };
  }
  return response.status >= 500 ? { kind: 'unavailable-backend' } : { kind: 'validation' };
}

export function createPassportApi(configuration?: ApiConfiguration, fetcher: Fetcher = fetch): PassportApi {
  const baseUrl = configuredBaseUrl(configuration);
  const request = async <T>(route: string, method: HttpMethod, body: object | undefined, token: string, parse: (value: unknown) => T | null): Promise<PassportApiResult<T>> => {
    if (!baseUrl) return { kind: 'unavailable-backend' };
    try {
      const headers: Record<string, string> = { Accept: 'application/json', Authorization: `Bearer ${token}` };
      if (body) headers['Content-Type'] = 'application/json';
      const response = await fetcher(new URL(route, baseUrl).toString(), { method, headers, body: body ? JSON.stringify(body) : undefined });
      return classify(response, parse);
    } catch { return { kind: 'connectivity-failure' }; }
  };
  const statusMutation = (route: string, passportId: string, method: HttpMethod, body: object | undefined, token: string) => request<PassportStatusResponse>(path(route, passportId), method, body, token, object);
  return Object.freeze({
    createRepresentationConfirmation: (input, token) => request<RepresentationConfirmationResponse>(PASSPORT_OPERATION_PATHS.representationConfirmation, 'POST', input, token, object),
    list: (listRequest, token) => request<PassportListResponse>(listPath(listRequest), 'GET', undefined, token, object),
    createDraft: (input, token) => request<PassportStatusResponse>(PASSPORT_OPERATION_PATHS.createDraft, 'POST', input, token, object),
    status: (id, token) => statusMutation(PASSPORT_OPERATION_PATHS.status, id, 'GET', undefined, token),
    presentation: (id, token) => request<PassportPresentationResponse>(path(PASSPORT_OPERATION_PATHS.presentation, id), 'GET', undefined, token, object),
    editableDraft: (id, token) => request<EditableDraftResponse>(path(PASSPORT_OPERATION_PATHS.editableDraft, id), 'GET', undefined, token, object),
    editDraft: (id, input, token) => statusMutation(PASSPORT_OPERATION_PATHS.editDraft, id, 'PATCH', input, token),
    submit: (id, input, token) => statusMutation(PASSPORT_OPERATION_PATHS.submit, id, 'POST', input, token),
    returnForCorrection: (id, input, token) => statusMutation(PASSPORT_OPERATION_PATHS.returnForCorrection, id, 'POST', input, token),
    resolveDuplicate: (id, input, token) => statusMutation(PASSPORT_OPERATION_PATHS.resolveDuplicate, id, 'POST', input, token),
    approve: (id, input, token) => statusMutation(PASSPORT_OPERATION_PATHS.approve, id, 'POST', input, token),
    activate: (id, input, token) => statusMutation(PASSPORT_OPERATION_PATHS.activate, id, 'POST', input, token),
    history: (id, token) => request<PassportHistoryResponse>(path(PASSPORT_OPERATION_PATHS.history, id), 'GET', undefined, token, object),
    internalHistory: (id, token) => request<InternalPassportHistoryResponse>(path(PASSPORT_OPERATION_PATHS.internalHistory, id), 'GET', undefined, token, object),
  });
}
