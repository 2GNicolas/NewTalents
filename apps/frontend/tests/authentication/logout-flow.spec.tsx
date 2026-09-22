import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AuthenticationProvider, useAuthentication, type AuthenticationProviderValue } from '../../src/authentication/authentication-provider';
import { SessionControls } from '../../src/authentication/components/session-controls';
import type { AuthenticationApi } from '../../src/authentication/authentication-api';
import { SessionStorage } from '../../src/authentication/session-storage';

const issued = { accessToken: 'test-access-not-usable', refreshToken: 'test-refresh-not-usable', tokenType: 'Bearer' as const, expiresIn: 900 };
function storage() { const values = new Map<string, string>(); return new SessionStorage({ platform: 'web', webStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) } }); }

describe('session closure', () => {
  it('keeps current and all-session closure distinct, requiring confirmation only for all sessions', async () => {
    const api: AuthenticationApi = { login: jest.fn().mockResolvedValue({ kind: 'success', value: issued }), activateInitialAccess: jest.fn(), refresh: jest.fn(), logoutCurrent: jest.fn().mockResolvedValue({ kind: 'success', value: undefined }), logoutAll: jest.fn().mockResolvedValue({ kind: 'success', value: undefined }) };
    let current: AuthenticationProviderValue | undefined;
    const Probe = () => { current = useAuthentication(); return null; };
    const screen = await render(<AuthenticationProvider dependencies={{ api, storage: storage() }}><SessionControls /><Probe /></AuthenticationProvider>);
    await waitFor(() => expect(current?.state.phase).toBe('unauthenticated'));
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar todas las sesiones' }));
    expect(screen.getAllByLabelText('Cerrar todas las sesiones')).toHaveLength(3);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.logoutAll).not.toHaveBeenCalled();
    await act(async () => { await current?.login({ email: 'persona@example.test', password: 'test-password-not-usable' }); });
    await act(async () => { await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' })); });
    expect(api.logoutCurrent).toHaveBeenCalledTimes(1);
    await act(async () => { await current?.login({ email: 'persona@example.test', password: 'test-password-not-usable' }); });
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar todas las sesiones' }));
    const closeAll = screen.getAllByRole('button', { name: 'Cerrar todas las sesiones' });
    await act(async () => { await fireEvent.press(closeAll[1]!); });
    expect(api.logoutAll).toHaveBeenCalledTimes(1);
  });
});