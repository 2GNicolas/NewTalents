import { fireEvent, render } from '@testing-library/react-native';

import { AdminHome } from './admin-home';

const ready = { state: 'ready' as const, requestsPending: 12, confirmedDossiers: 4, unassignedPassports: 7, assignedPassports: 19, analysts: [
  { identityId: 'a', displayLabel: 'Laura M.', activeCustodyCount: 8 },
  { identityId: 'b', displayLabel: 'Sebastián R.', activeCustodyCount: 6 },
  { identityId: 'c', displayLabel: 'Natalia C.', activeCustodyCount: 5 },
] };

describe('AdminHome', () => {
  it('renders projection-owned metrics, consultation-safe copy, and keyboard/touch actions', async () => {
    const onNavigate = jest.fn();
    const screen = await render(<AdminHome view={ready} previewMode="desktop" onNavigate={onNavigate} onRetry={jest.fn()} />);
    expect(screen.getByRole('header', { name: 'Inicio' })).toBeTruthy();
    for (const label of ['Solicitudes pendientes', 'Expedientes confirmados', 'Pasaportes sin Analista', 'Pasaportes con Analista', 'Carga por Analista', 'Actividad prioritaria']) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText(/por confirmar/i)).toBeNull();
    expect(screen.queryByText('Administrador autorizado')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Revisar solicitudes' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir expedientes' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Asignar custodia' }));
    expect(onNavigate.mock.calls.map(([destination]) => destination)).toEqual(['requests', 'dossiers', 'custody']);
    expect(screen.getByRole('button', { name: 'Ver custodia de Laura M.' })).toHaveStyle({ minHeight: 44 });
  });

  it('stacks the dashboard for mobile and exposes explicit recoverable states', async () => {
    const mobile = await render(<AdminHome view={ready} previewMode="mobile" onNavigate={jest.fn()} onRetry={jest.fn()} />);
    expect(mobile.getByTestId('administrator-home-metrics')).toHaveStyle({ flexWrap: 'wrap' });
    const retry = jest.fn();
    const failed = await render(<AdminHome view={{ state: 'error' }} previewMode="desktop" onNavigate={jest.fn()} onRetry={retry} />);
    await fireEvent.press(failed.getByRole('button', { name: 'Reintentar' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
