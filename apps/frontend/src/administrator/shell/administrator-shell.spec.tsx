import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AdministratorShell, administratorRouteBackgroundStyle } from './administrator-shell';

describe('AdministratorShell', () => {
  it('exposes Pasaportes between Expedientes and Custodia with visible active state', async () => {
    const onNavigate = jest.fn();
    const onLogout = jest.fn();
    const screen = await render(<AdministratorShell active="requests" onNavigate={onNavigate} onLogout={onLogout} previewMode="desktop"><Text>Contenido</Text></AdministratorShell>);
    for (const label of ['Inicio', 'Solicitudes', 'Expedientes', 'Pasaportes', 'Custodia']) expect(screen.getByRole('button', { name: label })).toBeTruthy();
    const labels = screen.getAllByRole('button').map((button) => button.props.accessibilityLabel);
    expect(labels.indexOf('Expedientes')).toBeLessThan(labels.indexOf('Pasaportes'));
    expect(labels.indexOf('Pasaportes')).toBeLessThan(labels.indexOf('Custodia'));
    expect(screen.getByRole('button', { name: 'Solicitudes' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.queryByText('Administrador autorizado')).toBeNull();
    expect(screen.getByTestId('administrator-shell-frame')).toHaveStyle({ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' });
    expect(administratorRouteBackgroundStyle).toMatchObject({ minHeight: '100vh', width: '100%' });
    expect(screen.getByTestId('administrator-shell-background')).toHaveStyle({ width: '100%' });
    expect(screen.getByTestId('administrator-sidebar')).toHaveStyle({ height: '100vh', position: 'sticky', top: 0 });
    for (const [label, destination] of [['Inicio', 'home'], ['Solicitudes', 'requests'], ['Expedientes', 'dossiers'], ['Pasaportes', 'passports'], ['Custodia', 'custody']] as const) {
      await fireEvent.press(screen.getByRole('button', { name: label }));
      expect(onNavigate).toHaveBeenCalledWith(destination);
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('uses bottom navigation on mobile with accessible touch targets', async () => {
    const onLogout = jest.fn();
    const screen = await render(<AdministratorShell active="requests" onNavigate={jest.fn()} onLogout={onLogout} previewMode="mobile"><Text>Contenido</Text></AdministratorShell>);
    expect(screen.getByTestId('administrator-bottom-navigation')).toBeTruthy();
    expect(screen.queryByTestId('administrator-sidebar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Inicio' })).toHaveStyle({ minHeight: 48 });
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
