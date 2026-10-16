import { render } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));

import { AnalystOverviewView } from './analyst-overview';
import { AnalystPassportDetailView } from './analyst-passports';
import { AnalystMatchDetailView } from './analyst-matches';
import { createAnalystWorkspaceApi } from './analyst-workspace-api';
import { passportDetailState, passportListState } from './analyst-passport-state';
import { matchDetailState, matchListState } from './analyst-match-state';
import { AnalystWorkspaceStateMachine } from './analyst-workspace-state';

const passportId = '22222222-2222-4222-8222-222222222222';
const matchId = '33333333-3333-4333-8333-333333333333';
const card = { passportId, maskedReference: 'PAS-2222', playerName: 'Jugador protegido',
  lifecycleState: 'ACTIVE', custodyState: 'ASSIGNED_TO_ACTOR' };
const match = { id: matchId, sourceKind: 'FIRST_MATCH', passportId, maskedReference: 'PAS-2222',
  playerName: card.playerName, matchDate: '2026-10-15', matchTime: '10:00', opponent: 'Rival',
  competition: 'Liga', venue: 'Cancha', state: 'WAITING' };
const overview = { timeZone: 'America/Bogota', analystLabel: 'Analista protegido',
  pending: { availability: 'AVAILABLE', data: [match], hasMore: false },
  upcoming: { availability: 'AVAILABLE', data: [], hasMore: false }, completed: { availability: 'UNAVAILABLE' } };

describe('Feature 010 client revocation across routes', () => {
  it.each([401, 403, 404])('clears overview, passport contact and match when any route returns %i', async (denial) => {
    let status = 200;
    let token: string | null = 'session-one';
    const fetcher = jest.fn(async (url: RequestInfo | URL) => {
      const path = new URL(String(url)).pathname;
      const value = path.endsWith('/overview') ? overview : path.endsWith(`/passports/${passportId}`)
        ? { ...card, contact: { availability: 'AVAILABLE', kind: 'SELF', email: 'private@example.test' } } : match;
      return { ok: status === 200, status, json: async () => value } as Response;
    });
    const makeApi = () => createAnalystWorkspaceApi({ getAccessToken: () => token, apiBaseUrl: 'http://localhost:3100', fetcher });
    const home = new AnalystWorkspaceStateMachine(makeApi());
    const passport = passportDetailState(makeApi(), passportId);
    const selectedMatch = matchDetailState(makeApi(), matchId);
    try {
      await Promise.all([home.load(), passport.load(), selectedMatch.load()]);
      expect(home.state.overview?.pending.data[0]?.playerName).toBe('Jugador protegido');
      expect(passport.state.value?.contact).toMatchObject({ email: 'private@example.test' });
      expect(selectedMatch.state.value?.playerName).toBe('Jugador protegido');
      status = denial;
      await selectedMatch.load();
      expect(home.state).toMatchObject({ kind: 'restricted', overview: null });
      expect(passport.state).toMatchObject({ kind: 'restricted', value: null });
      expect(selectedMatch.state).toMatchObject({ kind: 'restricted', value: null });
      const refreshed = passportDetailState(makeApi(), passportId);
      await refreshed.load();
      expect(refreshed.state).toMatchObject({ kind: 'restricted', value: null });
      refreshed.dispose();
      token = null;
      const reopened = passportDetailState(makeApi(), passportId);
      await reopened.load();
      expect(reopened.state).toMatchObject({ kind: 'restricted', value: null });
      reopened.dispose();
      const homeView = await render(<AnalystOverviewView overview={home.state.overview} kind={home.state.kind}
        onRetry={jest.fn()} onCalendar={jest.fn()} />);
      expect(homeView.queryByText('Jugador protegido')).toBeNull();
      await homeView.unmount();
      const passportView = await render(<AnalystPassportDetailView detail={passport.state.value} kind={passport.state.kind}
        onBack={jest.fn()} onRetry={jest.fn()} />);
      expect(passportView.queryByText('private@example.test')).toBeNull();
      await passportView.unmount();
      const matchView = await render(<AnalystMatchDetailView detail={selectedMatch.state.value} kind={selectedMatch.state.kind}
        onBack={jest.fn()} onRetry={jest.fn()} />);
      expect(matchView.queryByText('Jugador protegido')).toBeNull();
      await matchView.unmount();
    } finally { home.dispose(); passport.dispose(); selectedMatch.dispose(); }
  });

  it('cannot revive an in-flight prior identity response after local context loss', async () => {
    let release!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    const api = createAnalystWorkspaceApi({ getAccessToken: () => 'session-two', apiBaseUrl: 'http://localhost:3100',
      fetcher: async () => pending });
    const home = new AnalystWorkspaceStateMachine(api);
    const loading = home.load();
    home.clear();
    release({ ok: true, status: 200, json: async () => overview } as Response);
    await loading;
    expect(home.state).toMatchObject({ kind: 'restricted', overview: null });
    home.dispose();
  });

  it('rejects a response begun with an earlier session token after account navigation', async () => {
    let token = 'old-session';
    let release!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    const api = createAnalystWorkspaceApi({ getAccessToken: () => token, apiBaseUrl: 'http://localhost:3100',
      fetcher: async () => pending });
    const home = new AnalystWorkspaceStateMachine(api);
    const loading = home.load();
    token = 'new-session';
    release({ ok: true, status: 200, json: async () => overview } as Response);
    await loading;
    expect(home.state).toMatchObject({ kind: 'restricted', overview: null });
    home.dispose();
  });

  it('clears paginated passport and match collections after a direct-link denial', async () => {
    let denyDetail = false;
    const api = createAnalystWorkspaceApi({ getAccessToken: () => 'list-session', apiBaseUrl: 'http://localhost:3100',
      fetcher: async (url) => {
        const path = new URL(String(url)).pathname;
        const denied = denyDetail && path.endsWith(`/${matchId}`);
        const value = path.endsWith('/passports') ? { data: [card], pagination: { hasMore: false } }
          : path.endsWith('/matches') ? { data: [match], pagination: { hasMore: false } } : match;
        return { ok: !denied, status: denied ? 404 : 200, json: async () => value } as Response;
      } });
    const passportList = passportListState(api);
    const matchList = matchListState(api);
    const detail = matchDetailState(api, matchId);
    try {
      await Promise.all([passportList.load(), matchList.load()]);
      expect(passportList.state.value?.data[0]?.playerName).toBe('Jugador protegido');
      expect(matchList.state.value?.data[0]?.playerName).toBe('Jugador protegido');
      denyDetail = true;
      await detail.load();
      expect(passportList.state).toMatchObject({ kind: 'restricted', value: null });
      expect(matchList.state).toMatchObject({ kind: 'restricted', value: null });
    } finally { passportList.dispose(); matchList.dispose(); detail.dispose(); }
  });
});
