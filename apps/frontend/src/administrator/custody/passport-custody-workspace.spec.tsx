import { fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';

import { buildAnalystSummaryFixture, buildLinkedPassportSummaryFixture } from '../testing/feature-007-fixtures';
import type { PassportCustodyView } from './passport-custody-state';
import { PassportCustodyWorkspace } from './passport-custody-workspace';

const analyst = buildAnalystSummaryFixture();
const passport = buildLinkedPassportSummaryFixture();
const assigned = { ...passport, custody: { state: 'ASSIGNED' as const, version: 1, analyst, assignedAt: '2026-09-30T16:00:00.000Z' }, capabilities: ['CHANGE', 'REMOVE'] as const };
const view: PassportCustodyView = { query: '', state: 'ready', unassigned: { items: [passport] }, assigned: { items: [assigned] }, analysts: [analyst] };

describe('PassportCustodyWorkspace', () => {
  it('shows unassigned and Analyst columns with minimum safe passport and live workload content', async () => {
    const screen = await render(<PassportCustodyWorkspace view={view} onSearch={jest.fn()} onRetry={jest.fn()} onSelectDestination={jest.fn()} previewMode="desktop" />);
    expect(screen.getByRole('header', { name: 'Sin Analista' })).toBeTruthy();
    expect(screen.getByRole('header', { name: analyst.displayLabel })).toBeTruthy();
    expect(screen.getByText(`${analyst.activeCustodyCount} custodias activas`)).toBeTruthy();
    expect(screen.getAllByText(`PAS-${passport.passportId.toUpperCase()}`).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Activo básico/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('En espera de enriquecimiento del Analista').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: `Asignar Analista a ${passport.displayLabel}` })).toBeNull();
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/correo|documento|credencial|contacto/i);
  });

  it('offers the mobile Asignar path and only reports a temporary destination selection', async () => {
    const onSelectDestination = jest.fn();
    const screen = await render(<PassportCustodyWorkspace view={view} onSearch={jest.fn()} onRetry={jest.fn()} onSelectDestination={onSelectDestination} previewMode="mobile" />);
    const assign = screen.getByRole('button', { name: `Asignar Analista a ${passport.displayLabel}` });
    expect(assign).toHaveStyle({ minHeight: 44 });
    await fireEvent.press(assign);
    expect(screen.queryByRole('button', { name: `Analistas, ${view.analysts.length}` })).toBeNull();
    const select = screen.getByRole('button', { name: `Asignar ${analyst.displayLabel} a ${passport.displayLabel}` });
    expect(select).toHaveStyle({ minHeight: 44 });
    await fireEvent.press(select);
    expect(onSelectDestination).toHaveBeenCalledWith(passport.passportId, analyst.identityId);
  });

  it('supports search but prevents mobile Analyst navigation until a passport is selected', async () => {
    const onSearch = jest.fn();
    const screen = await render(<PassportCustodyWorkspace view={view} onSearch={onSearch} onRetry={jest.fn()} onSelectDestination={jest.fn()} previewMode="mobile" />);
    await fireEvent.changeText(screen.getByLabelText('Buscar jugador o pasaporte'), 'Jugador');
    expect(onSearch).toHaveBeenCalledWith('Jugador');
    expect(screen.queryByText(`${analyst.activeCustodyCount} custodias activas`)).toBeNull();
    expect(screen.queryByRole('button', { name: `Analistas, ${view.analysts.length}` })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: `Asignar Analista a ${passport.displayLabel}` }));
    expect(screen.getByText(`${analyst.activeCustodyCount} custodias activas`)).toBeTruthy();
  });

  it('renders loading, empty, restricted, unavailable and error states with explicit text', async () => {
    const states = [
      ['loading', 'Cargando custodia…'],
      ['empty', 'No hay pasaportes o Analistas elegibles disponibles.'],
      ['restricted', 'No tienes acceso al espacio de Custodia.'],
      ['unavailable', 'Custodia no está disponible en este momento.'],
      ['error', 'No pudimos cargar la custodia.'],
    ] as const;
    const screen = await render(<View>{states.map(([state]) => <PassportCustodyWorkspace key={state} view={{ ...view, state, unassigned: { items: [] }, assigned: { items: [] }, analysts: [] }} onSearch={jest.fn()} onRetry={jest.fn()} onSelectDestination={jest.fn()} previewMode="mobile" />)}</View>);
    states.forEach(([, copy]) => expect(screen.getByText(copy)).toBeTruthy());
  });
});
