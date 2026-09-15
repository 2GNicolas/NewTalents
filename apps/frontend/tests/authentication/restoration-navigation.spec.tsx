import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import { RestorationGate } from '../../src/authentication/components/restoration-gate';
import { AuthenticationProvider, useAuthentication } from '../../src/authentication/authentication-provider';
import type { AuthenticationApi } from '../../src/authentication/authentication-api';
import { SessionStorage } from '../../src/authentication/session-storage';

describe('restoration route gate', () => {
  it.each(['restoring', 'refreshing'] as const)('keeps protected content hidden while %s', async (phase) => {
    const screen = await render(<RestorationGate phase={phase}><>Contenido protegido</></RestorationGate>);
    expect(screen.getAllByLabelText('Restaurando sesión').length).toBeGreaterThan(0);
    expect(screen.queryByText('Contenido protegido')).toBeNull();
  });

  it('selects the controlled boundary only after valid, invalid, connectivity, or unavailable restoration outcomes', async () => {
    const authenticated = await render(<RestorationGate phase="authenticated"><Text>Entrada autenticada</Text></RestorationGate>);
    expect(authenticated.getByText('Entrada autenticada')).toBeTruthy();

    const invalid = await render(<RestorationGate phase="unauthenticated"><Text>Inicio de sesión</Text></RestorationGate>);
    expect(invalid.getByText('Inicio de sesión')).toBeTruthy();

    const offline = await render(<RestorationGate phase="connectivity-failure"><Text>Inicio de sesión</Text></RestorationGate>);
    expect(offline.getByText('No pudimos conectar con New Talents.')).toBeTruthy();
    expect(offline.queryByText('Inicio de sesión')).toBeNull();

    const unavailable = await render(<RestorationGate phase="backend-unavailable"><Text>Inicio de sesión</Text></RestorationGate>);
    expect(unavailable.getByText('New Talents no está disponible ahora.')).toBeTruthy();
    expect(unavailable.queryByText('Inicio de sesión')).toBeNull();
  });

  it('waits for provider renewal before showing the authenticated boundary', async () => {
    const values = new Map<string, string>();
    const storage = new SessionStorage({ platform: 'web', webStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) } });
    await storage.save({ accessToken: 'test-access-not-usable', refreshToken: 'test-refresh-not-usable' });
    let resolveRefresh!: (value: { kind: 'success'; value: { accessToken: string; refreshToken: string; tokenType: 'Bearer'; expiresIn: number } }) => void;
    const api: AuthenticationApi = {
      refresh: jest.fn(() => new Promise((resolve) => { resolveRefresh = resolve; })),
      login: jest.fn(), activateInitialAccess: jest.fn(), logoutCurrent: jest.fn(), logoutAll: jest.fn(),
    };
    const Probe = () => { const { state } = useAuthentication(); return <RestorationGate phase={state.phase}><Text>Entrada autenticada</Text></RestorationGate>; };

    const screen = await render(<AuthenticationProvider dependencies={{ api, storage }}><Probe /></AuthenticationProvider>);
    expect(screen.queryByText('Entrada autenticada')).toBeNull();
    resolveRefresh({ kind: 'success', value: { accessToken: 'test-access-next-not-usable', refreshToken: 'test-refresh-next-not-usable', tokenType: 'Bearer', expiresIn: 900 } });
    await waitFor(() => expect(screen.getByText('Entrada autenticada')).toBeTruthy());
    expect(api.refresh).toHaveBeenCalledTimes(1);
  });
});
