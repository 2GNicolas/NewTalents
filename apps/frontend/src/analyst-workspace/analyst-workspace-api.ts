import { loadPublicEnvironment } from '../config/public-environment';

export type AnalystOverviewMatch = Readonly<{
  id: string; sourceKind: string; passportId: string; maskedReference: string; playerName: string;
  matchDate: string; matchTime: string; opponent: string; competition: string; venue: string;
  state: 'WAITING' | 'LOADED';
}>;
export type AnalystOverviewSection = Readonly<{ availability: 'AVAILABLE' | 'UNAVAILABLE'; data: readonly AnalystOverviewMatch[]; hasMore: boolean }>;
export type AnalystOverview = Readonly<{ timeZone: 'America/Bogota'; analystLabel: string; pending: AnalystOverviewSection;
  upcoming: AnalystOverviewSection; completed: Readonly<{ availability: 'UNAVAILABLE' }> }>;
export type AnalystWorkspaceApiResult = Readonly<{ kind: 'success'; value: AnalystOverview }>
  | Readonly<{ kind: 'restricted' | 'unavailable' }>;
export type AnalystPassportCard = Readonly<{ passportId: string; maskedReference: string; playerName: string;
  lifecycleState: 'ACTIVE'; custodyState: 'ASSIGNED_TO_ACTOR'; nextMatch?: Readonly<{
    id: string; matchDate: string; matchTime: string; opponent: string; venue: string }> }>;
export type AnalystWorkContact = Readonly<{ availability: 'UNAVAILABLE' }> | Readonly<{
  availability: 'AVAILABLE'; kind: 'SELF' | 'LEGAL_REPRESENTATIVE' | 'ACADEMY_RESPONSIBLE'; phone?: string; email?: string }>;
export type AnalystPassportDetail = AnalystPassportCard & Readonly<{ contact: AnalystWorkContact }>;
export type AnalystPassportPage = Readonly<{ data: readonly AnalystPassportCard[];
  pagination: Readonly<{ hasMore: boolean; nextCursor?: string }> }>;
export type AnalystMatchDetail = AnalystOverviewMatch;
export type AnalystMatchPage = Readonly<{ data: readonly AnalystMatchDetail[];
  pagination: Readonly<{ hasMore: boolean; nextCursor?: string }> }>;
export type AnalystPassportResult<T> = Readonly<{ kind: 'success'; value: T }> | Readonly<{ kind: 'restricted' | 'unavailable' }>;
export type AnalystWorkspaceApi = Readonly<{ overview: () => Promise<AnalystWorkspaceApiResult>;
  passports: (cursor?: string) => Promise<AnalystPassportResult<AnalystPassportPage>>;
  passport: (passportId: string) => Promise<AnalystPassportResult<AnalystPassportDetail>>;
  matches: (cursor?: string) => Promise<AnalystPassportResult<AnalystMatchPage>>;
  match: (matchId: string) => Promise<AnalystPassportResult<AnalystMatchDetail>>;
  onAccessLost?: (listener: () => void) => () => void }>;

// Ephemeral notification only. No token, player name or contact is stored here.
const accessLossListeners = new Set<(token: string | null) => void>();
function notifyAccessLost(token: string | null) { accessLossListeners.forEach((listener) => listener(token)); }

type Dependencies = Readonly<{ getAccessToken: () => string | null; apiBaseUrl?: string; fetcher?: typeof fetch }>;
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const string = (value: unknown): value is string => typeof value === 'string';

function parseMatch(value: unknown): AnalystOverviewMatch | null {
  const row = record(value);
  if (!row || ![row.id, row.sourceKind, row.passportId, row.maskedReference, row.playerName, row.matchDate, row.matchTime,
    row.opponent, row.competition, row.venue].every(string) || !['WAITING', 'LOADED'].includes(String(row.state))) return null;
  return { id: row.id as string, sourceKind: row.sourceKind as string, passportId: row.passportId as string,
    maskedReference: row.maskedReference as string, playerName: row.playerName as string,
    matchDate: row.matchDate as string, matchTime: row.matchTime as string, opponent: row.opponent as string,
    competition: row.competition as string, venue: row.venue as string, state: row.state as 'WAITING' | 'LOADED' };
}

function parseSection(value: unknown): AnalystOverviewSection | null {
  const row = record(value);
  if (!row || !['AVAILABLE', 'UNAVAILABLE'].includes(String(row.availability)) || !Array.isArray(row.data)
    || typeof row.hasMore !== 'boolean') return null;
  const data = row.data.map(parseMatch);
  if (data.some((item) => item === null)) return null;
  return { availability: row.availability as AnalystOverviewSection['availability'], data: data as AnalystOverviewMatch[], hasMore: row.hasMore };
}

function parseOverview(value: unknown): AnalystOverview | null {
  const row = record(value);
  if (row?.timeZone !== 'America/Bogota' || !string(row.analystLabel) || !row.analystLabel.trim()) return null;
  const pending = parseSection(row.pending);
  const upcoming = parseSection(row.upcoming);
  const completed = record(row.completed);
  if (!pending || !upcoming || completed?.availability !== 'UNAVAILABLE') return null;
  return { timeZone: 'America/Bogota', analystLabel: row.analystLabel, pending, upcoming, completed: { availability: 'UNAVAILABLE' } };
}

function parsePassportCard(value: unknown): AnalystPassportCard | null {
  const row = record(value);
  if (!row || ![row.passportId, row.maskedReference, row.playerName].every(string) || !String(row.playerName).trim()
    || row.lifecycleState !== 'ACTIVE' || row.custodyState !== 'ASSIGNED_TO_ACTOR') return null;
  const preview = row.nextMatch === undefined ? null : record(row.nextMatch);
  if (row.nextMatch !== undefined && (!preview || ![preview.id, preview.matchDate, preview.matchTime, preview.opponent, preview.venue].every(string))) return null;
  return { passportId: row.passportId as string, maskedReference: row.maskedReference as string, playerName: row.playerName as string,
    lifecycleState: 'ACTIVE', custodyState: 'ASSIGNED_TO_ACTOR', ...(preview ? { nextMatch: {
      id: preview.id as string, matchDate: preview.matchDate as string, matchTime: preview.matchTime as string,
      opponent: preview.opponent as string, venue: preview.venue as string,
    } } : {}) };
}

function parseContact(value: unknown): AnalystWorkContact | null {
  const row = record(value);
  if (row?.availability === 'UNAVAILABLE') return { availability: 'UNAVAILABLE' };
  if (row?.availability !== 'AVAILABLE' || !['SELF', 'LEGAL_REPRESENTATIVE', 'ACADEMY_RESPONSIBLE'].includes(String(row.kind))) return null;
  const phone = typeof row.phone === 'string' && row.phone.trim() ? row.phone : undefined;
  const email = typeof row.email === 'string' && row.email.trim() ? row.email : undefined;
  if (!phone && !email) return null;
  return { availability: 'AVAILABLE', kind: row.kind as 'SELF' | 'LEGAL_REPRESENTATIVE' | 'ACADEMY_RESPONSIBLE',
    ...(phone ? { phone } : {}), ...(email ? { email } : {}) };
}

function parsePassportPage(value: unknown): AnalystPassportPage | null {
  const row = record(value);
  const pagination = record(row?.pagination);
  if (!row || !Array.isArray(row.data) || typeof pagination?.hasMore !== 'boolean') return null;
  const data = row.data.map(parsePassportCard);
  if (data.some((item) => !item)) return null;
  return { data: data as AnalystPassportCard[], pagination: { hasMore: pagination.hasMore,
    ...(typeof pagination.nextCursor === 'string' ? { nextCursor: pagination.nextCursor } : {}) } };
}

function parseMatchPage(value: unknown): AnalystMatchPage | null {
  const row = record(value);
  const pagination = record(row?.pagination);
  if (!row || !Array.isArray(row.data) || typeof pagination?.hasMore !== 'boolean') return null;
  const data = row.data.map(parseMatch);
  if (data.some((item) => !item)) return null;
  return { data: data as AnalystMatchDetail[], pagination: { hasMore: pagination.hasMore,
    ...(typeof pagination.nextCursor === 'string' ? { nextCursor: pagination.nextCursor } : {}) } };
}

export function createAnalystWorkspaceApi({ getAccessToken, apiBaseUrl, fetcher = fetch }: Dependencies): AnalystWorkspaceApi {
  const read = async <T>(path: string, parse: (value: unknown) => T | null): Promise<AnalystPassportResult<T>> => {
    const token = getAccessToken();
    const base = apiBaseUrl ?? (() => { const configured = loadPublicEnvironment(); return configured.ok ? configured.apiBaseUrl : null; })();
    if (!token) { notifyAccessLost(null); return { kind: 'restricted' }; }
    if (!base) return { kind: 'unavailable' };
    try {
      const response = await fetcher(new URL(path, base).toString(), {
        method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (getAccessToken() !== token) return { kind: 'restricted' };
      if ([401, 403, 404].includes(response.status)) {
        notifyAccessLost(token);
        return { kind: 'restricted' };
      }
      if (!response.ok) return { kind: 'unavailable' };
      const value = parse(await response.json());
      if (getAccessToken() !== token) return { kind: 'restricted' };
      return value ? { kind: 'success', value } : { kind: 'unavailable' };
    } catch { return { kind: 'unavailable' }; }
  };
  return {
    onAccessLost: (listener) => {
      const scoped = (lostToken: string | null) => { if (lostToken === null || getAccessToken() === lostToken) listener(); };
      accessLossListeners.add(scoped);
      return () => { accessLossListeners.delete(scoped); };
    },
    overview: () => read('/analyst/workspace/overview', parseOverview),
    passports: (cursor?: string) => read(`/analyst/workspace/passports${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, parsePassportPage),
    passport: (passportId: string) => read(`/analyst/workspace/passports/${encodeURIComponent(passportId)}`,
      (value) => { const card = parsePassportCard(value); const contact = parseContact(record(value)?.contact);
        return card && contact ? { ...card, contact } : null; }),
    matches: (cursor?: string) => read(`/analyst/workspace/matches${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, parseMatchPage),
    match: (matchId: string) => read(`/analyst/workspace/matches/${encodeURIComponent(matchId)}`, parseMatch),
  };
}
