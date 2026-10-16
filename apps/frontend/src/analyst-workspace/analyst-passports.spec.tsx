import { fireEvent, render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));

import { AnalystPassportListView, AnalystPassportDetailView } from './analyst-passports';
import { createAnalystWorkspaceApi } from './analyst-workspace-api';
import { passportDetailState } from './analyst-passport-state';

const card = { passportId: '11111111-1111-4111-8111-111111111111', maskedReference: 'PAS-••••-1111',
  playerName: 'Jugadora sintética', lifecycleState: 'ACTIVE' as const, custodyState: 'ASSIGNED_TO_ACTOR' as const,
  nextMatch: { id: '22222222-2222-4222-8222-222222222222', matchDate: '2026-11-01', matchTime: '10:00',
    opponent: 'Rival', venue: 'Cancha' } };

describe('Feature 010 Analyst Pasaportes', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([1440, 390])('shows the authorized portfolio and read-only entry at %i pixels', async (width) => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
    const open = jest.fn();
    const screen = await render(<AnalystPassportListView data={[card]} hasMore={false} kind="ready" onOpen={open} onRetry={jest.fn()} />);
    expect(screen.getByText('Pasaportes bajo mi custodia')).toBeTruthy();
    expect(screen.getByText('Jugadora sintética')).toBeTruthy();
    expect(screen.getByText('PAS-••••-1111')).toBeTruthy();
    expect(screen.getByText(/Asignado a ti/)).toBeTruthy();
    expect(screen.getByText(/Próximo partido programado/i)).toBeTruthy();
    await fireEvent.press(screen.getByText('Abrir pasaporte'));
    expect(open).toHaveBeenCalledWith(card.passportId);
    expect(screen.queryByText(/teléfono|correo|contacto/i)).toBeNull();
    expect(screen.queryByText(/asignar|aprobar|devolver/i)).toBeNull();
  });

  it('shows only the selected contact channels in detail or a safe unavailable message', async () => {
    const screen = await render(<AnalystPassportDetailView detail={{ ...card, contact: { availability: 'AVAILABLE',
      kind: 'LEGAL_REPRESENTATIVE', phone: '+570000000002', email: 'representante@example.test' } }}
      kind="ready" onBack={jest.fn()} onRetry={jest.fn()} />);
    expect(screen.getByText('Jugadora sintética')).toBeTruthy();
    expect(screen.getByText(/\+570000000002/)).toBeTruthy();
    expect(screen.getByText(/representante@example.test/)).toBeTruthy();
    await screen.rerender(<AnalystPassportDetailView detail={{ ...card, contact: { availability: 'UNAVAILABLE' } }}
      kind="ready" onBack={jest.fn()} onRetry={jest.fn()} />);
    expect(screen.getByText('Contacto no disponible')).toBeTruthy();
    expect(screen.queryByText(/representante@example.test/)).toBeNull();
  });

  it('does not claim there are no pending matches merely because no future match is scheduled', async () => {
    const noFuture = { ...card, nextMatch: undefined };
    const list = await render(<AnalystPassportListView data={[noFuture]} hasMore={false} kind="ready"
      onOpen={jest.fn()} onRetry={jest.fn()} />);
    expect(list.getByText('Sin próximo partido programado')).toBeTruthy();
    expect(list.queryByText('Sin partidos pendientes')).toBeNull();
    await list.rerender(<AnalystPassportDetailView detail={{ ...noFuture, contact: { availability: 'UNAVAILABLE' } }}
      kind="ready" onBack={jest.fn()} onRetry={jest.fn()} />);
    expect(list.getByText('Sin próximo partido programado')).toBeTruthy();
  });

  it('distinguishes empty, restricted and error without retaining a previous name', async () => {
    const screen = await render(<AnalystPassportListView data={[]} hasMore={false} kind="ready" onOpen={jest.fn()} onRetry={jest.fn()} />);
    expect(screen.getByText(/no tienes pasaportes/i)).toBeTruthy();
    await screen.rerender(<AnalystPassportListView data={[]} hasMore={false} kind="restricted" onOpen={jest.fn()} onRetry={jest.fn()} />);
    expect(screen.getByText(/acceso restringido/i)).toBeTruthy();
    expect(screen.queryByText('Jugadora sintética')).toBeNull();
    await screen.rerender(<AnalystPassportListView data={[]} hasMore={false} kind="error" onOpen={jest.fn()} onRetry={jest.fn()} />);
    expect(screen.getByText(/no está disponible/i)).toBeTruthy();
  });

  it('requests detail without caching and clears name/contact after direct-link denial', async () => {
    let status = 200;
    const fetcher = jest.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => ({ ok: status === 200, status, json: async () => ({ ...card,
      contact: { availability: 'AVAILABLE', kind: 'SELF', phone: '+570000000001' } }) } as Response));
    const api = createAnalystWorkspaceApi({ getAccessToken: () => 'test-token', apiBaseUrl: 'http://localhost:3100', fetcher });
    const machine = passportDetailState(api, card.passportId);
    await machine.load();
    expect(machine.state.value?.playerName).toBe('Jugadora sintética');
    status = 404;
    await machine.load();
    expect(machine.state).toMatchObject({ kind: 'restricted', value: null });
    expect(fetcher.mock.calls[0]?.[0]).toContain(`/analyst/workspace/passports/${card.passportId}`);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', cache: 'no-store' });
    machine.dispose();
  });
});
