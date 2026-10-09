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

  it('refreshes backend-projected capabilities after approval without decoding token roles', async () => {
    const pendingMaterial = { ...issued, access: { classification: 'pending-onboarding' as const, requestId: '22222222-2222-4222-8222-222222222222', capabilities: ['registration.request.own.view'] } };
    const approvedMaterial = { ...issued, accessToken: 'rotated-access-not-usable', refreshToken: 'rotated-refresh-not-usable', access: { classification: 'product' as const, capabilities: ['passport.particular.manage'] } };
    const api: AuthenticationApi = {
      login: jest.fn().mockResolvedValue({ kind: 'success', value: pendingMaterial }),
      activateInitialAccess: jest.fn(),
      refresh: jest.fn().mockResolvedValue({ kind: 'success', value: approvedMaterial }),
      logoutCurrent: jest.fn(),
      logoutAll: jest.fn(),
    };
    let current: AuthenticationProviderValue | undefined;
    const Probe = () => { current = useAuthentication(); return <Text>{current.sessionAccess?.classification ?? 'none'}</Text>; };
    const screen = await render(<AuthenticationProvider dependencies={{ api, storage: new SessionStorage({ platform: 'web', webStorage: webStorage() }) }}><Probe /></AuthenticationProvider>);
    await waitFor(() => expect(screen.getByText('none')).toBeTruthy());
    await act(async () => { await current?.login({ email: 'pending@example.test', password: 'test-password-not-usable' }); });
    expect(screen.getByText('pending-onboarding')).toBeTruthy();
    await act(async () => { await current?.refreshCapabilities(); });
    expect(screen.getByText('product')).toBeTruthy();
    expect(api.refresh).toHaveBeenCalledWith('test-refresh-not-usable');
  });

  it('can defer the pending route projection until the registration submission finishes', async () => {
    const pendingMaterial = { ...issued, access: { classification: 'pending-onboarding' as const, requestId: '22222222-2222-4222-8222-222222222222', capabilities: ['registration.request.own.view'] } };
    const api: AuthenticationApi = { login: jest.fn().mockResolvedValue({ kind: 'success', value: pendingMaterial }), activateInitialAccess: jest.fn(), refresh: jest.fn().mockResolvedValue({ kind: 'success', value: pendingMaterial }), logoutCurrent: jest.fn(), logoutAll: jest.fn() };
    let current: AuthenticationProviderValue | undefined;
    const Probe = () => { current = useAuthentication(); return <Text>{`${current.state.phase}:${current.sessionAccess?.classification ?? 'none'}`}</Text>; };
    const screen = await render(<AuthenticationProvider dependencies={{ api, storage: new SessionStorage({ platform: 'web', webStorage: webStorage() }) }}><Probe /></AuthenticationProvider>);
    await waitFor(() => expect(screen.getByText('unauthenticated:none')).toBeTruthy());
    await act(async () => { await current?.login({ email: 'pending@example.test', password: 'test-password-not-usable' }, { deferAccessProjection: true }); });
    expect(screen.getByText('authenticated:none')).toBeTruthy();
    await act(async () => { await current?.refreshCapabilities(); });
    expect(screen.getByText('authenticated:pending-onboarding')).toBeTruthy();
  });
});
