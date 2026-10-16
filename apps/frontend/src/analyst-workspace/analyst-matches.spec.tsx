import { fireEvent, render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));

import { AnalystMatchListView, AnalystMatchDetailView } from './analyst-matches';
import { createAnalystWorkspaceApi } from './analyst-workspace-api';

const row = { id: '22222222-2222-4222-8222-222222222222', sourceKind: 'FIRST_MATCH',
  passportId: '11111111-1111-4111-8111-111111111111', maskedReference: 'PAS-1111', playerName: 'Jugadora sintética',
  matchDate: '2026-10-18', matchTime: '10:00', opponent: 'Rival', competition: 'Liga', venue: 'Cancha', state: 'WAITING' as const };

describe('Feature 010 Analyst Partidos', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each([1440, 390])('groups confirmed matches and opens the read-only detail at %i pixels', async (width) => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
    const open = jest.fn();
    const view = await render(<AnalystMatchListView data={[row, { ...row, id: '33333333-3333-4333-8333-333333333333', playerName: 'Otra jugadora' }]}
      hasMore={false} kind="ready" onOpen={open} onRetry={jest.fn()} />);
    expect(view.getByText('Agenda de partidos')).toBeTruthy();
    expect(view.getAllByText(/18 OCT 2026/i)).toHaveLength(1);
    expect(view.getByText('Jugadora sintética')).toBeTruthy();
    expect(view.getAllByText(/Competencia/)).toHaveLength(2);
    fireEvent.press(view.getAllByText('Ver partido')[0]);
    expect(open).toHaveBeenCalledWith(row.id);
    expect(view.queryByText(/programar|capturar|aprobar|orden propuesto/i)).toBeNull();
  });
  it('does not call a valid load a completed analysis and distinguishes empty/restricted', async () => {
    const view = await render(<AnalystMatchDetailView detail={{ ...row, state: 'LOADED' }} kind="ready" onBack={jest.fn()} onRetry={jest.fn()} />);
    expect(view.getAllByText(/Carga confirmada/i).length).toBeGreaterThan(0);
    expect(view.queryByText('Análisis realizado')).toBeNull();
    await view.rerender(<AnalystMatchListView data={[]} hasMore={false} kind="ready" onOpen={jest.fn()} onRetry={jest.fn()} />);
    expect(view.getByText(/No hay partidos confirmados/i)).toBeTruthy();
    await view.rerender(<AnalystMatchListView data={[]} hasMore={false} kind="restricted" onOpen={jest.fn()} onRetry={jest.fn()} />);
    expect(view.getByText(/Acceso restringido/i)).toBeTruthy();
    expect(view.queryByText('Jugadora sintética')).toBeNull();
  });
  it('requests source-backed pages and detail with no-store', async () => {
    const fetcher = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [row], pagination: { hasMore: false } }) } as Response));
    const api = createAnalystWorkspaceApi({ getAccessToken: () => 'token', apiBaseUrl: 'http://localhost:3100', fetcher });
    expect(await api.matches()).toMatchObject({ kind: 'success', value: { data: [row] } });
    expect(fetcher.mock.calls[0]?.[0]).toContain('/analyst/workspace/matches');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', cache: 'no-store' });
  });
});
