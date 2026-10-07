import { fireEvent, render } from '@testing-library/react-native';

import type { DossierDetail } from '../administrator-api';
import { AdminDossierDetail } from './admin-dossier-detail';

const detail: DossierDetail = { dossierId: '20000000-0000-4000-8000-000000000001', dossierName: 'exp-prueba-001', maskedReference: 'EXP-••••-0001', displayLabel: 'Valentina Pérez', status: 'APPROVED', confirmedAt: '2026-09-29T16:42:00.000Z', requestType: 'ACADEMY_MINOR_PLAYER', originRequest: { id: '30000000-0000-4000-8000-000000000001', maskedReference: 'SOL-••••-0001', displayLabel: 'Valentina Pérez', status: 'APPROVED', available: true }, linkedPassport: { id: '40000000-0000-4000-8000-000000000001', maskedReference: 'PAS-••••-0001', displayLabel: 'Valentina Pérez', status: 'ACTIVE', available: true }, confirmationHistory: [{ at: '2026-09-29T16:42:00.000Z', action: 'DOSSIER_CONFIRMED', actorLabel: 'ADMINISTRATOR' }, { at: '2026-09-29T16:52:00.000Z', action: 'EVIDENCE_DELETION_VERIFIED', actorLabel: 'SYSTEM' }, { at: '2026-09-29T17:00:00.000Z', action: 'APPROVAL_FINALIZED', actorLabel: 'SYSTEM' }] };

describe('AdminDossierDetail', () => {
  it('renders read-only confirmation history and authorized request/passport links', async () => {
    const openRequest = jest.fn(); const openPassport = jest.fn();
    const view = await render(<AdminDossierDetail state="ready" detail={detail} onBack={jest.fn()} onRetry={jest.fn()} onOpenRequest={openRequest} onOpenPassport={openPassport} />);
    expect(view.getByRole('header', { name: 'Detalle del expediente' })).toBeTruthy(); expect(view.getByText('Confirmación administrativa')).toBeTruthy(); expect(view.getByText('Eliminación verificada')).toBeTruthy();
    expect(view.getByText(detail.displayLabel)).toBeTruthy();
    expect(view.getByText('Nombre del expediente')).toBeTruthy();
    expect(view.getAllByText('exp-prueba-001').length).toBeGreaterThan(0);
    expect(view.getByText('Jugador')).toBeTruthy();
    expect(JSON.stringify(view.toJSON())).not.toMatch(/EXP-|SOL-|PAS-|20000000-0000-4000|30000000-0000-4000|40000000-0000-4000/);
    await fireEvent.press(view.getByRole('button', { name: 'Abrir solicitud de origen' })); await fireEvent.press(view.getByRole('button', { name: 'Abrir pasaporte' }));
    expect(openRequest).toHaveBeenCalledWith(detail.originRequest.id); expect(openPassport).toHaveBeenCalledWith('40000000-0000-4000-8000-000000000001');
    expect(JSON.stringify(view.toJSON())).not.toMatch(/Editar|Confirmar expediente|Aprobar|documento|contacto|credencial|objectKey/i);
  });

  it('handles notApplicable, inaccessible links and all safe states', async () => {
    const view = await render(<AdminDossierDetail state="ready" detail={{ ...detail, originRequest: { ...detail.originRequest, available: false }, linkedPassport: { notApplicable: true } }} onBack={jest.fn()} onRetry={jest.fn()} onOpenRequest={jest.fn()} onOpenPassport={jest.fn()} />);
    expect(view.getByText('No aplica para este tipo de origen')).toBeTruthy(); expect(view.queryByRole('button', { name: /Abrir solicitud/ })).toBeNull();
    for (const [state, copy] of [['loading', 'Cargando expediente…'], ['restricted', 'No tienes acceso a este expediente.'], ['missing', 'No encontramos este expediente.'], ['unavailable', 'El expediente no está disponible en este momento.'], ['error', 'No pudimos cargar el expediente.']] as const) {
      const stateView = await render(<AdminDossierDetail state={state} onBack={jest.fn()} onRetry={jest.fn()} onOpenRequest={jest.fn()} onOpenPassport={jest.fn()} />); expect(stateView.getByText(copy)).toBeTruthy();
    }
  });
});
