import { fireEvent, render } from '@testing-library/react-native';

import type { DossierSummary } from '../administrator-api';
import { AdminDossiersList } from './admin-dossiers-list';

const dossier: DossierSummary = { dossierId: '20000000-0000-4000-8000-000000000001', dossierName: 'exp-prueba-001', maskedReference: 'EXP-••••-0001', displayLabel: 'Valentina Pérez', status: 'APPROVED', confirmedAt: '2026-09-29T16:42:00.000Z', requestType: 'ACADEMY_MINOR_PLAYER', originRequest: { id: '30000000-0000-4000-8000-000000000001', maskedReference: 'SOL-••••-0001', status: 'APPROVED', available: true }, linkedPassport: { id: '40000000-0000-4000-8000-000000000001', maskedReference: 'PAS-••••-0001', status: 'ACTIVE', available: true } };
const props = { filters: { limit: 20 } as const, items: [dossier], state: 'ready' as const, page: 0, canGoPrevious: false, canGoNext: true, onFilters: jest.fn(), onRetry: jest.fn(), onOpen: jest.fn(), onNext: jest.fn(), onPrevious: jest.fn(), onScroll: jest.fn() };

describe('AdminDossiersList', () => {
  it('renders responsive confirmed-only cards/table with safe links and pagination', async () => {
    const view = await render(<AdminDossiersList {...props} previewMode="desktop" />);
    expect(view.getByRole('header', { name: 'Expedientes' })).toBeTruthy();
    expect(view.getByText('exp-prueba-001')).toBeTruthy();
    expect(view.getByText('Nombre del expediente: exp-prueba-001')).toBeTruthy();
    expect(view.getByText(`Jugador: ${dossier.displayLabel}`)).toBeTruthy();
    expect(JSON.stringify(view.toJSON())).not.toMatch(/EXP-|SOL-|PAS-|20000000-0000-4000|30000000-0000-4000|40000000-0000-4000/);
    await fireEvent.press(view.getByRole('button', { name: 'Abrir expediente' })); expect(props.onOpen).toHaveBeenCalledWith(dossier.dossierId);
    expect(view.queryByText(/Confirmar|Editar|Aprobar|Evidencia/i)).toBeNull();
  });

  it('provides accessible search/filter controls and explicit empty/error states', async () => {
    const filters = jest.fn(); const retry = jest.fn();
    const ready = await render(<AdminDossiersList {...props} onFilters={filters} previewMode="mobile" />);
    await fireEvent.changeText(ready.getByLabelText('Buscar expedientes'), 'Valentina'); expect(filters).toHaveBeenCalledWith(expect.objectContaining({ query: 'Valentina' }));
    for (const [state, copy] of [['loading', 'Cargando expedientes…'], ['empty', 'Aún no hay expedientes confirmados.'], ['no-results', 'No hay expedientes que coincidan con los filtros.'], ['restricted', 'No tienes acceso a Expedientes.'], ['unavailable', 'Expedientes no está disponible en este momento.'], ['error', 'No pudimos cargar Expedientes.']] as const) {
      const view = await render(<AdminDossiersList {...props} state={state} items={[]} onRetry={retry} />); expect(view.getByText(copy)).toBeTruthy();
    }
  });
});
