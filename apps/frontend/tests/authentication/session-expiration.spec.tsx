import { Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AuthenticationProvider, useAuthentication, type AuthenticationProviderValue } from '../../src/authentication/authentication-provider';
import type { AuthenticationApi } from '../../src/authentication/authentication-api';
import { SessionStorage } from '../../src/authentication/session-storage';
import { SessionStatus } from '../../src/authentication/components/session-status';

const issued = { accessToken: 'test-access-not-usable', refreshToken: 'test-refresh-not-usable', tokenType: 'Bearer' as const, expiresIn: 900 };
function storage() { const values = new Map<string, string>(); return new SessionStorage({ platform: 'web', webStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) } }); }

describe('session expiration and retry safety', () => {
  it('keeps a retryable refresh failure authenticated, while rejected refresh clears the session', async () => {
    const api: AuthenticationApi = { login: jest.fn().mockResolvedValue({ kind: 'success', value: issued }), activateInitialAccess: jest.fn(), refresh: jest.fn().mockResolvedValueOnce({ kind: 'connectivity-failure' }).mockResolvedValueOnce({ kind: 'rejected-refresh' }), logoutCurrent: jest.fn(), logoutAll: jest.fn() };
    let current: AuthenticationProviderValue | undefined;
    const Probe = () => { current = useAuthentication(); return <Text>{current.state.phase}:{current.state.notice ?? 'none'}</Text>; };
    const screen = await render(<AuthenticationProvider dependencies={{ api, storage: storage() }}><Probe /></AuthenticationProvider>);
    await waitFor(() => expect(screen.getByText('unauthenticated:none')).toBeTruthy());
    await act(async () => { await current?.login({ email: 'persona@example.test', password: 'test-password-not-usable' }); });
    await act(async () => { await current?.refresh(); });
    expect(screen.getByText('authenticated:connectivity-failure')).toBeTruthy();
    await act(async () => { await current?.refresh(); });
    expect(screen.getByText('session-expired:session-expired')).toBeTruthy();
  });

  it('presents pending, retryable, and expired session states without exposing secrets', async () => {
    const screen = await render(<SessionStatus state={{ phase: 'session-expired', notice: 'session-expired' }} onRetry={jest.fn()} onReturnToLogin={jest.fn()} />);
    expect(screen.getByText('Tu sesión ha expirado')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Volver al inicio de sesión' })).toBeTruthy();
    expect(screen.queryByText(/test-access|test-refresh|token/i)).toBeNull();
    const retry = jest.fn();
    const retryScreen = await render(<SessionStatus state={{ phase: 'authenticated', notice: 'connectivity-failure' }} onRetry={retry} onReturnToLogin={jest.fn()} />);
    await fireEvent.press(retryScreen.getByRole('button', { name: 'Reintentar' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
