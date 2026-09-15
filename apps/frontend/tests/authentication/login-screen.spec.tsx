import { fireEvent, render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import LoginScreen from '../../app/(auth)/login';
import { AuthenticationProvider } from '../../src/authentication/authentication-provider';
import { AuthLayout } from '../../src/design/components/auth-layout';
import { AuthenticationVisualPanel } from '../../src/design/components/auth-visual-panel';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));

describe('login screen', () => {
  it('validates email and password locally without submitting invalid input', async () => {
    const screen = await render(<AuthenticationProvider><LoginScreen /></AuthenticationProvider>);
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(screen.getByLabelText('Introduce un correo válido.')).toBeTruthy();
    expect(screen.getByLabelText('La contraseña debe tener entre 12 y 128 caracteres.')).toBeTruthy();
  });

  it('provides a visible password control, safe generic states, and the initial-access action', async () => {
    const screen = await render(<AuthenticationProvider><LoginScreen /></AuthenticationProvider>);
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Activar acceso inicial' })).toBeTruthy();
    expect(screen.queryByText(/registro|olvidé|google|facebook/i)).toBeNull();
  });

  it('uses the approved compact login title and never renders the former welcome copy', async () => {
    const screen = await render(<AuthenticationProvider><LoginScreen /></AuthenticationProvider>);
    expect(screen.getByRole('header', { name: 'Iniciar sesión' })).toBeTruthy();
    expect(screen.getByText('Continúa construyendo tu perfil deportivo.')).toBeTruthy();
    expect(screen.queryByText('Bienvenido')).toBeNull();
    expect(screen.queryByText(/Accede de forma segura/i)).toBeNull();
  });

  it('uses a full-height desktop split with a 60/40 visual-to-form proportion and no floating card constraint', async () => {
    const screen = await render(<AuthLayout viewportWidth={1200} viewportHeight={800} visual={<AuthenticationVisualPanel journey="login" />}><ReactNative.Text>Formulario</ReactNative.Text></AuthLayout>);
    const desktop = screen.getByTestId('auth-layout-desktop');
    const desktopChildren = desktop.children.filter((child): child is typeof desktop => typeof child !== 'string');
    expect(desktopChildren[0]?.props.testID).toBe('auth-visual-region');
    expect(desktopChildren[1]?.props.testID).toBe('auth-form-region');
    const visualChildren = desktopChildren[0]?.children.filter((child): child is typeof desktop => typeof child !== 'string') ?? [];
    expect(visualChildren[0]?.props.testID).toBe('authentication-visual-login');
    expect(desktopChildren[0]?.props.style).toEqual(expect.objectContaining({ flexBasis: '60%' }));
    expect(desktopChildren[1]?.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ flexBasis: '40%' })]));
    expect(desktop.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: '100%' })]));
    expect(desktop.props.style).not.toEqual(expect.arrayContaining([expect.objectContaining({ maxWidth: expect.anything() })]));
    expect(screen.getByTestId('authentication-liquid-glass')).toBeTruthy();
    const login = await render(<AuthenticationProvider><LoginScreen /></AuthenticationProvider>);
    expect(login.getByTestId('login-form-flow')).toBeTruthy();
    expect(login.getByTestId('login-primary-action')).toBeTruthy();
    expect(login.getByTestId('login-activation-action')).toBeTruthy();
    expect(login.queryByTestId('auth-fixed-action')).toBeNull();
  });

  it('uses a full-height single-column mobile composition with a compact gradient visual and scrollable form', async () => {
    const screen = await render(<AuthLayout viewportWidth={390} viewportHeight={500} visual={<AuthenticationVisualPanel journey="login" />}><ReactNative.Text>Formulario</ReactNative.Text></AuthLayout>);
    expect(screen.getByTestId('auth-layout-mobile')).toBeTruthy();
    expect(screen.queryByTestId('auth-visual-region')).toBeNull();
    expect(screen.getByTestId('auth-mobile-visual-region')).toBeTruthy();
    expect(screen.getByTestId('auth-form-scroll')).toBeTruthy();
    const login = await render(<AuthenticationProvider><LoginScreen /></AuthenticationProvider>);
    expect(login.queryByTestId('mobile-football-decoration')).toBeNull();
    expect(login.queryByText('EL TALENTO MUEVE EL MUNDO')).toBeNull();
  });

  it('uses only the local abstract visual at runtime and never imports the rejected player direction', () => {
    const loginSource = readFileSync(resolve(process.cwd(), 'app/(auth)/login.tsx'), 'utf8');
    const activationSource = readFileSync(resolve(process.cwd(), 'app/(auth)/activate-initial-access.tsx'), 'utf8');
    const visualSource = readFileSync(resolve(process.cwd(), 'src/design/components/auth-visual-panel.tsx'), 'utf8');
    expect(loginSource).toContain('AuthenticationVisualPanel');
    expect(activationSource).toContain('AuthenticationVisualPanel');
    expect(`${loginSource}${activationSource}`).not.toContain('ScoutingHero');
    expect(`${loginSource}${activationSource}`).not.toContain('scouting-player-hero-v1.png');
    expect(visualSource).toContain('liquid-emerald-abstract-v1.png');
    expect(visualSource).not.toContain('docs/design');
  });

  it('matches the approved visual hierarchy with a lower glass message and external progress rail', async () => {
    const screen = await render(<AuthenticationVisualPanel journey="login" />);
    expect(screen.getByTestId('authentication-liquid-glass')).toBeTruthy();
    expect(screen.getByText('Tu talento merece ser visto.')).toBeTruthy();
    expect(screen.getByText('Accede a la plataforma donde tu evidencia construye oportunidades.')).toBeTruthy();
    expect(screen.getByTestId('authentication-progress-login')).toBeTruthy();
    expect(screen.getByText('01')).toBeTruthy();
    expect(screen.getByText('Identifícate')).toBeTruthy();
    expect(screen.getByText('02')).toBeTruthy();
    expect(screen.getByText('Accede')).toBeTruthy();
    expect(screen.getByText('03')).toBeTruthy();
    expect(screen.getByText('Proyéctate')).toBeTruthy();
  });

  it('declares dynamic viewport-height coverage on web without a floating-card maximum', () => {
    const layoutSource = readFileSync(resolve(process.cwd(), 'src/design/components/auth-layout.tsx'), 'utf8');
    expect(layoutSource).toContain("'100dvh'");
    expect(layoutSource).not.toContain('maxWidth: 900');
    expect(layoutSource).not.toContain('maxHeight: 640');
  });
});
