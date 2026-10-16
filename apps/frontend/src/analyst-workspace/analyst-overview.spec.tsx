import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));

import { authenticatedEntry, resolveRootRouteAction } from '../authentication/authenticated-route-policy';
import { createAnalystWorkspaceApi } from './analyst-workspace-api';
import { AnalystWorkspaceStateMachine } from './analyst-workspace-state';
import { AnalystOverviewView } from './analyst-overview';

const analyst = { classification: 'product' as const, capabilities: ['passport.review'] };
const sample = { id: '11111111-1111-4111-8111-111111111111', sourceKind: 'FIRST_MATCH',
  passportId: '22222222-2222-4222-8222-222222222222', maskedReference: 'PAS-••••-2222', playerName: 'Jugador de prueba',
  matchDate: '2026-10-15', matchTime: '10:00', opponent: 'Rival', competition: 'Liga', venue: 'Cancha', state: 'WAITING' as const };
const overview = { timeZone: 'America/Bogota' as const, analystLabel: 'Laura de prueba', pending: { availability: 'AVAILABLE' as const, data: [sample], hasMore: false },
  upcoming: { availability: 'AVAILABLE' as const, data: [], hasMore: false }, completed: { availability: 'UNAVAILABLE' as const } };

describe('Feature 010 Analyst Inicio', () => {
  afterEach(() => jest.restoreAllMocks());

  it('enters Analyst Inicio from a projected capability and retains its nested path', () => {
    expect(authenticatedEntry(analyst)).toBe('/(authenticated)/analyst');
    expect(resolveRootRouteAction('authenticated', '/analyst', analyst)).toEqual({ type: 'none' });
    expect(resolveRootRouteAction('authenticated', '/analyst', { classification: 'product', capabilities: [] }))
      .toEqual({ type: 'replace', href: '/(authenticated)/passports' });
  });

  it.each([1440, 390])('renders the three approved sections without fictional analyses at %i CSS pixels', async (width) => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
    const calendar = jest.fn();
    const screen = await render(<AnalystOverviewView overview={overview} onCalendar={calendar} onRetry={jest.fn()} />);
    expect(screen.getByText('Análisis pendientes')).toBeTruthy();
    expect(screen.getByText('Próximos partidos')).toBeTruthy();
    expect(screen.getByText('Análisis realizados')).toBeTruthy();
    expect(screen.getByText('Jugador de prueba')).toBeTruthy();
    expect(screen.getByText(/Laura de prueba/)).toBeTruthy();
    expect(screen.getByText(/no disponible/i)).toBeTruthy();
    await fireEvent.press(screen.getByText('Ver calendario'));
    expect(calendar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Borrador guardado')).toBeNull();
    expect(screen.queryByText('Continuar')).toBeNull();
    expect(screen.queryByText('Ver historial')).toBeNull();
  });

  it.each([390, 320])('lets mobile cards grow with wrapped upcoming content at %i CSS pixels', async (width) => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 700, scale: 1, fontScale: 1 });
    const longMatch = { ...sample, id: '33333333-3333-4333-8333-333333333333',
      playerName: 'Jugadora de prueba con un nombre largo que ocupa varias líneas en una pantalla estrecha' };
    const screen = await render(<AnalystOverviewView overview={{ ...overview,
      upcoming: { availability: 'AVAILABLE', data: [longMatch], hasMore: false },
    }} onCalendar={jest.fn()} onRetry={jest.fn()} />);
    const upcomingWrapper = screen.getByLabelText('Próximos partidos').parent;
    const completedWrapper = screen.getByLabelText('Análisis realizados').parent;
    expect(ReactNative.StyleSheet.flatten(upcomingWrapper?.props.style).flex).toBeUndefined();
    expect(ReactNative.StyleSheet.flatten(completedWrapper?.props.style).flex).toBeUndefined();
    expect(screen.getByText('Ver calendario')).toBeTruthy();
    expect(screen.getByText(/nombre largo/)).toBeTruthy();
  });

  it('requests no-store data and clears protected state on an authorization failure', async () => {
    let status = 200;
    const fetcher = jest.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => (
      { ok: status === 200, status, json: async () => overview } as Response));
    const api = createAnalystWorkspaceApi({ getAccessToken: () => 'test-token', apiBaseUrl: 'http://localhost:3100', fetcher });
    const machine = new AnalystWorkspaceStateMachine(api);
    await machine.load();
    expect(machine.state.overview?.pending.data[0]?.playerName).toBe('Jugador de prueba');
    for (status of [401, 403, 404]) {
      await machine.load();
      expect(machine.state).toMatchObject({ kind: 'restricted', overview: null });
      status = 200;
      await machine.load();
      expect(machine.state.overview?.pending.data[0]?.playerName).toBe('Jugador de prueba');
    }
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', cache: 'no-store' });
    machine.dispose();
  });

  it('distinguishes loading, restricted and service error without retaining a prior card', async () => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 900, scale: 1, fontScale: 1 });
    const retry = jest.fn();
    const loading = await render(<AnalystOverviewView overview={null} kind="loading" onCalendar={jest.fn()} onRetry={retry} />);
    expect(loading.getByText(/cargando/i)).toBeTruthy();
    await loading.rerender(<AnalystOverviewView overview={null} kind="restricted" onCalendar={jest.fn()} onRetry={retry} />);
    expect(loading.queryByText('Jugador de prueba')).toBeNull();
    expect(loading.getByText(/acceso restringido/i)).toBeTruthy();
    await loading.rerender(<AnalystOverviewView overview={null} kind="error" onCalendar={jest.fn()} onRetry={retry} />);
    await fireEvent.press(loading.getByText('Reintentar'));
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
  });
});
