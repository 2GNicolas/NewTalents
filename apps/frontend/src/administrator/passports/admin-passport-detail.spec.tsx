import { fireEvent, render } from '@testing-library/react-native';

import type { AdminPassportDetail, CustodyPassportDetail } from '../administrator-api';
import { AdminPassportDetailView } from './admin-passport-detail';

const passport: AdminPassportDetail = { passport: { id: '10000000-0000-4000-8000-000000000001', playerLabel: 'Mateo González', maskedReference: 'PAS-••••-0001', state: 'ACTIVE', canConfigure: true }, allowance: { colombiaToday: '2026-10-09', configuration: null } };
const custody: CustodyPassportDetail = { passportId: passport.passport.id, maskedReference: passport.passport.maskedReference, displayLabel: passport.passport.playerLabel, lifecycleState: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT', custody: { state: 'UNASSIGNED', version: 0 }, capabilities: ['ASSIGN'], originRequest: { id: '20000000-0000-4000-8000-000000000001', maskedReference: 'SOL-••••-0001', status: 'APPROVED', available: true }, linkedDossier: { id: '30000000-0000-4000-8000-000000000001', maskedReference: 'EXP-••••-0001', status: 'APPROVED', available: true }, history: [] };
const props = { state: 'ready' as const, detail: passport, custody, onBack: jest.fn(), onRetry: jest.fn(), onOpenRequest: jest.fn(), onOpenDossier: jest.fn(), onOpenCustody: jest.fn(), onPropose: jest.fn(), onDiscard: jest.fn(), onConfirm: jest.fn() };

describe('Administrator passport detail', () => {
  it('preserves existing custody, links and history while adding the approved allowance hierarchy', async () => {
    const view = await render(<AdminPassportDetailView {...props} previewMode="desktop" />);
    expect(view.getByText('Custodia actual')).toBeTruthy();
    expect(view.getByText('Registros vinculados')).toBeTruthy();
    expect(view.getByText('Historial de custodia')).toBeTruthy();
    expect(view.getByRole('header', { name: 'Configuración de partidos' })).toBeTruthy();
    expect(view.getByText('Sin configuración')).toBeTruthy();
    expect(view.getByText(/Fecha de activación:.*2026/)).toBeTruthy();
    expect(JSON.stringify(view.toJSON())).not.toMatch(/utilizados|disponibles|barra de progreso|programar partidos|foto del jugador/i);
    await fireEvent.press(view.getByRole('button', { name: 'Abrir solicitud de origen' }));
    expect(props.onOpenRequest).toHaveBeenCalledWith(custody.originRequest.id);
  });

  it('shows specific positive-integer validation, confirmation and discard without a mutation before confirm', async () => {
    const view = await render(<AdminPassportDetailView {...props} previewMode="mobile" />);
    await fireEvent.changeText(view.getByLabelText('Partidos permitidos'), '0');
    await fireEvent.press(view.getByRole('button', { name: 'Guardar configuración' }));
    expect(view.getByText('Ingresa un número entero positivo de partidos.')).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText('Partidos permitidos'), '4');
    await fireEvent.press(view.getByRole('button', { name: 'Guardar configuración' }));
    expect(view.getByText('Revisar configuración')).toBeTruthy();
    expect(props.onConfirm).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Cancelar confirmación' }));
    await fireEvent.press(view.getByRole('button', { name: 'Descartar cambios' }));
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('makes non-active passports read-only with explicit restricted and unavailable states', async () => {
    const inactive = { ...passport, passport: { ...passport.passport, state: 'INACTIVE', canConfigure: false } };
    const view = await render(<AdminPassportDetailView {...props} detail={inactive} custody={undefined} previewMode="mobile" />);
    expect(view.queryByRole('button', { name: 'Guardar configuración' })).toBeNull();
    expect(view.getByText('Solo consulta')).toBeTruthy();
    const denied = await render(<AdminPassportDetailView {...props} detail={undefined} custody={undefined} state="restricted" />);
    expect(denied.getByText('No tienes acceso a este pasaporte.')).toBeTruthy();
  });
});
