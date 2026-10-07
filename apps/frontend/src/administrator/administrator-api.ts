import { loadPublicEnvironment } from '../config/public-environment';
import {
  createRegistrationRequestApi,
  REGISTRATION_REQUEST_TYPES,
  type RegistrationApiResult,
  type RegistrationRequestApi,
  type RegistrationRequestSnapshot,
  type RegistrationRequestStatus,
  type RegistrationRequestType,
} from '../registration-requests/registration-request-api';

export const OPERATIONAL_GROUPS = ['NEW', 'CONTINUE_REVIEW', 'REQUIRES_CORRECTION', 'READY_FOR_DECISION', 'WAITING_EVIDENCE_DELETION'] as const;
const NEXT_ACTIONS = ['REVIEW', 'CONTINUE', 'VIEW_CORRECTION', 'DECIDE', 'VIEW_DELETION'] as const;

export type OperationalGroup = typeof OPERATIONAL_GROUPS[number];
export type OperationalNextAction = typeof NEXT_ACTIONS[number];
export type OperationalRequest = Readonly<{
  requestId: string;
  requestVersion: number;
  maskedReference: string;
  displayLabel: string;
  requestType: RegistrationRequestType;
  operationalGroup: OperationalGroup;
  relevantAt: string;
  nextAction: OperationalNextAction;
}>;
export type OperationalGroupView = Readonly<{ group: OperationalGroup; total: number; items: readonly OperationalRequest[] }>;
export type RequestOperationsFilters = Readonly<{ query?: string; requestType?: RegistrationRequestType }>;
export type CompleteRequestFilters = Readonly<{ type?: RegistrationRequestType; status?: RegistrationRequestStatus }>;
export type ReviewProgressCommand = Readonly<{ expectedRequestVersion: number; stage: 'OPENED' | 'REVIEWED' }>;
export type EligibleAnalystSummary = Readonly<{ identityId: string; displayLabel: string; activeCustodyCount: number }>;
export type CustodyAssignmentFilter = 'ALL' | 'UNASSIGNED' | 'ASSIGNED';
export type CustodyPassportSummary = Readonly<{
  passportId: string;
  maskedReference: string;
  displayLabel: string;
  lifecycleState: 'ACTIVE';
  enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT';
  academyLabel?: string;
  custody: Readonly<{ state: 'UNASSIGNED'; version: number }> | Readonly<{ state: 'ASSIGNED'; version: number; analyst: EligibleAnalystSummary; assignedAt: string }>;
  capabilities: readonly ('ASSIGN' | 'CHANGE' | 'REMOVE')[];
}>;
export type CustodySafeLink = Readonly<{ id: string; maskedReference: string; displayLabel?: string; status: string; available: boolean }>;
export type CustodyHistoryEntry = Readonly<{
  eventId: string; at: string; action: 'ASSIGNED' | 'CHANGED' | 'REMOVED'; actorLabel: string;
  previousAnalystLabel?: string; nextAnalystLabel?: string; reason?: string;
}>;
export type CustodyPassportDetail = CustodyPassportSummary & Readonly<{
  originRequest: CustodySafeLink;
  linkedDossier: CustodySafeLink;
  history: readonly CustodyHistoryEntry[];
}>;
export type CustodyPassportFilters = Readonly<{ assignment: CustodyAssignmentFilter; query?: string; analystId?: string; limit: number }>;
export type CustodyAnalystFilters = Readonly<{ query?: string; limit: number }>;
export type AssignCustodyCommand = Readonly<{ expectedVersion: number; idempotencyKey: string; analystIdentityId: string }>;
export type ChangeCustodyCommand = AssignCustodyCommand & Readonly<{ reason: string }>;
export type RemoveCustodyCommand = Readonly<Omit<ChangeCustodyCommand, 'analystIdentityId'>>;
export type CustodyAppliedResponse = Readonly<{
  data: Readonly<{ passportId: string; eventId: string; custody: Readonly<{ state: 'ASSIGNED'; version: number; analystIdentityId: string; assignedAt: string }> | Readonly<{ state: 'UNASSIGNED'; version: number }> }>;
  idempotent: boolean;
}>;
export type CustodyConflictState =
  | Readonly<{ state: 'UNASSIGNED'; version: number }>
  | Readonly<{ state: 'ASSIGNED'; version: number; analystIdentityId: string; assignedAt?: string }>;
export type DossierStatus = 'CONFIRMED' | 'DELETION_PENDING' | 'RECOVERY_REQUIRED' | 'APPROVED';
export type DossierSafeLink = Readonly<{ id: string; maskedReference: string; displayLabel?: string; status: string; available: boolean }>;
export type DossierPassportLink = DossierSafeLink | Readonly<{ notApplicable: true }>;
export type DossierSummary = Readonly<{ dossierId: string; dossierName: string | null; maskedReference: string; displayLabel: string; status: DossierStatus; confirmedAt: string; requestType: RegistrationRequestType; originRequest: DossierSafeLink; linkedPassport: DossierPassportLink }>;
export type DossierHistoryEntry = Readonly<{ at: string; action: 'DOSSIER_CONFIRMED' | 'EVIDENCE_DELETION_VERIFIED' | 'APPROVAL_FINALIZED'; actorLabel: 'ADMINISTRATOR' | 'SYSTEM' }>;
export type DossierDetail = DossierSummary & Readonly<{ confirmationHistory: readonly DossierHistoryEntry[] }>;
export type DossierFilters = Readonly<{ query?: string; status?: DossierStatus; requestType?: RegistrationRequestType; confirmedFrom?: string; confirmedTo?: string; limit: number }>;

export type AdministratorApiResult<T> =
  | Readonly<{ kind: 'success'; value: T }>
  | Readonly<{ kind: 'version-conflict' }>
  | Readonly<{ kind: 'custody-conflict'; current: CustodyConflictState }>
  | Readonly<{ kind: 'idempotency-conflict'; current: CustodyConflictState }>
  | Readonly<{ kind: 'session-expired' }>
  | Readonly<{ kind: 'restricted' }>
  | Readonly<{ kind: 'connectivity-failure' }>
  | Readonly<{ kind: 'unavailable' }>
  | Readonly<{ kind: 'invalid-response' }>;

type Page = Readonly<{ items: readonly RegistrationRequestSnapshot[]; nextCursor?: string }>;
type ApiConfiguration = Readonly<{ apiBaseUrl?: string; getAccessToken?: () => string | null }>;
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type AdministratorApi = Readonly<{
  getRequestOperations: (filters: RequestOperationsFilters) => Promise<AdministratorApiResult<Readonly<{ groups: readonly OperationalGroupView[] }>>>;
  updateReviewProgress: (requestId: string, command: ReviewProgressCommand) => Promise<AdministratorApiResult<OperationalRequest>>;
  listCompleteRequests: (filters: CompleteRequestFilters, cursor?: string) => Promise<RegistrationApiResult<Page>>;
  listCustodyPassports: (filters: CustodyPassportFilters, cursor?: string) => Promise<AdministratorApiResult<Readonly<{ items: readonly CustodyPassportSummary[]; nextCursor?: string }>>>;
  listCustodyAnalysts: (filters: CustodyAnalystFilters, cursor?: string) => Promise<AdministratorApiResult<Readonly<{ items: readonly EligibleAnalystSummary[]; nextCursor?: string }>>>;
  getCustodyPassportDetail: (passportId: string) => Promise<AdministratorApiResult<CustodyPassportDetail>>;
  listDossiers: (filters: DossierFilters, cursor?: string) => Promise<AdministratorApiResult<Readonly<{ items: readonly DossierSummary[]; nextCursor?: string }>>>;
  getDossierDetail: (dossierId: string) => Promise<AdministratorApiResult<DossierDetail>>;
  assignPassportCustody: (passportId: string, command: AssignCustodyCommand) => Promise<AdministratorApiResult<CustodyAppliedResponse>>;
  changePassportCustody: (passportId: string, command: ChangeCustodyCommand) => Promise<AdministratorApiResult<CustodyAppliedResponse>>;
  removePassportCustody: (passportId: string, command: RemoveCustodyCommand) => Promise<AdministratorApiResult<CustodyAppliedResponse>>;
  decisions: Readonly<{
    requestCorrection: RegistrationRequestApi['requestAdminCorrection'];
    reject: RegistrationRequestApi['rejectAdmin'];
    approve: RegistrationRequestApi['approveAdmin'];
    retryDeletion: RegistrationRequestApi['retryAdminDeletion'];
  }>;
}>;

const isOneOf = <T extends readonly string[]>(value: unknown, values: T): value is T[number] => typeof value === 'string' && values.includes(value as T[number]);
const hasOnlyKeys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every((key) => allowed.includes(key));

function parseOperationalRequest(value: unknown): OperationalRequest | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (!hasOnlyKeys(item, ['requestId', 'requestVersion', 'maskedReference', 'displayLabel', 'requestType', 'operationalGroup', 'relevantAt', 'nextAction'])) return null;
  if (typeof item.requestId !== 'string' || typeof item.maskedReference !== 'string' || typeof item.displayLabel !== 'string' || typeof item.relevantAt !== 'string') return null;
  if (!Number.isSafeInteger(item.requestVersion) || (item.requestVersion as number) < 0) return null;
  if (!isOneOf(item.requestType, REGISTRATION_REQUEST_TYPES) || !isOneOf(item.operationalGroup, OPERATIONAL_GROUPS) || !isOneOf(item.nextAction, NEXT_ACTIONS)) return null;
  return Object.freeze({
    requestId: item.requestId,
    requestVersion: item.requestVersion as number,
    maskedReference: item.maskedReference,
    displayLabel: item.displayLabel,
    requestType: item.requestType,
    operationalGroup: item.operationalGroup,
    relevantAt: item.relevantAt,
    nextAction: item.nextAction,
  });
}

function parseWorkspace(value: unknown): Readonly<{ groups: readonly OperationalGroupView[] }> | null {
  if (!value || typeof value !== 'object') return null;
  const envelope = value as Record<string, unknown>;
  if (!hasOnlyKeys(envelope, ['data']) || !envelope.data || typeof envelope.data !== 'object') return null;
  const data = envelope.data as Record<string, unknown>;
  if (!hasOnlyKeys(data, ['groups']) || !Array.isArray(data.groups) || data.groups.length !== OPERATIONAL_GROUPS.length) return null;
  const parsed = data.groups.map((entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const group = entry as Record<string, unknown>;
    if (!hasOnlyKeys(group, ['group', 'total', 'items']) || !isOneOf(group.group, OPERATIONAL_GROUPS) || !Number.isSafeInteger(group.total) || (group.total as number) < 0 || !Array.isArray(group.items)) return null;
    const items = group.items.map(parseOperationalRequest);
    if (items.some((item) => item === null) || items.length !== group.total || items.some((item) => item?.operationalGroup !== group.group)) return null;
    return Object.freeze({ group: group.group, total: group.total as number, items: Object.freeze(items as OperationalRequest[]) });
  });
  if (parsed.some((group) => group === null) || new Set(parsed.map((group) => group?.group)).size !== OPERATIONAL_GROUPS.length) return null;
  return Object.freeze({ groups: Object.freeze(parsed as OperationalGroupView[]) });
}

function repairOperationalLabel(value: string): string {
  return value.normalize('NFC').replace(/revisi(?:\?|�|Ã³)n/giu, 'revisión');
}

function parseAnalyst(value: unknown): EligibleAnalystSummary | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (!hasOnlyKeys(item, ['identityId', 'displayLabel', 'activeCustodyCount']) || typeof item.identityId !== 'string' || typeof item.displayLabel !== 'string' || !Number.isSafeInteger(item.activeCustodyCount) || (item.activeCustodyCount as number) < 0) return null;
  return Object.freeze({ identityId: item.identityId, displayLabel: repairOperationalLabel(item.displayLabel), activeCustodyCount: item.activeCustodyCount as number });
}

function parseCustodyPassport(value: unknown): CustodyPassportSummary | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (!hasOnlyKeys(item, ['passportId', 'maskedReference', 'displayLabel', 'lifecycleState', 'enrichmentStatus', 'academyLabel', 'custody', 'capabilities'])) return null;
  if (typeof item.passportId !== 'string' || typeof item.maskedReference !== 'string' || typeof item.displayLabel !== 'string' || item.lifecycleState !== 'ACTIVE' || item.enrichmentStatus !== 'AWAITING_ANALYST_ENRICHMENT') return null;
  if (item.academyLabel !== undefined && typeof item.academyLabel !== 'string') return null;
  if (!item.custody || typeof item.custody !== 'object' || !Array.isArray(item.capabilities) || !item.capabilities.every((action) => isOneOf(action, ['ASSIGN', 'CHANGE', 'REMOVE'] as const))) return null;
  const custody = item.custody as Record<string, unknown>;
  let parsedCustody: CustodyPassportSummary['custody'];
  if (custody.state === 'UNASSIGNED' && hasOnlyKeys(custody, ['state', 'version']) && Number.isSafeInteger(custody.version) && (custody.version as number) >= 0) {
    parsedCustody = Object.freeze({ state: 'UNASSIGNED', version: custody.version as number });
  } else if (custody.state === 'ASSIGNED' && hasOnlyKeys(custody, ['state', 'version', 'analyst', 'assignedAt']) && Number.isSafeInteger(custody.version) && (custody.version as number) >= 1 && typeof custody.assignedAt === 'string') {
    const analyst = parseAnalyst(custody.analyst);
    if (!analyst) return null;
    parsedCustody = Object.freeze({ state: 'ASSIGNED', version: custody.version as number, analyst, assignedAt: custody.assignedAt });
  } else return null;
  return Object.freeze({
    passportId: item.passportId,
    maskedReference: item.maskedReference,
    displayLabel: item.displayLabel,
    lifecycleState: 'ACTIVE',
    enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT',
    ...(typeof item.academyLabel === 'string' ? { academyLabel: item.academyLabel } : {}),
    custody: parsedCustody,
    capabilities: Object.freeze(item.capabilities as CustodyPassportSummary['capabilities']),
  });
}

function parseCustodyDetail(value: unknown): CustodyPassportDetail | null {
  if (!value || typeof value !== 'object') return null;
  const envelope = value as Record<string, unknown>;
  if (!hasOnlyKeys(envelope, ['data']) || !envelope.data || typeof envelope.data !== 'object') return null;
  const item = envelope.data as Record<string, unknown>;
  if (!hasOnlyKeys(item, ['passportId', 'maskedReference', 'displayLabel', 'lifecycleState', 'enrichmentStatus', 'academyLabel', 'custody', 'capabilities', 'originRequest', 'linkedDossier', 'history'])) return null;
  const summary = parseCustodyPassport(Object.fromEntries(Object.entries(item).filter(([key]) => !['originRequest', 'linkedDossier', 'history'].includes(key))));
  const originRequest = parseSafeLink(item.originRequest); const linkedDossier = parseSafeLink(item.linkedDossier);
  if (!summary || !originRequest || !linkedDossier || !Array.isArray(item.history)) return null;
  const history = item.history.map(parseHistoryEntry);
  if (history.some((entry) => entry === null)) return null;
  return Object.freeze({ ...summary, originRequest, linkedDossier, history: Object.freeze(history as CustodyHistoryEntry[]) });
}

function parseSafeLink(value: unknown): CustodySafeLink | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  return hasOnlyKeys(item, ['id', 'maskedReference', 'displayLabel', 'status', 'available']) && typeof item.id === 'string' && typeof item.maskedReference === 'string' && (item.displayLabel === undefined || typeof item.displayLabel === 'string') && typeof item.status === 'string' && typeof item.available === 'boolean'
    ? Object.freeze({ id: item.id, maskedReference: item.maskedReference, ...(typeof item.displayLabel === 'string' ? { displayLabel: item.displayLabel } : {}), status: item.status, available: item.available }) : null;
}

function parseDossierLink(value: unknown): DossierPassportLink | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (hasOnlyKeys(item, ['notApplicable']) && item.notApplicable === true) return Object.freeze({ notApplicable: true });
  return parseSafeLink(value);
}

function parseDossierSummary(value: unknown): DossierSummary | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (!hasOnlyKeys(item, ['dossierId', 'dossierName', 'maskedReference', 'displayLabel', 'status', 'confirmedAt', 'requestType', 'originRequest', 'linkedPassport'])) return null;
  const originRequest = parseSafeLink(item.originRequest); const linkedPassport = parseDossierLink(item.linkedPassport);
  if (typeof item.dossierId !== 'string' || (item.dossierName !== null && (typeof item.dossierName !== 'string' || !item.dossierName.trim() || item.dossierName.length > 180)) || typeof item.maskedReference !== 'string' || typeof item.displayLabel !== 'string' || typeof item.confirmedAt !== 'string' || !isOneOf(item.status, ['CONFIRMED', 'DELETION_PENDING', 'RECOVERY_REQUIRED', 'APPROVED'] as const) || !isOneOf(item.requestType, REGISTRATION_REQUEST_TYPES) || !originRequest || !linkedPassport) return null;
  return Object.freeze({ dossierId: item.dossierId, dossierName: item.dossierName, maskedReference: item.maskedReference, displayLabel: item.displayLabel, status: item.status, confirmedAt: item.confirmedAt, requestType: item.requestType, originRequest, linkedPassport });
}

function parseDossierDetail(value: unknown): DossierDetail | null {
  if (!value || typeof value !== 'object') return null;
  const envelope = value as Record<string, unknown>; if (!hasOnlyKeys(envelope, ['data']) || !envelope.data || typeof envelope.data !== 'object') return null;
  const data = envelope.data as Record<string, unknown>; if (!hasOnlyKeys(data, ['dossierId', 'dossierName', 'maskedReference', 'displayLabel', 'status', 'confirmedAt', 'requestType', 'originRequest', 'linkedPassport', 'confirmationHistory']) || !Array.isArray(data.confirmationHistory)) return null;
  const summary = parseDossierSummary(Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'confirmationHistory'))); if (!summary) return null;
  const history = data.confirmationHistory.map((value) => {
    if (!value || typeof value !== 'object') return null; const item = value as Record<string, unknown>;
    return hasOnlyKeys(item, ['at', 'action', 'actorLabel']) && typeof item.at === 'string' && isOneOf(item.action, ['DOSSIER_CONFIRMED', 'EVIDENCE_DELETION_VERIFIED', 'APPROVAL_FINALIZED'] as const) && isOneOf(item.actorLabel, ['ADMINISTRATOR', 'SYSTEM'] as const) ? Object.freeze({ at: item.at, action: item.action, actorLabel: item.actorLabel }) : null;
  });
  return history.some((item) => item === null) ? null : Object.freeze({ ...summary, confirmationHistory: Object.freeze(history as DossierHistoryEntry[]) });
}

function parseHistoryEntry(value: unknown): CustodyHistoryEntry | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (!hasOnlyKeys(item, ['eventId', 'at', 'action', 'actorLabel', 'previousAnalystLabel', 'nextAnalystLabel', 'reason']) || typeof item.eventId !== 'string' || typeof item.at !== 'string' || !isOneOf(item.action, ['ASSIGNED', 'CHANGED', 'REMOVED'] as const) || typeof item.actorLabel !== 'string' || (item.reason !== undefined && (typeof item.reason !== 'string' || !item.reason.trim() || item.reason.length > 500))) return null;
  if (item.previousAnalystLabel !== undefined && typeof item.previousAnalystLabel !== 'string' || item.nextAnalystLabel !== undefined && typeof item.nextAnalystLabel !== 'string') return null;
  return Object.freeze({ eventId: item.eventId, at: item.at, action: item.action, actorLabel: item.actorLabel, ...(typeof item.previousAnalystLabel === 'string' ? { previousAnalystLabel: item.previousAnalystLabel } : {}), ...(typeof item.nextAnalystLabel === 'string' ? { nextAnalystLabel: item.nextAnalystLabel } : {}), ...(typeof item.reason === 'string' ? { reason: item.reason } : {}) });
}

function parseCustodyPage<T>(value: unknown, itemParser: (item: unknown) => T | null): Readonly<{ items: readonly T[]; nextCursor?: string }> | null {
  if (!value || typeof value !== 'object') return null;
  const envelope = value as Record<string, unknown>;
  if (!hasOnlyKeys(envelope, ['data', 'pagination']) || !Array.isArray(envelope.data) || !envelope.pagination || typeof envelope.pagination !== 'object') return null;
  const pagination = envelope.pagination as Record<string, unknown>;
  if (!hasOnlyKeys(pagination, ['hasMore', 'nextCursor']) || typeof pagination.hasMore !== 'boolean' || (pagination.nextCursor !== undefined && typeof pagination.nextCursor !== 'string')) return null;
  if (pagination.hasMore && typeof pagination.nextCursor !== 'string') return null;
  const items = envelope.data.map(itemParser);
  if (items.some((item) => item === null)) return null;
  return Object.freeze({ items: Object.freeze(items as T[]), ...(typeof pagination.nextCursor === 'string' ? { nextCursor: pagination.nextCursor } : {}) });
}

function parseCustodyApplied(value: unknown): CustodyAppliedResponse | null {
  if (!value || typeof value !== 'object') return null;
  const envelope = value as Record<string, unknown>;
  if (!hasOnlyKeys(envelope, ['data', 'idempotent']) || typeof envelope.idempotent !== 'boolean' || !envelope.data || typeof envelope.data !== 'object') return null;
  const data = envelope.data as Record<string, unknown>;
  if (!hasOnlyKeys(data, ['passportId', 'eventId', 'custody']) || typeof data.passportId !== 'string' || typeof data.eventId !== 'string' || !data.custody || typeof data.custody !== 'object') return null;
  const custody = data.custody as Record<string, unknown>;
  if (!Number.isSafeInteger(custody.version) || (custody.version as number) < 1) return null;
  let parsedCustody: CustodyAppliedResponse['data']['custody'];
  if (custody.state === 'ASSIGNED' && hasOnlyKeys(custody, ['state', 'version', 'analystIdentityId', 'assignedAt']) && typeof custody.analystIdentityId === 'string' && typeof custody.assignedAt === 'string') {
    parsedCustody = Object.freeze({ state: 'ASSIGNED', version: custody.version as number, analystIdentityId: custody.analystIdentityId, assignedAt: custody.assignedAt });
  } else if (custody.state === 'UNASSIGNED' && hasOnlyKeys(custody, ['state', 'version'])) {
    parsedCustody = Object.freeze({ state: 'UNASSIGNED', version: custody.version as number });
  } else return null;
  return Object.freeze({ data: Object.freeze({ passportId: data.passportId, eventId: data.eventId, custody: parsedCustody }), idempotent: envelope.idempotent });
}

function parseCustodyConflict(value: unknown): Extract<AdministratorApiResult<never>, { kind: 'custody-conflict' | 'idempotency-conflict' }> | null {
  if (!value || typeof value !== 'object') return null;
  const envelope = value as Record<string, unknown>;
  if (!hasOnlyKeys(envelope, ['code', 'message', 'current']) || !isOneOf(envelope.code, ['CUSTODY_CONFLICT', 'IDEMPOTENCY_CONFLICT'] as const) || typeof envelope.message !== 'string' || !envelope.current || typeof envelope.current !== 'object') return null;
  const current = envelope.current as Record<string, unknown>;
  if (!Number.isSafeInteger(current.version) || (current.version as number) < 0) return null;
  let parsed: CustodyConflictState;
  if (current.state === 'UNASSIGNED' && hasOnlyKeys(current, ['state', 'version'])) parsed = Object.freeze({ state: 'UNASSIGNED', version: current.version as number });
  else if (current.state === 'ASSIGNED' && hasOnlyKeys(current, ['state', 'version', 'analystIdentityId', 'assignedAt']) && typeof current.analystIdentityId === 'string' && (current.assignedAt === undefined || typeof current.assignedAt === 'string')) {
    parsed = Object.freeze({ state: 'ASSIGNED', version: current.version as number, analystIdentityId: current.analystIdentityId, ...(typeof current.assignedAt === 'string' ? { assignedAt: current.assignedAt } : {}) });
  } else return null;
  return Object.freeze({ kind: envelope.code === 'CUSTODY_CONFLICT' ? 'custody-conflict' : 'idempotency-conflict', current: parsed });
}

function classifyFailure(status: number): Exclude<AdministratorApiResult<never>, { kind: 'success' }> {
  if (status === 401) return { kind: 'session-expired' };
  if (status === 403 || status === 404) return { kind: 'restricted' };
  if (status === 409) return { kind: 'version-conflict' };
  if (status >= 500) return { kind: 'unavailable' };
  return { kind: 'invalid-response' };
}

export function createAdministratorApi(
  configuration?: ApiConfiguration,
  fetcher: Fetcher = fetch,
  feature006Api: RegistrationRequestApi = createRegistrationRequestApi(configuration, fetcher),
): AdministratorApi {
  const environment = configuration?.apiBaseUrl ? { ok: true as const, apiBaseUrl: configuration.apiBaseUrl } : loadPublicEnvironment();
  const baseUrl = environment.ok ? environment.apiBaseUrl : null;
  const endpoint = (path: string) => new URL(path.replace(/^\//, ''), baseUrl?.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
  const headers = (body = false): Record<string, string> => ({
    Accept: 'application/json',
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(configuration?.getAccessToken?.() ? { Authorization: `Bearer ${configuration.getAccessToken?.()}` } : {}),
  });

  return Object.freeze({
    getRequestOperations: async (filters) => {
      if (!baseUrl) return { kind: 'unavailable' };
      const query = new URLSearchParams({ ...(filters.query ? { query: filters.query } : {}), ...(filters.requestType ? { requestType: filters.requestType } : {}) });
      const suffix = query.size ? `?${query}` : '';
      try {
        const response = await fetcher(endpoint(`/admin/registration-requests/operations${suffix}`), { headers: headers() });
        if (!response.ok) return classifyFailure(response.status);
        const value = parseWorkspace(await response.json());
        return value ? { kind: 'success', value } : { kind: 'invalid-response' };
      } catch { return { kind: 'connectivity-failure' }; }
    },
    updateReviewProgress: async (requestId, command) => {
      if (!baseUrl) return { kind: 'unavailable' };
      try {
        const response = await fetcher(endpoint(`/admin/registration-requests/${encodeURIComponent(requestId)}/review-progress`), {
          method: 'PATCH', headers: headers(true), body: JSON.stringify(command),
        });
        if (!response.ok) return classifyFailure(response.status);
        const envelope = await response.json() as { data?: unknown };
        const value = parseOperationalRequest(envelope.data);
        return value ? { kind: 'success', value } : { kind: 'invalid-response' };
      } catch { return { kind: 'connectivity-failure' }; }
    },
    listCustodyPassports: async (filters, cursor) => {
      if (!baseUrl) return { kind: 'unavailable' };
      const query = new URLSearchParams({ assignment: filters.assignment, ...(filters.query ? { query: filters.query } : {}), ...(filters.analystId ? { analystId: filters.analystId } : {}), limit: String(filters.limit), ...(cursor ? { cursor } : {}) });
      try {
        const response = await fetcher(endpoint(`/admin/passport-custody/passports?${query}`), { headers: headers() });
        if (!response.ok) return classifyFailure(response.status);
        const value = parseCustodyPage(await response.json(), parseCustodyPassport);
        return value ? { kind: 'success', value } : { kind: 'invalid-response' };
      } catch { return { kind: 'connectivity-failure' }; }
    },
    listCustodyAnalysts: async (filters, cursor) => {
      if (!baseUrl) return { kind: 'unavailable' };
      const query = new URLSearchParams({ ...(filters.query ? { query: filters.query } : {}), limit: String(filters.limit), ...(cursor ? { cursor } : {}) });
      try {
        const response = await fetcher(endpoint(`/admin/passport-custody/analysts?${query}`), { headers: headers() });
        if (!response.ok) return classifyFailure(response.status);
        const value = parseCustodyPage(await response.json(), parseAnalyst);
        return value ? { kind: 'success', value } : { kind: 'invalid-response' };
      } catch { return { kind: 'connectivity-failure' }; }
    },
    getCustodyPassportDetail: async (passportId) => {
      if (!baseUrl) return { kind: 'unavailable' };
      try {
        const response = await fetcher(endpoint(`/admin/passport-custody/passports/${encodeURIComponent(passportId)}`), { headers: headers() });
        if (!response.ok) return classifyFailure(response.status);
        const value = parseCustodyDetail(await response.json());
        return value ? { kind: 'success', value } : { kind: 'invalid-response' };
      } catch { return { kind: 'connectivity-failure' }; }
    },
    listDossiers: async (filters, cursor) => {
      if (!baseUrl) return { kind: 'unavailable' };
      const query = new URLSearchParams({ ...(filters.query ? { query: filters.query } : {}), ...(filters.status ? { status: filters.status } : {}), ...(filters.requestType ? { requestType: filters.requestType } : {}), ...(filters.confirmedFrom ? { confirmedFrom: filters.confirmedFrom } : {}), ...(filters.confirmedTo ? { confirmedTo: filters.confirmedTo } : {}), limit: String(filters.limit), ...(cursor ? { cursor } : {}) });
      try { const response = await fetcher(endpoint(`/admin/dossiers?${query}`), { headers: headers() }); if (!response.ok) return classifyFailure(response.status); const value = parseCustodyPage(await response.json(), parseDossierSummary); return value ? { kind: 'success', value } : { kind: 'invalid-response' }; } catch { return { kind: 'connectivity-failure' }; }
    },
    getDossierDetail: async (dossierId) => {
      if (!baseUrl) return { kind: 'unavailable' };
      try { const response = await fetcher(endpoint(`/admin/dossiers/${encodeURIComponent(dossierId)}`), { headers: headers() }); if (!response.ok) return classifyFailure(response.status); const value = parseDossierDetail(await response.json()); return value ? { kind: 'success', value } : { kind: 'invalid-response' }; } catch { return { kind: 'connectivity-failure' }; }
    },
    assignPassportCustody: async (passportId, command) => custodyMutation(baseUrl, fetcher, endpoint, headers, passportId, 'assign', command),
    changePassportCustody: async (passportId, command) => custodyMutation(baseUrl, fetcher, endpoint, headers, passportId, 'change', command),
    removePassportCustody: async (passportId, command) => custodyMutation(baseUrl, fetcher, endpoint, headers, passportId, 'remove', command),
    listCompleteRequests: (filters, cursor) => feature006Api.listAdmin(filters, cursor),
    decisions: Object.freeze({
      requestCorrection: feature006Api.requestAdminCorrection,
      reject: feature006Api.rejectAdmin,
      approve: feature006Api.approveAdmin,
      retryDeletion: feature006Api.retryAdminDeletion,
    }),
  });
}

async function custodyMutation(
  baseUrl: string | null,
  fetcher: Fetcher,
  endpoint: (path: string) => string,
  headers: (body?: boolean) => Record<string, string>,
  passportId: string,
  action: 'assign' | 'change' | 'remove',
  command: AssignCustodyCommand | ChangeCustodyCommand | RemoveCustodyCommand,
): Promise<AdministratorApiResult<CustodyAppliedResponse>> {
  if (!baseUrl) return { kind: 'unavailable' };
  try {
    const response = await fetcher(endpoint(`/admin/passport-custody/passports/${encodeURIComponent(passportId)}/${action}`), { method: 'POST', headers: headers(true), body: JSON.stringify(command) });
    if (response.status === 409) {
      const conflict = parseCustodyConflict(await response.json());
      return conflict ?? { kind: 'invalid-response' };
    }
    if (!response.ok) return classifyFailure(response.status);
    const value = parseCustodyApplied(await response.json());
    return value ? { kind: 'success', value } : { kind: 'invalid-response' };
  } catch { return { kind: 'connectivity-failure' }; }
}
