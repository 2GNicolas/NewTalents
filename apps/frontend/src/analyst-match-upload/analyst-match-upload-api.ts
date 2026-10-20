import { loadPublicEnvironment } from '../config/public-environment';

export type ConfirmedEvent = Readonly<{ sequence: number; eventType: string; variant?: string; result: string;
  videoMinute: string; period?: string; addedTime?: number; context: Record<string, unknown>;
  complexity: Record<string, unknown>; goalkeeperDetail?: Record<string, unknown>; observation?: string }>;
export type ConfirmedUpload = Readonly<{ matchId: string; sourceKind: 'FIRST_MATCH';
  participation: 'PARTICIPATED' | 'DID_NOT_PARTICIPATE'; totalMinutesPlayed: number; youtubeUrl: string;
  events: readonly ConfirmedEvent[]; confirmedAt: string; outcome: 'APPLIED' | 'IDEMPOTENT' }>;
export type CaptureContext = Readonly<{ matchId: string; passportId: string; sourceKind: 'FIRST_MATCH';
  availability: 'AVAILABLE' | 'CONFIRMED' | 'UNAVAILABLE'; expectedVersion?: number; upload?: ConfirmedUpload }>;
export type CaptureResult = Readonly<{ kind: 'success'; value: CaptureContext }> | Readonly<{ kind: 'restricted' | 'unavailable' }>;
export type ConfirmInput = Readonly<{ expectedVersion: number; participation: 'PARTICIPATED' | 'DID_NOT_PARTICIPATE';
  totalMinutesPlayed: number; youtubeUrl: string; events: readonly Record<string, unknown>[] }>;
export type ConfirmResult = Readonly<{ kind: 'success'; value: { outcome: 'APPLIED' | 'IDEMPOTENT'; matchId: string } }>
  | Readonly<{ kind: 'validation' | 'conflict' | 'restricted' | 'unavailable' }>;
export type CaptureApi = Readonly<{ capture: (matchId: string) => Promise<CaptureResult>;
  confirm?: (matchId: string, input: ConfirmInput, idempotencyKey: string) => Promise<ConfirmResult>;
  onAccessLost?: (listener: () => void) => () => void }>;
type Dependencies = Readonly<{ getAccessToken: () => string | null; apiBaseUrl?: string; fetcher?: typeof fetch }>;
const listeners = new Set<(token: string | null) => void>();
const notify = (token: string | null) => listeners.forEach((listener) => listener(token));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseContext(value: unknown): CaptureContext | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (![row.matchId, row.passportId].every((id) => typeof id === 'string' && uuid.test(id))
    || row.sourceKind !== 'FIRST_MATCH' || !['AVAILABLE', 'CONFIRMED', 'UNAVAILABLE'].includes(String(row.availability))) return null;
  if (row.availability === 'AVAILABLE' && (!Number.isSafeInteger(row.expectedVersion) || Number(row.expectedVersion) < 1)) return null;
  if (row.availability !== 'AVAILABLE' && row.expectedVersion !== undefined) return null;
  if (row.availability !== 'CONFIRMED' && row.upload !== undefined) return null;
  const upload = row.availability === 'CONFIRMED' ? parseConfirmedUpload(row.upload, row.matchId as string) : null;
  if (row.availability === 'CONFIRMED' && !upload) return null;
  return { matchId: row.matchId as string, passportId: row.passportId as string, sourceKind: 'FIRST_MATCH',
    availability: row.availability as CaptureContext['availability'],
    ...(row.availability === 'AVAILABLE' ? { expectedVersion: row.expectedVersion as number } : {}),
    ...(upload ? { upload } : {}) };
}

function parseConfirmedUpload(value: unknown, matchId: string): ConfirmedUpload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.matchId !== matchId || row.sourceKind !== 'FIRST_MATCH'
    || !['PARTICIPATED', 'DID_NOT_PARTICIPATE'].includes(String(row.participation))
    || !Number.isSafeInteger(row.totalMinutesPlayed) || Number(row.totalMinutesPlayed) < 0
    || typeof row.youtubeUrl !== 'string' || !row.youtubeUrl.startsWith('https://')
    || typeof row.confirmedAt !== 'string' || !['APPLIED', 'IDEMPOTENT'].includes(String(row.outcome))
    || !Array.isArray(row.events)) return null;
  if ((row.participation === 'DID_NOT_PARTICIPATE' && (row.totalMinutesPlayed !== 0 || row.events.length !== 0))
    || (row.participation === 'PARTICIPATED' && (row.totalMinutesPlayed === 0 || row.events.length === 0))) return null;
  const events: ConfirmedEvent[] = [];
  for (const item of row.events) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const event = item as Record<string, unknown>;
    if (!Number.isSafeInteger(event.sequence) || typeof event.eventType !== 'string'
      || typeof event.result !== 'string' || typeof event.videoMinute !== 'string'
      || !event.context || typeof event.context !== 'object' || Array.isArray(event.context)
      || !event.complexity || typeof event.complexity !== 'object' || Array.isArray(event.complexity)
      || (event.observation !== undefined && typeof event.observation !== 'string')) return null;
    events.push(event as ConfirmedEvent);
  }
  return { matchId, sourceKind: 'FIRST_MATCH', participation: row.participation as ConfirmedUpload['participation'],
    totalMinutesPlayed: row.totalMinutesPlayed as number, youtubeUrl: row.youtubeUrl,
    confirmedAt: row.confirmedAt, outcome: row.outcome as ConfirmedUpload['outcome'], events };
}

export function createAnalystMatchUploadApi({ getAccessToken, apiBaseUrl, fetcher = fetch }: Dependencies): CaptureApi {
  return {
    onAccessLost: (listener) => {
      const scoped = (token: string | null) => { if (token === null || getAccessToken() === token) listener(); };
      listeners.add(scoped);
      return () => { listeners.delete(scoped); };
    },
    capture: async (matchId) => {
      const token = getAccessToken();
      const base = apiBaseUrl ?? (() => { const env = loadPublicEnvironment(); return env.ok ? env.apiBaseUrl : null; })();
      if (!token) { notify(null); return { kind: 'restricted' }; }
      if (!base || !uuid.test(matchId)) return { kind: 'unavailable' };
      try {
        const response = await fetcher(new URL(`/analyst/workspace/matches/${matchId}/capture`, base).toString(), {
          method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, cache: 'no-store',
        });
        if (getAccessToken() !== token) return { kind: 'restricted' };
        if ([401, 403, 404].includes(response.status)) { notify(token); return { kind: 'restricted' }; }
        if (!response.ok) return { kind: 'unavailable' };
        const value = parseContext(await response.json());
        if (getAccessToken() !== token) return { kind: 'restricted' };
        return value ? { kind: 'success', value } : { kind: 'unavailable' };
      } catch { return { kind: 'unavailable' }; }
    },
    confirm: async (matchId, input, idempotencyKey) => {
      const token = getAccessToken();
      const base = apiBaseUrl ?? (() => { const env = loadPublicEnvironment(); return env.ok ? env.apiBaseUrl : null; })();
      if (!token) { notify(null); return { kind: 'restricted' }; }
      if (!base || !uuid.test(matchId) || !uuid.test(idempotencyKey)) return { kind: 'unavailable' };
      try {
        const response = await fetcher(new URL(`/analyst/workspace/matches/${matchId}/capture/confirm`, base).toString(), {
          method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`, 'Idempotency-Key': idempotencyKey },
          body: JSON.stringify(input), cache: 'no-store',
        });
        if (getAccessToken() !== token) return { kind: 'restricted' };
        if ([401, 403, 404].includes(response.status)) { notify(token); return { kind: 'restricted' }; }
        if (response.status === 422) return { kind: 'validation' };
        if (response.status === 409) return { kind: 'conflict' };
        if (!response.ok) return { kind: 'unavailable' };
        const body: unknown = await response.json();
        if (getAccessToken() !== token) return { kind: 'restricted' };
        if (!body || typeof body !== 'object') return { kind: 'unavailable' };
        const value = body as Record<string, unknown>;
        if (!uuid.test(String(value.matchId)) || !['APPLIED', 'IDEMPOTENT'].includes(String(value.outcome)))
          return { kind: 'unavailable' };
        return { kind: 'success', value: { matchId: String(value.matchId), outcome: value.outcome as 'APPLIED' | 'IDEMPOTENT' } };
      } catch { return { kind: 'unavailable' }; }
    },
  };
}
