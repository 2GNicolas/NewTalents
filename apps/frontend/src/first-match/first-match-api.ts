import { loadPublicEnvironment } from '../config/public-environment';

export type FirstMatchSummary = Readonly<{
  id: string; version: number; matchDate: string; matchTime: string;
  opponent: string; competition: string; venue: string; state: 'WAITING' | 'LOADED';
}>;
export type FirstMatchFlow = Readonly<{
  passportId: string; state: 'INVITATION' | 'WAITING' | 'LOADED' | 'RESTRICTED' | 'UNAVAILABLE';
  match?: FirstMatchSummary; allowedActions: readonly ('SCHEDULE' | 'RESCHEDULE' | 'CANCEL')[];
}>;
export type FirstMatchAvailability = Readonly<{
  configured: boolean; matchDate: string; periodStart?: string; periodEndExclusive?: string;
  cadence?: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';
  limit?: number; reserved?: number; used?: number; available?: number;
}>;
export type ScheduleFields = Readonly<{
  matchDate: string; matchTime: string; opponent: string; competition: string; venue: string;
}>;
export type ScheduleCommand = ScheduleFields & Readonly<{ expectedVersion: 0; idempotencyKey: string }>;
export type RescheduleCommand = ScheduleFields & Readonly<{ expectedVersion: number; idempotencyKey: string }>;
export type CancelCommand = Readonly<{ expectedVersion: number; idempotencyKey: string }>;
export type FirstMatchApiResult<T> = Readonly<{ kind: 'success'; value: T }>
  | Readonly<{ kind: 'conflict' | 'invalid' | 'no-allowance' | 'allowance-full' | 'ineligible' | 'restricted' | 'unavailable' }>;
export type FirstMatchApi = Readonly<{
  flow: (passportId: string) => Promise<FirstMatchApiResult<FirstMatchFlow>>;
  preview: (passportId: string, matchDate: string) => Promise<FirstMatchApiResult<FirstMatchAvailability>>;
  schedule: (passportId: string, input: ScheduleCommand) => Promise<FirstMatchApiResult<FirstMatchFlow>>;
  reschedule: (passportId: string, matchId: string, input: RescheduleCommand) => Promise<FirstMatchApiResult<FirstMatchFlow>>;
  cancel: (passportId: string, matchId: string, input: CancelCommand) => Promise<FirstMatchApiResult<FirstMatchFlow>>;
}>;

type Dependencies = Readonly<{ getAccessToken: () => string | null; apiBaseUrl?: string; fetcher?: typeof fetch }>;
const string = (value: unknown): value is string => typeof value === 'string';
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const nonnegative = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

function parseFlow(value: unknown): FirstMatchFlow | null {
  const flow = object(value);
  if (!flow || !string(flow.passportId) || !['INVITATION', 'WAITING', 'LOADED', 'RESTRICTED', 'UNAVAILABLE'].includes(String(flow.state))
    || !Array.isArray(flow.allowedActions) || !flow.allowedActions.every((action) => ['SCHEDULE', 'RESCHEDULE', 'CANCEL'].includes(action))) return null;
  const state = flow.state as FirstMatchFlow['state'];
  if (state === 'WAITING' || state === 'LOADED') {
    const match = object(flow.match);
    if (!match || !string(match.id) || !nonnegative(match.version) || !string(match.matchDate) || !string(match.matchTime)
      || !string(match.opponent) || !string(match.competition) || !string(match.venue) || match.state !== state) return null;
    // A loaded match is an operational handoff, never a pre-load editing capability.
    return { passportId: flow.passportId, state, allowedActions: state === 'LOADED' ? [] : flow.allowedActions,
      match: { id: match.id, version: match.version, matchDate: match.matchDate, matchTime: match.matchTime,
        opponent: match.opponent, competition: match.competition, venue: match.venue, state } };
  }
  return { passportId: flow.passportId, state, allowedActions: flow.allowedActions };
}

function parseAvailability(value: unknown): FirstMatchAvailability | null {
  const data = object(value);
  if (!data || typeof data.configured !== 'boolean' || !string(data.matchDate)) return null;
  if (!data.configured) return { configured: false, matchDate: data.matchDate };
  if (!string(data.periodStart) || !string(data.periodEndExclusive)
    || !['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'].includes(String(data.cadence))
    || !nonnegative(data.limit) || !nonnegative(data.reserved) || !nonnegative(data.used) || !nonnegative(data.available)) return null;
  return { configured: true, matchDate: data.matchDate, periodStart: data.periodStart,
    periodEndExclusive: data.periodEndExclusive, cadence: data.cadence as FirstMatchAvailability['cadence'],
    limit: data.limit, reserved: data.reserved, used: data.used, available: data.available };
}

export function createFirstMatchApi({ getAccessToken, apiBaseUrl, fetcher = fetch }: Dependencies): FirstMatchApi {
  const request = async <T>(route: string, method: 'GET' | 'POST' | 'PUT', body: ScheduleCommand | RescheduleCommand | CancelCommand | undefined,
    parse: (value: unknown) => T | null): Promise<FirstMatchApiResult<T>> => {
    const token = getAccessToken();
    const base = apiBaseUrl ?? (() => { const configured = loadPublicEnvironment(); return configured.ok ? configured.apiBaseUrl : null; })();
    if (!token) return { kind: 'restricted' };
    if (!base) return { kind: 'unavailable' };
    try {
      const response = await fetcher(new URL(route, base).toString(), {
        method, headers: { Accept: 'application/json', Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store',
      });
      if (response.ok) {
        const parsed = parse(await response.json());
        return parsed ? { kind: 'success', value: parsed } : { kind: 'unavailable' };
      }
      if ([401, 403, 404].includes(response.status)) return { kind: 'restricted' };
      if (response.status === 409) return { kind: 'conflict' };
      if (response.status === 422) {
        const error = object(await response.json());
        const kind = ({ NO_ALLOWANCE: 'no-allowance', ALLOWANCE_FULL: 'allowance-full',
          PASSPORT_INELIGIBLE: 'ineligible' } as const)[String(error?.code) as 'NO_ALLOWANCE' | 'ALLOWANCE_FULL' | 'PASSPORT_INELIGIBLE'];
        return { kind: kind ?? 'invalid' };
      }
      return { kind: 'unavailable' };
    } catch { return { kind: 'unavailable' }; }
  };
  const route = (passportId: string) => `/passports/${encodeURIComponent(passportId)}/first-match`;
  return {
    flow: (passportId) => request(route(passportId), 'GET', undefined, parseFlow),
    preview: (passportId, matchDate) => request(`${route(passportId)}/allowance?matchDate=${encodeURIComponent(matchDate)}`, 'GET', undefined, parseAvailability),
    schedule: (passportId, input) => request(route(passportId), 'POST', input, parseFlow),
    reschedule: (passportId, matchId, input) => request(`${route(passportId)}/${encodeURIComponent(matchId)}`, 'PUT', input, parseFlow),
    cancel: (passportId, matchId, input) => request(`${route(passportId)}/${encodeURIComponent(matchId)}/cancel`, 'POST', input, parseFlow),
  };
}
