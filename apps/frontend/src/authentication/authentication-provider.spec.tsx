import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';

import { AuthenticationProvider, useAuthentication, type AuthenticationProviderValue } from './authentication-provider';
import type { AuthenticationApi } from './authentication-api';
import { SessionStorage } from './session-storage';

const issued = { accessToken: 'test-access-not-usable', refreshToken: 'test-refresh-not-usable', tokenType: 'Bearer' as const, expiresIn: 900 };

function webStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
}

describe('AuthenticationProvider', () => {
  it('exposes state and approved intents while encapsulating HTTP and storage boundaries', async () => {
    const api: AuthenticationApi = {
      login: jest.fn().mockResolvedValue({ kind: 'success', value: issued }),
      activateInitialAccess: jest.fn(), refresh: jest.fn(), logoutCurrent: jest.fn(), logoutAll: jest.fn(),
    };
    const storage = new SessionStorage({ platform: 'web', webStorage: webStorage() });
    let current: AuthenticationProviderValue | undefined;
    const Probe = () => { current = useAuthentication(); return <Text>{current.state.phase}</Text>; };

    const screen = await render(<AuthenticationProvider dependencies={{ api, storage }}><Probe /></AuthenticationProvider>);
    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeTruthy());
    await act(async () => { await current?.login({ email: 'persona@example.test', password: 'test-password-not-usable' }); });

    expect(screen.getByText('authenticated')).toBeTruthy();
    expect(Object.keys(current ?? {})).not.toEqual(expect.arrayContaining(['api', 'storage', 'refreshCoordinator']));
  });

  it('keeps transport failures inside the active form and allows a later retry', async () => {
    const api: AuthenticationApi = {
      login: jest.fn().mockResolvedValueOnce({ kind: 'connectivity-failure' }).mockResolvedValueOnce({ kind: 'generic-authentication-failure' }),
      activateInitialAccess: jest.fn().mockResolvedValueOnce({ kind: 'connectivity-failure' }).mockResolvedValueOnce({ kind: 'generic-authentication-failure' }),
      refresh: jest.fn(), logoutCurrent: jest.fn(), logoutAll: jest.fn(),
    };
    let current: AuthenticationProviderValue | undefined;
    const Probe = () => { current = useAuthentication(); return <Text>{`${current.state.phase}:${current.state.notice ?? 'none'}`}</Text>; };
    const screen = await render(<AuthenticationProvider dependencies={{ api, storage: new SessionStorage({ platform: 'web', webStorage: webStorage() }) }}><Probe /></AuthenticationProvider>);
    await waitFor(() => expect(screen.getByText('unauthenticated:none')).toBeTruthy());

    await act(async () => { await current?.login({ email: 'persona@example.test', password: 'test-password-not-usable' }); });
    expect(screen.getByText('unauthenticated:connectivity-failure')).toBeTruthy();
    await act(async () => { await current?.login({ email: 'persona@example.test', password: 'test-password-not-usable' }); });
    expect(api.login).toHaveBeenCalledTimes(2);
    expect(screen.getByText('unauthenticated:generic-authentication-failure')).toBeTruthy();

    await act(async () => { await current?.activateInitialAccess({ email: 'persona@example.test', temporaryCredential: 'test-temporary-not-usable', newPassword: 'test-password-not-usable' }); });
    expect(screen.getByText('activation-ready:connectivity-failure')).toBeTruthy();
    await act(async () => { await current?.activateInitialAccess({ email: 'persona@example.test', temporaryCredential: 'test-temporary-not-usable', newPassword: 'test-password-not-usable' }); });
    expect(api.activateInitialAccess).toHaveBeenCalledTimes(2);
    expect(screen.getByText('activation-ready:generic-authentication-failure')).toBeTruthy();
  });

  it('clears activation-specific failures before returning to login', async () => {
    const api: AuthenticationApi = { login: jest.fn(), activateInitialAccess: jest.fn().mockResolvedValue({ kind: 'connectivity-failure' }), refresh: jest.fn(), logoutCurrent: jest.fn(), logoutAll: jest.fn() };
    let current: AuthenticationProviderValue | undefined;
    const Probe = () => { current = useAuthentication(); return <Text>{`${current.state.phase}:${current.state.notice ?? 'none'}`}</Text>; };
    const screen = await render(<AuthenticationProvider dependencies={{ api, storage: new SessionStorage({ platform: 'web', webStorage: webStorage() }) }}><Probe /></AuthenticationProvider>);
    await waitFor(() => expect(screen.getByText('unauthenticated:none')).toBeTruthy());
    await act(async () => { await current?.activateInitialAccess({ email: 'persona@example.test', temporaryCredential: 'test-temporary-not-usable', newPassword: 'test-password-not-usable' }); });
    expect(screen.getByText('activation-ready:connectivity-failure')).toBeTruthy();
    await act(async () => { current?.prepareLogin(); });
    expect(screen.getByText('unauthenticated:none')).toBeTruthy();
  });
});
