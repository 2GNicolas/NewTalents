import { loadPublicEnvironment } from '../config/public-environment';

export const REGISTRATION_REQUEST_TYPES = [
  'PERSONAL_ADULT',
  'REPRESENTED_MINOR',
  'FORMAL_ACADEMY',
  'NATURAL_PERSON_ACADEMY',
  'ADDITIONAL_ACADEMY_ACCOUNT',
  'ACADEMY_ADULT_PLAYER',
  'ACADEMY_MINOR_PLAYER',
] as const;

export const REGISTRATION_REQUEST_STATUSES = ['DRAFT', 'SUBMITTED', 'REQUIRES_CORRECTION', 'APPROVED', 'REJECTED'] as const;
export const EVIDENCE_STATUSES = ['QUARANTINED', 'SCANNING', 'CLEAN', 'REJECTED', 'REPLACED', 'DELETION_PENDING', 'DELETED'] as const;

export type RegistrationRequestType = typeof REGISTRATION_REQUEST_TYPES[number];
export type RegistrationRequestStatus = typeof REGISTRATION_REQUEST_STATUSES[number];
export type EvidenceStatus = typeof EVIDENCE_STATUSES[number];

export type EvidenceMetadata = Readonly<{
  id: string;
  category: string;
  status: EvidenceStatus;
  sizeBytes: number;
  correctionRequired?: boolean;
}>;

export type DeletionStatusView = Readonly<{
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'RECOVERY_REQUIRED';
  totalItems: number;
  completedItems: number;
  lastUpdatedAt?: string;
}>;

export type RegistrationRequestSnapshot = Readonly<{
  id: string;
  type: RegistrationRequestType;
  status: RegistrationRequestStatus;
  version: number;
  capabilities: readonly string[];
  createdAt: string;
  submittedAt?: string;
  safeApplicantLabel?: string;
  academyLabel?: string;
  evidenceComplete?: boolean;
  correctionRequired?: boolean;
  safeReason?: string;
  evidence: readonly EvidenceMetadata[];
  deletion?: DeletionStatusView;
}>;

export type AdminRegistrationReview = Readonly<{
  id: string;
  type: RegistrationRequestType;
  status: RegistrationRequestStatus;
  version: number;
  versionFresh: boolean;
  approvalExecutionStatus: string;
  createdAt: string;
  submittedAt?: string;
  safeReason?: string;
  academy?: Readonly<{ id: string; label: string }>;
  structuredData: Readonly<{ applicants: readonly Record<string, unknown>[]; players: readonly Record<string, unknown>[]; representatives: readonly Record<string, unknown>[]; detail: Record<string, unknown> }>;
  evidence: readonly EvidenceMetadata[];
  consents: readonly Readonly<{ type: string; version: string; acceptedAt: string }>[];
  duplicateReview: Readonly<{ state: 'CLEAR' | 'REVIEW_REQUIRED' | 'RESOLVED_DISTINCT' | 'CONFLICT'; canApprove: boolean }>;
  capabilities: readonly string[];
  history: readonly Readonly<{ at: string; action: string; fromStatus?: string; toStatus?: string; result: string; category?: string }>[];
  deletion?: DeletionStatusView;
}>;

export type AdminOperationResult = Readonly<{
  outcome: 'applied' | 'idempotent' | 'pending-deletion' | 'recovery-required' | 'recoverable-failure' | 'approved' | 'scheduled';
  requestId?: string;
  requestStatus?: RegistrationRequestStatus;
  passportId?: string;
}>;

export type RegistrationApiResult<T> =
  | Readonly<{ kind: 'success'; value: T }>
  | Readonly<{ kind: 'version-conflict' }>
  | Readonly<{ kind: 'registration-conflict' }>
  | Readonly<{ kind: 'session-expired' }>
  | Readonly<{ kind: 'validation-error'; issues: readonly Readonly<{ field: string; code: string; message?: string }>[] }>
  | Readonly<{ kind: 'denied-or-not-found' }>
  | Readonly<{ kind: 'connectivity-failure' }>
  | Readonly<{ kind: 'unavailable-backend' }>
  | Readonly<{ kind: 'invalid-response' }>;

export type RegistrationRequestApi = Readonly<{
  validateIdentity: (input: RegistrationIdentityValidation) => Promise<RegistrationApiResult<Readonly<{ available: true }>>>;
  create: (draft: RegistrationDraft, idempotencyKey?: string) => Promise<RegistrationApiResult<RegistrationRequestSnapshot>>;
  read: (requestId: string) => Promise<RegistrationApiResult<RegistrationRequestSnapshot>>;
  update: (requestId: string, expectedVersion: number, draft: RegistrationDraft) => Promise<RegistrationApiResult<RegistrationRequestSnapshot>>;
  submit: (requestId: string, expectedVersion: number, idempotencyKey: string) => Promise<RegistrationApiResult<RegistrationRequestSnapshot>>;
  resubmit: (requestId: string, expectedVersion: number, idempotencyKey: string) => Promise<RegistrationApiResult<RegistrationRequestSnapshot>>;
  listAcademy: (academyId: string, cursor?: string) => Promise<RegistrationApiResult<Readonly<{ items: readonly RegistrationRequestSnapshot[]; nextCursor?: string }>>>;
  listAdmin: (filters: Readonly<{ type?: RegistrationRequestType; status?: RegistrationRequestStatus }>, cursor?: string) => Promise<RegistrationApiResult<Readonly<{ items: readonly RegistrationRequestSnapshot[]; nextCursor?: string }>>>;
  readAdmin: (requestId: string) => Promise<RegistrationApiResult<AdminRegistrationReview>>;
  requestAdminCorrection?: (requestId: string, command: Readonly<{ expectedVersion: number; idempotencyKey: string; safeReason: string; correctionTargets: readonly string[] }>) => Promise<RegistrationApiResult<AdminOperationResult>>;
  rejectAdmin?: (requestId: string, command: Readonly<{ expectedVersion: number; idempotencyKey: string; safeReason: string }>) => Promise<RegistrationApiResult<AdminOperationResult>>;
  approveAdmin?: (requestId: string, command: Readonly<{ expectedVersion: number; idempotencyKey: string; manualDossierConfirmation: Readonly<{ confirmed: true; dossierName: string; declarationVersion: string; categories: readonly string[] }> }>) => Promise<RegistrationApiResult<AdminOperationResult>>;
  retryAdminDeletion?: (requestId: string, command: Readonly<{ expectedVersion: number; idempotencyKey: string }>) => Promise<RegistrationApiResult<AdminOperationResult>>;
  openAdminEvidence?: (requestId: string, evidenceId: string) => Promise<RegistrationApiResult<Blob>>;
}>;

export type RegistrationIdentityValidation = Readonly<{
  requestType: RegistrationRequestType;
  academyId?: string;
  checks: readonly (Readonly<{ field: string; documentType: string; documentNumber: string }> | Readonly<{ field: 'nit'; nit: string }> | Readonly<{ field: 'academy.academyName'; academyName: string }>)[];
}>;

type PersonDraft = Readonly<{
  legalNames?: string;
  legalSurnames?: string;
  documentType?: string;
  documentNumber?: string;
  birthDate?: string;
  country?: string;
  city?: string;
  phone?: string;
}>;

type CredentialDraft = Readonly<{ email?: string; password?: string; passwordConfirmation?: string }>;
type ConsentDraft = Readonly<{
  privacyVersion?: string;
  privacyAccepted?: boolean;
  truthfulnessAccepted?: boolean;
  representationAccepted?: boolean;
  minorTreatmentAccepted?: boolean;
  academyPresentationAccepted?: boolean;
}>;
type AcademyDraft = Readonly<{ academyName?: string; country?: string; city?: string; trainingPlace?: string; responsiblePerson?: PersonDraft }>;

export type RegistrationDraft =
  | Readonly<{ type: 'PERSONAL_ADULT'; details: Readonly<{ credentials?: CredentialDraft; person?: PersonDraft; actingForSelf?: boolean; consent?: ConsentDraft }> }>
  | Readonly<{ type: 'REPRESENTED_MINOR'; details: Readonly<{ credentials?: CredentialDraft; representative?: PersonDraft; minor?: PersonDraft; relationship?: 'MOTHER' | 'FATHER' | 'LEGAL_GUARDIAN'; authorityDeclared?: boolean; consent?: ConsentDraft }> }>
  | Readonly<{ type: 'FORMAL_ACADEMY'; details: Readonly<{ credentials?: CredentialDraft; academy?: AcademyDraft; organizationType?: string; nit?: string; authorityDeclared?: boolean; consent?: ConsentDraft }> }>
  | Readonly<{ type: 'NATURAL_PERSON_ACADEMY'; details: Readonly<{ credentials?: CredentialDraft; academy?: AcademyDraft; operationDeclared?: boolean; proofCategories?: readonly string[]; consent?: ConsentDraft }> }>
  | Readonly<{ type: 'ADDITIONAL_ACADEMY_ACCOUNT'; academyId: string; details: Readonly<{ person?: PersonDraft; function?: string; responsibleAuthorization?: boolean; consent?: ConsentDraft }> }>
  | Readonly<{ type: 'ACADEMY_ADULT_PLAYER'; academyId: string; details: Readonly<{ player?: PersonDraft; adultAuthorization?: boolean; consent?: ConsentDraft }> }>
  | Readonly<{ type: 'ACADEMY_MINOR_PLAYER'; academyId: string; details: Readonly<{ minor?: PersonDraft; representative?: PersonDraft; relationship?: 'MOTHER' | 'FATHER' | 'LEGAL_GUARDIAN'; authorityDeclared?: boolean; consent?: ConsentDraft }> }>;

type ApiConfiguration = Readonly<{ apiBaseUrl?: string; getAccessToken?: () => string | null }>;
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function isOneOf<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === 'string' && options.includes(value as T[number]);
}

function parseEvidence(value: unknown): EvidenceMetadata | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.category !== 'string' || !isOneOf(item.status, EVIDENCE_STATUSES) || typeof item.sizeBytes !== 'number') return null;
  if (item.correctionRequired !== undefined && typeof item.correctionRequired !== 'boolean') return null;
  return Object.freeze({ id: item.id, category: item.category, status: item.status, sizeBytes: item.sizeBytes, ...(item.correctionRequired === undefined ? {} : { correctionRequired: item.correctionRequired }) });
}

function parseDeletion(value: unknown): DeletionStatusView | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (!['PENDING', 'IN_PROGRESS', 'COMPLETED', 'RECOVERY_REQUIRED'].includes(String(item.status))) return null;
  if (!Number.isSafeInteger(item.totalItems) || !Number.isSafeInteger(item.completedItems)) return null;
  if (item.lastUpdatedAt !== undefined && typeof item.lastUpdatedAt !== 'string') return null;
  return Object.freeze({ status: item.status as DeletionStatusView['status'], totalItems: item.totalItems as number, completedItems: item.completedItems as number, ...(item.lastUpdatedAt ? { lastUpdatedAt: item.lastUpdatedAt as string } : {}) });
}

export function parseRegistrationRequestSnapshot(value: unknown): RegistrationRequestSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || !isOneOf(candidate.type, REGISTRATION_REQUEST_TYPES) || !isOneOf(candidate.status, REGISTRATION_REQUEST_STATUSES)) return null;
  if (!Number.isSafeInteger(candidate.version) || (candidate.version as number) < 0 || typeof candidate.createdAt !== 'string') return null;
  if (!Array.isArray(candidate.capabilities) || !candidate.capabilities.every((capability) => typeof capability === 'string')) return null;
  const evidenceValues = candidate.evidence === undefined ? [] : candidate.evidence;
  if (!Array.isArray(evidenceValues)) return null;
  const evidence = evidenceValues.map(parseEvidence);
  if (evidence.some((item) => item === null)) return null;
  const deletion = candidate.deletion === undefined ? undefined : parseDeletion(candidate.deletion);
  if (candidate.deletion !== undefined && !deletion) return null;
  const optionalStrings = ['submittedAt', 'safeApplicantLabel', 'academyLabel', 'safeReason'] as const;
  if (optionalStrings.some((key) => candidate[key] !== undefined && typeof candidate[key] !== 'string')) return null;
  const optionalBooleans = ['evidenceComplete', 'correctionRequired'] as const;
  if (optionalBooleans.some((key) => candidate[key] !== undefined && typeof candidate[key] !== 'boolean')) return null;
  return Object.freeze({
    id: candidate.id,
    type: candidate.type,
    status: candidate.status,
    version: candidate.version as number,
    capabilities: Object.freeze([...candidate.capabilities]),
    createdAt: candidate.createdAt,
    ...(candidate.submittedAt ? { submittedAt: candidate.submittedAt as string } : {}),
    ...(candidate.safeApplicantLabel ? { safeApplicantLabel: candidate.safeApplicantLabel as string } : {}),
    ...(candidate.academyLabel ? { academyLabel: candidate.academyLabel as string } : {}),
    ...(candidate.safeReason ? { safeReason: candidate.safeReason as string } : {}),
    ...(candidate.evidenceComplete === undefined ? {} : { evidenceComplete: candidate.evidenceComplete as boolean }),
    ...(candidate.correctionRequired === undefined ? {} : { correctionRequired: candidate.correctionRequired as boolean }),
    evidence: Object.freeze(evidence as EvidenceMetadata[]),
    ...(deletion ? { deletion } : {}),
  });
}

function parseIssues(value: unknown): readonly Readonly<{ field: string; code: string; message?: string }>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((issue) => {
    if (!issue || typeof issue !== 'object') return [];
    const candidate = issue as Record<string, unknown>;
    if (typeof candidate.field !== 'string' || typeof candidate.code !== 'string') return [];
    return [{ field: candidate.field, code: candidate.code, ...(typeof candidate.message === 'string' ? { message: candidate.message } : {}) }];
  });
}

async function classify(response: Response): Promise<RegistrationApiResult<RegistrationRequestSnapshot>> {
  if (response.ok) {
    try {
      const envelope = await response.json() as { data?: unknown };
      const snapshot = parseRegistrationRequestSnapshot(envelope?.data);
      return snapshot ? { kind: 'success', value: snapshot } : { kind: 'invalid-response' };
    } catch {
      return { kind: 'invalid-response' };
    }
  }
  if (response.status === 404 || response.status === 403) return { kind: 'denied-or-not-found' };
  if (response.status === 401) return { kind: 'session-expired' };
  if (response.status === 409) {
    try {
      const body = await response.json() as { error?: { code?: unknown } };
      if (body.error?.code === 'registration_conflict') return { kind: 'registration-conflict' };
      if (body.error?.code === 'registration_request_version_conflict') return { kind: 'version-conflict' };
      return { kind: 'invalid-response' };
    } catch {
      return { kind: 'invalid-response' };
    }
  }
  if (response.status === 422) {
    try {
      const body = await response.json() as { issues?: unknown };
      return { kind: 'validation-error', issues: parseIssues(body.issues) };
    } catch {
      return { kind: 'validation-error', issues: [] };
    }
  }
  if (response.status >= 500) return { kind: 'unavailable-backend' };
  return { kind: 'invalid-response' };
}

async function classifyPage(response: Response): Promise<RegistrationApiResult<Readonly<{ items: readonly RegistrationRequestSnapshot[]; nextCursor?: string }>>> {
  if (response.status === 401) return { kind: 'session-expired' };
  if (response.status === 403 || response.status === 404) return { kind: 'denied-or-not-found' };
  if (response.status >= 500) return { kind: 'unavailable-backend' };
  if (!response.ok) return { kind: 'invalid-response' };
  try {
    const envelope = await response.json() as { data?: unknown; pagination?: { nextCursor?: unknown } };
    if (!Array.isArray(envelope.data)) return { kind: 'invalid-response' };
    const items = envelope.data.map(parseRegistrationRequestSnapshot);
    if (items.some((item) => item === null) || (envelope.pagination?.nextCursor !== undefined && typeof envelope.pagination.nextCursor !== 'string')) return { kind: 'invalid-response' };
    return { kind: 'success', value: Object.freeze({ items: Object.freeze(items as RegistrationRequestSnapshot[]), ...(typeof envelope.pagination?.nextCursor === 'string' ? { nextCursor: envelope.pagination.nextCursor } : {}) }) };
  } catch { return { kind: 'invalid-response' }; }
}

async function classifyIdentityValidation(response: Response): Promise<RegistrationApiResult<Readonly<{ available: true }>>> {
  if (response.ok) return { kind: 'success', value: Object.freeze({ available: true }) };
  if (response.status === 401) return { kind: 'session-expired' };
  if (response.status === 403 || response.status === 404) return { kind: 'denied-or-not-found' };
  if (response.status === 422) {
    try { const body = await response.json() as { issues?: unknown }; return { kind: 'validation-error', issues: parseIssues(body.issues) }; }
    catch { return { kind: 'validation-error', issues: [] }; }
  }
  if (response.status >= 500) return { kind: 'unavailable-backend' };
  return { kind: 'invalid-response' };
}

function parseAdminReview(value: unknown): AdminRegistrationReview | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || !isOneOf(item.type, REGISTRATION_REQUEST_TYPES) || !isOneOf(item.status, REGISTRATION_REQUEST_STATUSES)) return null;
  if (!Number.isSafeInteger(item.version) || typeof item.versionFresh !== 'boolean' || typeof item.approvalExecutionStatus !== 'string' || typeof item.createdAt !== 'string') return null;
  if (!item.structuredData || typeof item.structuredData !== 'object' || !Array.isArray(item.evidence) || !Array.isArray(item.consents) || !Array.isArray(item.capabilities) || !Array.isArray(item.history)) return null;
  const evidence = item.evidence.map(parseEvidence);
  if (evidence.some((entry) => entry === null)) return null;
  const duplicate = item.duplicateReview as Record<string, unknown> | undefined;
  if (!duplicate || !['CLEAR', 'REVIEW_REQUIRED', 'RESOLVED_DISTINCT', 'CONFLICT'].includes(String(duplicate.state)) || typeof duplicate.canApprove !== 'boolean') return null;
  const structured = item.structuredData as Record<string, unknown>;
  if (!Array.isArray(structured.applicants) || !Array.isArray(structured.players) || !Array.isArray(structured.representatives) || !structured.detail || typeof structured.detail !== 'object') return null;
  const deletion = item.deletion === undefined ? undefined : parseDeletion(item.deletion);
  if (item.deletion !== undefined && !deletion) return null;
  return Object.freeze({
    id: item.id, type: item.type, status: item.status, version: item.version as number, versionFresh: item.versionFresh,
    approvalExecutionStatus: item.approvalExecutionStatus, createdAt: item.createdAt,
    ...(typeof item.submittedAt === 'string' ? { submittedAt: item.submittedAt } : {}),
    ...(typeof item.safeReason === 'string' ? { safeReason: item.safeReason } : {}),
    ...(item.academy && typeof item.academy === 'object' && typeof (item.academy as Record<string, unknown>).id === 'string' && typeof (item.academy as Record<string, unknown>).label === 'string' ? { academy: item.academy as { id: string; label: string } } : {}),
    structuredData: structured as AdminRegistrationReview['structuredData'], evidence: Object.freeze(evidence as EvidenceMetadata[]),
    consents: Object.freeze(item.consents as AdminRegistrationReview['consents']), duplicateReview: duplicate as AdminRegistrationReview['duplicateReview'],
    capabilities: Object.freeze(item.capabilities.filter((entry): entry is string => typeof entry === 'string')),
    history: Object.freeze(item.history as AdminRegistrationReview['history']), ...(deletion ? { deletion } : {}),
  });
}

async function classifyAdminReview(response: Response): Promise<RegistrationApiResult<AdminRegistrationReview>> {
  if (response.status === 401) return { kind: 'session-expired' };
  if (response.status === 403 || response.status === 404) return { kind: 'denied-or-not-found' };
  if (response.status >= 500) return { kind: 'unavailable-backend' };
  if (!response.ok) return { kind: 'invalid-response' };
  try {
    const envelope = await response.json() as { data?: unknown };
    const review = parseAdminReview(envelope.data);
    return review ? { kind: 'success', value: review } : { kind: 'invalid-response' };
  } catch { return { kind: 'invalid-response' }; }
}

async function classifyAdminOperation(response: Response): Promise<RegistrationApiResult<AdminOperationResult>> {
  if (response.status === 401) return { kind: 'session-expired' };
  if (response.status === 403 || response.status === 404) return { kind: 'denied-or-not-found' };
  if (response.status === 409) return { kind: 'version-conflict' };
  if (response.status === 422) { try { const body = await response.json() as { issues?: unknown }; return { kind: 'validation-error', issues: parseIssues(body.issues) }; } catch { return { kind: 'validation-error', issues: [] }; } }
  if (response.status >= 500) return { kind: 'unavailable-backend' };
  if (!response.ok) return { kind: 'invalid-response' };
  try {
    const envelope = await response.json() as { data?: unknown };
    if (!envelope.data || typeof envelope.data !== 'object') return { kind: 'invalid-response' };
    const value = envelope.data as Record<string, unknown>;
    const outcomes = ['applied', 'idempotent', 'pending-deletion', 'recovery-required', 'recoverable-failure', 'approved', 'scheduled'];
    if (!outcomes.includes(String(value.outcome))) return { kind: 'invalid-response' };
    const result = value.result && typeof value.result === 'object' ? value.result as Record<string, unknown> : undefined;
    const passport = result?.passport && typeof result.passport === 'object' ? result.passport as Record<string, unknown> : undefined;
    return { kind: 'success', value: Object.freeze({ outcome: value.outcome as AdminOperationResult['outcome'], ...(typeof value.requestId === 'string' ? { requestId: value.requestId } : {}), ...(isOneOf(value.requestStatus, REGISTRATION_REQUEST_STATUSES) ? { requestStatus: value.requestStatus } : {}), ...(typeof passport?.id === 'string' ? { passportId: passport.id } : {}) }) };
  } catch { return { kind: 'invalid-response' }; }
}

export function createRegistrationRequestApi(configuration?: ApiConfiguration, fetcher: Fetcher = fetch): RegistrationRequestApi {
  const environment = configuration?.apiBaseUrl ? { ok: true as const, apiBaseUrl: configuration.apiBaseUrl } : loadPublicEnvironment();
  const baseUrl = environment.ok ? environment.apiBaseUrl : null;
  const request = async (path: string, method: 'GET' | 'PATCH' | 'POST', body?: object, idempotencyKey?: string): Promise<RegistrationApiResult<RegistrationRequestSnapshot>> => {
    if (!baseUrl) return { kind: 'unavailable-backend' };
    const accessToken = configuration?.getAccessToken?.();
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (body) headers['Content-Type'] = 'application/json';
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      return await classify(await fetcher(new URL(path, baseUrl).toString(), { method, headers, body: body ? JSON.stringify(body) : undefined }));
    } catch {
      return { kind: 'connectivity-failure' };
    }
  };
  const transition = (requestId: string, action: 'submit' | 'resubmit', expectedVersion: number, idempotencyKey: string) => request(`/registration-requests/${encodeURIComponent(requestId)}/${action}`, 'POST', { expectedVersion, idempotencyKey });
  const adminOperation = async (requestId: string, action: 'correction' | 'reject' | 'approve' | 'deletion/retry', body: object): Promise<RegistrationApiResult<AdminOperationResult>> => {
    if (!baseUrl) return { kind: 'unavailable-backend' };
    const accessToken = configuration?.getAccessToken?.();
    try {
      return await classifyAdminOperation(await fetcher(new URL(`/admin/registration-requests/${encodeURIComponent(requestId)}/${action}`, baseUrl).toString(), { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify(body) }));
    } catch { return { kind: 'connectivity-failure' }; }
  };
  const createPaths: Readonly<Record<Exclude<RegistrationDraft['type'], 'ADDITIONAL_ACADEMY_ACCOUNT' | 'ACADEMY_ADULT_PLAYER' | 'ACADEMY_MINOR_PLAYER'>, string>> = {
    PERSONAL_ADULT: '/registration-requests/personal-adult',
    REPRESENTED_MINOR: '/registration-requests/represented-minor',
    FORMAL_ACADEMY: '/registration-requests/academies/formal',
    NATURAL_PERSON_ACADEMY: '/registration-requests/academies/natural-person',
  };
  const createPath = (draft: RegistrationDraft): string => {
    if (draft.type === 'ADDITIONAL_ACADEMY_ACCOUNT') return `/academies/${encodeURIComponent(draft.academyId)}/registration-requests/accounts`;
    if (draft.type === 'ACADEMY_ADULT_PLAYER') return `/academies/${encodeURIComponent(draft.academyId)}/registration-requests/players/adult`;
    if (draft.type === 'ACADEMY_MINOR_PLAYER') return `/academies/${encodeURIComponent(draft.academyId)}/registration-requests/players/minor`;
    return createPaths[draft.type];
  };
  return Object.freeze({
    validateIdentity: async (input) => {
      if (!baseUrl) return { kind: 'unavailable-backend' };
      const accessToken = configuration?.getAccessToken?.();
      const path = input.academyId
        ? `/academies/${encodeURIComponent(input.academyId)}/registration-requests/validate-identity`
        : '/registration-requests/validate-identity';
      try {
        return await classifyIdentityValidation(await fetcher(new URL(path, baseUrl).toString(), { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify({ requestType: input.requestType, checks: input.checks }) }));
      } catch { return { kind: 'connectivity-failure' }; }
    },
    create: (draft, idempotencyKey) => request(createPath(draft), 'POST', draft.details, idempotencyKey),
    read: (requestId) => request(`/registration-requests/${encodeURIComponent(requestId)}`, 'GET'),
    update: (requestId, expectedVersion, draft) => request(`/registration-requests/${encodeURIComponent(requestId)}`, 'PATCH', { expectedVersion, details: draft.details }),
    submit: (requestId, expectedVersion, idempotencyKey) => transition(requestId, 'submit', expectedVersion, idempotencyKey),
    resubmit: (requestId, expectedVersion, idempotencyKey) => transition(requestId, 'resubmit', expectedVersion, idempotencyKey),
    listAcademy: async (academyId, cursor) => {
      if (!baseUrl) return { kind: 'unavailable-backend' };
      const accessToken = configuration?.getAccessToken?.();
      const query = new URLSearchParams({ limit: '20', ...(cursor ? { cursor } : {}) });
      try {
        const url = new URL(`/academies/${encodeURIComponent(academyId)}/registration-requests?${query}`, baseUrl).toString();
        const response = await fetcher(url, { headers: { Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) } });
        return await classifyPage(response);
      } catch { return { kind: 'connectivity-failure' }; }
    },
    listAdmin: async (filters, cursor) => {
      if (!baseUrl) return { kind: 'unavailable-backend' };
      const accessToken = configuration?.getAccessToken?.();
      const query = new URLSearchParams({ limit: '20', ...(filters.type ? { type: filters.type } : {}), ...(filters.status ? { status: filters.status } : {}), ...(cursor ? { cursor } : {}) });
      try {
        return await classifyPage(await fetcher(new URL(`/admin/registration-requests?${query}`, baseUrl).toString(), { headers: { Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) } }));
      } catch { return { kind: 'connectivity-failure' }; }
    },
    readAdmin: async (requestId) => {
      if (!baseUrl) return { kind: 'unavailable-backend' };
      const accessToken = configuration?.getAccessToken?.();
      try {
        return await classifyAdminReview(await fetcher(new URL(`/admin/registration-requests/${encodeURIComponent(requestId)}`, baseUrl).toString(), { headers: { Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) } }));
      } catch { return { kind: 'connectivity-failure' }; }
    },
    requestAdminCorrection: (requestId, command) => adminOperation(requestId, 'correction', command),
    rejectAdmin: (requestId, command) => adminOperation(requestId, 'reject', command),
    approveAdmin: (requestId, command) => adminOperation(requestId, 'approve', command),
    retryAdminDeletion: (requestId, command) => adminOperation(requestId, 'deletion/retry', command),
    openAdminEvidence: async (requestId, evidenceId) => {
      if (!baseUrl) return { kind: 'unavailable-backend' };
      const accessToken = configuration?.getAccessToken?.();
      try {
        const response = await fetcher(new URL(`/admin/registration-requests/${encodeURIComponent(requestId)}/evidence/${encodeURIComponent(evidenceId)}`, baseUrl).toString(), { headers: { Accept: 'application/pdf,image/jpeg,image/png', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) } });
        if (response.status === 401) return { kind: 'session-expired' };
        if (response.status === 403 || response.status === 404) return { kind: 'denied-or-not-found' };
        if (response.status >= 500) return { kind: 'unavailable-backend' };
        return response.ok ? { kind: 'success', value: await response.blob() } : { kind: 'invalid-response' };
      } catch { return { kind: 'connectivity-failure' }; }
    },
  });
}
