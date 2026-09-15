import { render } from '@testing-library/react-native';

import AuthenticatedRouteShell from '../../app/(authenticated)/index';
import { AuthenticationProvider } from '../../src/authentication/authentication-provider';

describe('neutral authenticated entry', () => {
  it('shows only a neutral session boundary and no product or authorization simulation', async () => {
    const screen = await render(<AuthenticationProvider><AuthenticatedRouteShell /></AuthenticationProvider>);
    expect(screen.getByRole('header', { name: 'Acceso activo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar todas las sesiones' })).toBeTruthy();
    expect(screen.queryByText(/rol|permiso|jugador|pasaporte|academia|partido|estadística|video|pago|notificación/i)).toBeNull();
  });
});
