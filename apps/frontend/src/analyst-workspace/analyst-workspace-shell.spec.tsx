import { fireEvent, render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));

import { AnalystWorkspaceShell } from './analyst-workspace-shell';

describe('Analyst workspace chrome', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([1440, 390])('uses the approved emerald backdrop and offers real logout at %i pixels', async (width) => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
    const logout = jest.fn();
    const screen = await render(<AnalystWorkspaceShell current="Inicio" accountLabel="Laura de prueba"
      onLogout={logout}><ReactNative.Text>Contenido autorizado</ReactNative.Text></AnalystWorkspaceShell>);
    expect(screen.getByTestId('analyst-workspace-background')).toBeTruthy();
    expect(screen.getByText('LD')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
