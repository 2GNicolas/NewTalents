import { fireEvent, render } from '@testing-library/react-native';

import { AllowanceSection } from './allowance-section';

const allowance = { colombiaToday: '2026-10-09', configuration: { version: 2, activatedOn: '2026-10-09', currentRule: { cadence: 'MONTHLY' as const, matchLimit: 4, effectiveOn: '2026-10-09' }, currentPeriod: { start: '2026-10-09', endExclusive: '2026-11-09' }, pendingRule: { cadence: 'QUARTERLY' as const, matchLimit: 6, effectiveOn: '2026-11-09' }, lastModifiedAt: '2026-10-10T15:00:00Z' } };
const history = [{ sequence: 2, confirmedAt: '2026-10-10T15:00:00Z', actorLabel: 'Administrador de New Talents', effectiveOn: '2026-11-09', previousRule: { cadence: 'MONTHLY' as const, matchLimit: 4, effectiveOn: '2026-10-09' }, newRule: { cadence: 'QUARTERLY' as const, matchLimit: 6, effectiveOn: '2026-11-09' } }];

describe('AllowanceSection updates', () => {
  it('separates current from pending, fixed activation and safe history, then confirms explicitly', async () => {
    const onPropose = jest.fn(); const onConfirm = jest.fn();
    const view = await render(<AllowanceSection playerLabel="Mateo" canConfigure allowance={allowance} history={history} onPropose={onPropose} onDiscard={jest.fn()} onConfirm={onConfirm} />);
    expect(view.getByText(/4 partidos por mensual/i)).toBeTruthy();
    expect(view.getByText(/Cambio confirmado para/)).toBeTruthy();
    expect(view.getByText('Historial de configuración')).toBeTruthy();
    expect(view.getByText(/Última modificación:/)).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText('Partidos permitidos'), '8');
    await fireEvent.press(view.getByRole('button', { name: 'Guardar configuración' }));
    expect(onPropose).toHaveBeenCalledWith('QUARTERLY', 8);
    expect(onConfirm).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Confirmar configuración' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
