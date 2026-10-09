import { fireEvent, render } from '@testing-library/react-native';

import { AdminPassportsList } from './admin-passports-list';

const items = [
  { id: '10000000-0000-4000-8000-000000000001', playerLabel: 'Jugador activo', maskedReference: 'PAS-••••-0001', state: 'ACTIVE', canConfigure: true },
  { id: '10000000-0000-4000-8000-000000000002', playerLabel: 'Jugador inactivo', maskedReference: 'PAS-••••-0002', state: 'INACTIVE', canConfigure: false },
];
const props = { items, state: 'ready' as const, page: 0, canGoPrevious: false, canGoNext: true, onOpen: jest.fn(), onRetry: jest.fn(), onNext: jest.fn(), onPrevious: jest.fn() };

describe('AdminPassportsList', () => {
  it('shows one responsive card collection across states, with safe references and accessible actions', async () => {
    const view = await render(<AdminPassportsList {...props} previewMode="mobile" />);
    expect(view.getByRole('header', { name: 'Pasaportes' })).toBeTruthy();
    expect(view.getByText('Jugador activo')).toBeTruthy();
    expect(view.getByText('Jugador inactivo')).toBeTruthy();
    expect(view.getByText('Pasaporte: PAS-••••-0001')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Abrir pasaporte de Jugador inactivo' }));
    expect(props.onOpen).toHaveBeenCalledWith(items[1]?.id);
    await fireEvent.press(view.getByRole('button', { name: 'Siguiente' }));
    expect(props.onNext).toHaveBeenCalled();
  });

  it.each([
    ['loading', 'Cargando pasaportes…'], ['empty', 'Aún no hay pasaportes.'], ['restricted', 'No tienes acceso a Pasaportes.'],
    ['unavailable', 'Pasaportes no está disponible en este momento.'], ['error', 'No pudimos cargar Pasaportes.'],
  ] as const)('shows %s state', async (state, copy) => {
    const view = await render(<AdminPassportsList {...props} items={[]} state={state} previewMode="desktop" />);
    expect(view.getByText(copy)).toBeTruthy();
  });
});
