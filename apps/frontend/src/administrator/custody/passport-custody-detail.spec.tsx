import { fireEvent, render } from '@testing-library/react-native';

import type { CustodyPassportDetail } from '../administrator-api';
import { PassportCustodyDetail } from './passport-custody-detail';

const detail: CustodyPassportDetail = {
  passportId: '70000000-0000-4000-8000-000000000005', maskedReference: 'PAS-••••-0005', displayLabel: 'Valentina Pérez',
  lifecycleState: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT', academyLabel: 'Academia Horizonte',
  custody: { state: 'ASSIGNED', version: 3, analyst: { identityId: '70000000-0000-4000-8000-000000000002', displayLabel: 'Laura M.', activeCustodyCount: 8 }, assignedAt: '2026-09-30T16:00:00.000Z' },
  capabilities: ['CHANGE', 'REMOVE'],
  originRequest: { id: '70000000-0000-4000-8000-000000000003', maskedReference: 'SOL-••••-0003', displayLabel: 'Valentina Pérez', status: 'APPROVED', available: true },
  linkedDossier: { id: '70000000-0000-4000-8000-000000000004', maskedReference: 'EXP-••••-0004', displayLabel: 'Expediente Valentina Pérez', status: 'APPROVED', available: true },
  history: [
    { eventId: '1', at: '2026-09-30T16:00:00.000Z', action: 'ASSIGNED', actorLabel: 'Administrador', nextAnalystLabel: 'Laura M.' },
    { eventId: '2', at: '2026-10-01T08:00:00.000Z', action: 'CHANGED', actorLabel: 'Administrador', previousAnalystLabel: 'Laura M.', nextAnalystLabel: 'Sofía R.', reason: 'Balance de carga' },
  ],
};

describe('PassportCustodyDetail', () => {
  it('renders minimum current custody, links, chronological history, and presentation-only creation milestone', async () => {
    const view = await render(<PassportCustodyDetail state="ready" detail={detail} onRetry={jest.fn()} onBack={jest.fn()} onOpenRequest={jest.fn()} onOpenDossier={jest.fn()} onAssign={jest.fn()} onChange={jest.fn()} onRemove={jest.fn()} />);
    expect(view.getByRole('header', { name: 'Pasaporte' })).toBeTruthy();
    expect(view.getByText(`Jugador: ${detail.displayLabel}`)).toBeTruthy();
    expect(view.getByText('Pasaporte creado · Sin asignar')).toBeTruthy();
    expect(view.getByText('Asignado a Laura M.')).toBeTruthy();
    expect(view.getByText('Cambio de Laura M. a Sofía R.')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Abrir solicitud de origen' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Abrir expediente confirmado' })).toBeTruthy();
    expect(JSON.stringify(view.toJSON())).not.toMatch(/EXP-|SOL-|PAS-|70000000-0000-4000/);
    expect(JSON.stringify(view.toJSON())).not.toMatch(/email|documento|credencial|objectKey/i);
  });

  it('keeps keyboard/touch actions explicit and invokes existing confirmation entry points', async () => {
    const onChange = jest.fn(); const onRemove = jest.fn();
    const view = await render(<PassportCustodyDetail state="ready" detail={detail} onRetry={jest.fn()} onBack={jest.fn()} onOpenRequest={jest.fn()} onOpenDossier={jest.fn()} onAssign={jest.fn()} onChange={onChange} onRemove={onRemove} />);
    await fireEvent.press(view.getByRole('button', { name: 'Cambiar Analista' }));
    await fireEvent.press(view.getByRole('button', { name: 'Retirar custodia' }));
    expect(onChange).toHaveBeenCalledWith(detail);
    expect(onRemove).toHaveBeenCalledWith(detail);
  });

  it('announces the dossier as the return destination when opened from a dossier', async () => {
    const view = await render(<PassportCustodyDetail state="ready" detail={detail} backLabel="Volver al expediente" onRetry={jest.fn()} onBack={jest.fn()} onOpenRequest={jest.fn()} onOpenDossier={jest.fn()} onAssign={jest.fn()} onChange={jest.fn()} onRemove={jest.fn()} />);
    expect(view.getByRole('button', { name: 'Volver al expediente' })).toBeTruthy();
  });

  it.each([
    ['loading', 'Cargando pasaporte…'], ['restricted', 'No tienes acceso a este pasaporte.'], ['missing', 'No encontramos este pasaporte.'],
    ['unavailable', 'El pasaporte no está disponible en este momento.'], ['error', 'No pudimos cargar el pasaporte.'],
  ] as const)('renders the %s state with safe recovery behavior', async (state, copy) => {
    const retry = jest.fn();
    const view = await render(<PassportCustodyDetail state={state} onRetry={retry} onBack={jest.fn()} onOpenRequest={jest.fn()} onOpenDossier={jest.fn()} onAssign={jest.fn()} onChange={jest.fn()} onRemove={jest.fn()} />);
    expect(view.getByText(copy)).toBeTruthy();
    if (state === 'unavailable' || state === 'error') await fireEvent.press(view.getByRole('button', { name: 'Reintentar' }));
    if (state === 'unavailable' || state === 'error') expect(retry).toHaveBeenCalled();
  });

  it('renders inaccessible links as non-interactive unavailable context', async () => {
    const view = await render(<PassportCustodyDetail state="ready" detail={{ ...detail, originRequest: { ...detail.originRequest, available: false }, linkedDossier: { ...detail.linkedDossier, available: false } }} onRetry={jest.fn()} onBack={jest.fn()} onOpenRequest={jest.fn()} onOpenDossier={jest.fn()} onAssign={jest.fn()} onChange={jest.fn()} onRemove={jest.fn()} />);
    expect(view.getAllByText('Enlace no disponible')).toHaveLength(2);
    expect(view.queryByRole('button', { name: /Abrir solicitud/ })).toBeNull();
  });
});
