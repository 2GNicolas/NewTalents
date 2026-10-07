import { fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';

import { OPERATIONAL_GROUPS, type OperationalGroupView, type OperationalRequest } from '../administrator-api';
import { AdminRequestsWorkspace } from './admin-requests-workspace';
import type { AdminRequestsView } from './admin-requests-state';

const groupLabels = ['Nuevas', 'Continuar revisión', 'Requieren corrección', 'Listas para decisión', 'Esperando verificación de eliminación de evidencias'];
const actionLabels = ['Revisar solicitud', 'Continuar revisión', 'Ver corrección', 'Tomar decisión', 'Ver eliminación'];
const cards = OPERATIONAL_GROUPS.map((operationalGroup, index): OperationalRequest => ({
  requestId: `request-${index}`,
  requestVersion: 3,
  maskedReference: `SOL-••••-000${index}`,
  displayLabel: `Solicitante ${index}`,
  requestType: index === 2 ? 'FORMAL_ACADEMY' : 'PERSONAL_ADULT',
  operationalGroup,
  relevantAt: '2026-09-30T15:00:00.000Z',
  nextAction: ['REVIEW', 'CONTINUE', 'VIEW_CORRECTION', 'DECIDE', 'VIEW_DELETION'][index] as OperationalRequest['nextAction'],
}));
const groups: readonly OperationalGroupView[] = OPERATIONAL_GROUPS.map((group, index) => ({ group, total: index + 1, items: [cards[index]!] }));
const view: AdminRequestsView = { filters: {}, completeFilters: {}, selectedGroup: 'NEW', groups, state: 'ready', completeList: { rows: [], scrollOffset: 0, state: 'idle' } };

describe('AdminRequestsWorkspace', () => {
  it('renders selectable workflow tabs with backend counts and only the selected group requests', async () => {
    const onOpen = jest.fn();
    const onOperationalGroup = jest.fn();
    const screen = await render(<AdminRequestsWorkspace view={view} onOperationalGroup={onOperationalGroup} onSearch={jest.fn()} onRequestType={jest.fn()} onOpen={onOpen} onOpenAll={jest.fn()} onRetry={jest.fn()} previewMode="desktop" reducedMotion />);
    groupLabels.forEach((label, index) => expect(screen.getByRole('button', { name: `${label}: ${index + 1}` })).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Nuevas: 1' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByRole('button', { name: 'Revisar solicitud: Solicitante 0' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continuar revisiÃ³n: Solicitante 1' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: `${groupLabels[2]}: 3` }));
    expect(onOperationalGroup).toHaveBeenCalledWith('REQUIRES_CORRECTION');
    expect(screen.getAllByText(`SOL-${cards[0]!.requestId.toUpperCase()}`).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Persona adulta').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Revisar solicitud: Solicitante 0' }));
    expect(onOpen).toHaveBeenCalledWith(cards[0]);
  });

  it('supports search, type filtering and the complete-list entry without color-only meaning', async () => {
    const onSearch = jest.fn(); const onRequestType = jest.fn(); const onOpenAll = jest.fn();
    const screen = await render(<AdminRequestsWorkspace view={view} onOperationalGroup={jest.fn()} onSearch={onSearch} onRequestType={onRequestType} onOpen={jest.fn()} onOpenAll={onOpenAll} onRetry={jest.fn()} previewMode="mobile" />);
    await fireEvent.changeText(screen.getByLabelText('Buscar solicitudes'), 'Camila');
    await fireEvent.press(screen.getByRole('button', { name: 'Filtrar por Academia formal' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ver todas las solicitudes' }));
    expect(onSearch).toHaveBeenCalledWith('Camila');
    expect(onRequestType).toHaveBeenCalledWith('FORMAL_ACADEMY');
    expect(onOpenAll).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: `${groupLabels[4]}: 5` })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver todas las solicitudes' })).toHaveStyle({ minHeight: 48 });
  });

  it('renders loading, empty, restricted, unavailable and error with non-color messages', async () => {
    const states = [
      ['loading', 'Cargando solicitudes…'], ['empty', 'No hay solicitudes que requieran atención.'], ['restricted', 'No tienes acceso a este espacio.'],
      ['unavailable', 'El espacio de solicitudes no está disponible.'], ['error', 'No pudimos cargar las solicitudes.'],
    ] as const;
    const screen = await render(<View>{states.map(([state]) => <AdminRequestsWorkspace key={state} view={{ ...view, groups: [], state }} onOperationalGroup={jest.fn()} onSearch={jest.fn()} onRequestType={jest.fn()} onOpen={jest.fn()} onOpenAll={jest.fn()} onRetry={jest.fn()} previewMode="mobile" />)}</View>);
    states.forEach(([, copy]) => expect(screen.getByText(copy)).toBeTruthy());
  });
});
