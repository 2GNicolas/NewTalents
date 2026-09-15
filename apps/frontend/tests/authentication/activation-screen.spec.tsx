import { fireEvent, render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import ActivateInitialAccessScreen, { ActivationSuccess } from '../../app/(auth)/activate-initial-access';
import { AuthenticationProvider, useAuthentication } from '../../src/authentication/authentication-provider';
import type { AuthenticationApi } from '../../src/authentication/authentication-api';
import { SessionStorage } from '../../src/authentication/session-storage';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }));

describe('initial access activation screen', () => {
  it('explains the external channel and validates only the approved replacement password rule', async () => {
    const screen = await render(<AuthenticationProvider><ActivateInitialAccessScreen /></AuthenticationProvider>);
    expect(screen.getByText(/canal externo/i)).toBeTruthy();
    expect(screen.getByText('La nueva contraseña debe tener entre 12 y 128 caracteres.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nueva contraseña'), 'test-password-not-usable');
    await fireEvent.press(screen.getByRole('button', { name: 'Activar acceso' }));
    expect(screen.getByLabelText('Confirma tu nueva contraseña.')).toBeTruthy();
  });

  it('uses the exact activation success continuation copy and never sends the user back to login', async () => {
    const screen = await render(<ActivationSuccess onContinue={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeTruthy();
    expect(screen.queryByText(/Continuar al inicio de sesión/i)).toBeNull();
  });

  it('enters authenticated state only after the successful activation action Continuar', async () => {
    const api: AuthenticationApi = {
      activateInitialAccess: jest.fn().mockResolvedValue({ kind: 'success', value: { accessToken: 'test-access-not-usable', refreshToken: 'test-refresh-not-usable', tokenType: 'Bearer', expiresIn: 900 } }),
      login: jest.fn(), refresh: jest.fn(), logoutCurrent: jest.fn(), logoutAll: jest.fn(),
    };
    let phase = '';
    const Probe = () => { phase = useAuthentication().state.phase; return null; };
    const screen = await render(<AuthenticationProvider dependencies={{ api, storage: new SessionStorage({ platform: 'web' }) }}><ActivateInitialAccessScreen /><Probe /></AuthenticationProvider>);
    await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'persona@example.test');
    await fireEvent.changeText(screen.getByLabelText('Credencial temporal'), 'test-temporary-not-usable');
    await fireEvent.changeText(screen.getByLabelText('Nueva contraseña'), 'test-password-not-usable');
    await fireEvent.changeText(screen.getByLabelText('Confirmar nueva contraseña'), 'test-password-not-usable');
    await fireEvent.press(screen.getByRole('button', { name: 'Activar acceso' }));
    expect(screen.getByText('Acceso activado')).toBeTruthy();
    expect(phase).toBe('activation-success');
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    expect(phase).toBe('authenticated');
  });

  it.each([390, 1200])('keeps the activation hierarchy at %ipx', async (width) => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
    const screen = await render(<AuthenticationProvider><ActivateInitialAccessScreen /></AuthenticationProvider>);
    expect(screen.getByRole('header', { name: 'Activar acceso inicial' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Activar acceso' })).toBeTruthy();
    jest.restoreAllMocks();
  });

  it('uses the approved activation progress rail without changing the activation controls', async () => {
    const screen = await render(<AuthenticationProvider><ActivateInitialAccessScreen /></AuthenticationProvider>);
    expect(screen.getByText('01')).toBeTruthy();
    expect(screen.getByText('Credencial')).toBeTruthy();
    expect(screen.getByText('02')).toBeTruthy();
    expect(screen.getByText('Contraseña')).toBeTruthy();
    expect(screen.getByText('03')).toBeTruthy();
    expect(screen.getByText('Activación')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Activar acceso' })).toBeTruthy();
  });
});
