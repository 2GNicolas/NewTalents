import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));

import { AnalystMatchCaptureState } from './analyst-match-upload-state';
import { AnalystMatchCaptureView } from './analyst-match-capture';
import { AnalystMatchReviewView } from './analyst-match-review';
import { AnalystMatchFinalStep } from './analyst-match-final-step';
import { chronologicalCapturedEvents } from './analyst-match-chronology';
import { wheelGeometry } from './analyst-event-wheel';

const match = { id: '22222222-2222-4222-8222-222222222222', sourceKind: 'FIRST_MATCH',
  passportId: '11111111-1111-4111-8111-111111111111', maskedReference: 'PAS-1111', playerName: 'Jugador sintético',
  matchDate: '2026-10-18', matchTime: '10:00', opponent: 'Rival', competition: 'Liga', venue: 'Cancha', state: 'WAITING' as const };
const api = { capture: jest.fn(async () => ({ kind: 'success' as const, value: { matchId: match.id,
  sourceKind: 'FIRST_MATCH' as const, passportId: match.passportId, availability: 'AVAILABLE' as const, expectedVersion: 1 } })) };

describe('Feature 011 capture, review and final step', () => {
  beforeEach(() => api.capture.mockClear());
  it('uses one page heading followed by nested section headings on every capture step', async () => {
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load();
    const screens = [
      { view: <AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />, levels: [1, 2] },
      { view: <AnalystMatchReviewView match={match} state={machine.state} machine={machine} />, levels: [1, 2, 2] },
      { view: <AnalystMatchFinalStep match={match} state={machine.state} machine={machine} />, levels: [1, 2, 2] },
    ];
    const rendered = await render(screens[0]!.view);
    for (const [index, screen] of screens.entries()) {
      if (index > 0) await rendered.rerender(screen.view);
      expect(rendered.getAllByRole('header').map((heading) => heading.props['aria-level'])).toEqual(screen.levels);
      expect(rendered.getByText(match.playerName).props.accessibilityRole).not.toBe('header');
    }
    machine.startEvent(); machine.selectType('GOAL'); machine.updateDraft({ videoMinute: '12' }); machine.saveEvent();
    await rendered.rerender(<AnalystMatchReviewView match={match} state={machine.state} machine={machine} />);
    expect(rendered.getAllByRole('header').map((heading) => heading.props['aria-level'])).toEqual([1, 2, 3, 2]);
    machine.dispose();
  });
  it('keeps every family label outside the wheel perimeter at desktop and mobile scales', () => {
    for (const diameter of [372, 610]) {
      const geometry = wheelGeometry(diameter);
      expect(geometry.familyLabelRadius - geometry.familyLabelHalfExtent)
        .toBeGreaterThan(geometry.wheelOuterRadius);
    }
  });
  it('blocks jumping over unanswered groups and counts selections rather than the active step', async () => {
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load(); machine.startEvent(); machine.selectType('PASS', 'NORMAL'); machine.selectResult('SUCCESS');
    const view = await render(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    const refresh = async () => view.rerender(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    expect(view.getByText('Contexto · 0 de 5')).toBeTruthy();
    expect(view.getByText('Complejidad · 0 de 7')).toBeTruthy();
    expect(view.getByLabelText('Progreso: Temporal').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByLabelText('Progreso: Temporal'));
    expect(machine.state.activeGroup).toBe(0);
    machine.setGroup(11); expect(machine.state.activeGroup).toBe(0);
    machine.updateContext('spatial', { status: 'NOT_OBSERVABLE' }); await refresh();
    expect(machine.state.activeGroup).toBe(1);
    expect(view.getByText('Contexto · 1 de 5')).toBeTruthy();
    expect(view.getByLabelText('Progreso: Competitivo').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByLabelText('Progreso: Espacial')); await refresh();
    expect(machine.state.activeGroup).toBe(0);
    machine.setGroup(2); expect(machine.state.activeGroup).toBe(0);
    machine.updateContext('spatial', { status: 'OBSERVED', value: 'Área rival' }); await refresh();
    expect(machine.state.draft?.context.spatial).toEqual({ status: 'OBSERVED', value: 'Área rival' });
    expect(machine.state.draft?.context.temporal.status).toBe('UNSET');
    expect(view.getByText('Contexto · 1 de 5')).toBeTruthy();
    machine.dispose();
  });
  it('places the video moment below the circular selector and uses named icon actions', async () => {
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load();
    const view = await render(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    const markup = JSON.stringify(view.toJSON());
    expect(markup.indexOf('Elegir evento')).toBeLessThan(markup.indexOf('Minuto del video'));
    machine.startEvent(); machine.selectType('GOAL'); machine.selectResult('NONE'); machine.updateDraft({ videoMinute: '12' });
    for (const key of ['spatial', 'temporal', 'competitive', 'pressure', 'positional'] as const)
      machine.updateContext(key, { status: 'NOT_OBSERVABLE' });
    for (const key of ['technicalDifficulty', 'distance', 'precision', 'executionSpeed', 'opponents', 'nonDominantLimb', 'risk'] as const)
      machine.updateComplexity(key, { status: 'NOT_APPLICABLE' });
    machine.saveEvent();
    await view.rerender(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    expect(view.getByLabelText('Editar evento 1')).toBeTruthy();
    expect(view.getByLabelText('Eliminar evento 1')).toBeTruthy();
    expect(view.queryByText('Corregir evento 1')).toBeNull();
    await fireEvent.press(view.getByLabelText('Editar evento 1'));
    expect(machine.state.editingIndex).toBe(0);
    await fireEvent.press(view.getByLabelText('Eliminar evento 1'));
    expect(machine.state.events).toHaveLength(0);
    machine.dispose();
  });

  it('orders video minutes numerically with added time and stable ties without mutating capture order', () => {
    const entries = [
      { videoMinute: '10', addedTime: '' }, { videoMinute: '9+2', addedTime: '' },
      { videoMinute: '9', addedTime: '1' }, { videoMinute: '9+2', addedTime: '' },
      { videoMinute: '2', addedTime: '' },
    ];
    expect(chronologicalCapturedEvents(entries).map(({ index }) => index)).toEqual([4, 0, 2, 1, 3]);
    expect(entries.map((entry) => entry.videoMinute)).toEqual(['10', '9+2', '9', '9+2', '2']);
  });
  it('saves Gol and Asistencia without measurements while a measured event still requires them', async () => {
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load();
    const view = await render(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    for (const eventType of ['GOAL', 'ASSIST'] as const) {
      machine.startEvent(); machine.selectType(eventType);
      machine.updateDraft({ videoMinute: eventType === 'GOAL' ? '9' : '11' });
      await view.rerender(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
      expect(view.queryByText('Medición guiada')).toBeNull();
      expect(view.queryByText('Resultado')).toBeNull();
      expect(view.queryByLabelText('Sin resultado')).toBeNull();
      expect(view.getByLabelText('Guardar evento')).toBeTruthy();
      await fireEvent.press(view.getByLabelText('Guardar evento'));
      await view.rerender(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
      expect(view.getByLabelText(`Editar evento ${machine.state.events.length}`)).toBeTruthy();
      expect(view.getByLabelText('Elegir evento')).toBeTruthy();
    }
    expect(machine.state.events).toHaveLength(2);
    expect(machine.state.events.map((event) => event.result)).toEqual(['NONE', 'NONE']);
    expect(view.queryByLabelText('Añadir otro evento')).toBeNull();
    expect(view.queryByLabelText('Observación opcional')).toBeNull();
    expect(view.getByLabelText('No participó').props.accessibilityState.disabled).toBe(true);
    expect(machine.setParticipation('DID_NOT_PARTICIPATE')).toBe(false);
    expect(machine.state.events).toHaveLength(2);
    machine.review();
    const review = await render(<AnalystMatchReviewView match={match} state={machine.state} machine={machine} />);
    expect(review.getByText(/Gol/)).toBeTruthy();
    expect(review.getByText(/Asistencia/)).toBeTruthy();
    machine.backToCapture();
    machine.startEvent(); machine.selectType('SHOT'); machine.selectResult('WIDE'); machine.updateDraft({ videoMinute: '13' });
    expect(machine.saveEvent()).toBe(false);
    machine.dispose();
  });
  it('saves an explicitly failed measured event without measurements and keeps a successful one strict', async () => {
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load(); machine.startEvent(); machine.selectType('PASS', 'NORMAL');
    machine.selectResult('FAILURE'); machine.updateDraft({ videoMinute: '22' });
    const view = await render(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    expect(view.queryByText('Medición guiada')).toBeNull();
    expect(view.getByLabelText('Guardar evento')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Guardar evento'));
    expect(machine.state.events).toHaveLength(1);
    machine.startEvent(); machine.selectType('PASS', 'NORMAL'); machine.selectResult('SUCCESS');
    machine.updateDraft({ videoMinute: '24' });
    await view.rerender(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    expect(view.getByText('Medición guiada')).toBeTruthy();
    expect(view.queryByLabelText('Guardar evento')).toBeNull();
    machine.dispose();
  });
  it('identifies the missing video minute after Context 5/5 and Complexity 7/7, then reveals save and review', async () => {
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load(); machine.startEvent(); machine.selectType('PASS', 'NORMAL'); machine.selectResult('SUCCESS');
    for (const key of ['spatial', 'temporal', 'competitive', 'pressure', 'positional'] as const)
      machine.updateContext(key, { status: 'NOT_OBSERVABLE' });
    for (const key of ['technicalDifficulty', 'distance', 'precision', 'executionSpeed', 'opponents', 'nonDominantLimb', 'risk'] as const)
      machine.updateComplexity(key, { status: 'NOT_APPLICABLE' });
    const view = await render(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    expect(view.getByText('Contexto · 5 de 5')).toBeTruthy();
    expect(view.getByText('Complejidad · 7 de 7')).toBeTruthy();
    expect(view.queryByLabelText('Guardar evento')).toBeNull();
    expect(view.getByText('Indica el minuto del video para guardar este evento.')).toBeTruthy();
    expect(view.queryByText(/Completa el evento actual/)).toBeNull();
    expect(view.queryByText(/hasta usar «Guardar evento»/)).toBeNull();
    await fireEvent.changeText(view.getByLabelText('Minuto del video'), '18');
    await view.rerender(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    expect(view.getByLabelText('Guardar evento')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Guardar evento'));
    await view.rerender(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    expect(view.getByLabelText('Editar evento 1')).toBeTruthy();
    machine.review();
    const review = await render(<AnalystMatchReviewView match={match} state={machine.state} machine={machine} />);
    expect(review.getAllByText(/18/).length).toBeGreaterThan(0);
    machine.dispose();
  });

  it('shows a precise missing-field error and keeps measurement values separate from progress', async () => {
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load(); machine.startEvent(); machine.selectType('SHOT'); machine.selectResult('WIDE');
    machine.updateDraft({ videoMinute: '32' });
    const view = await render(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    expect(view.getByLabelText('Progreso: Espacial')).toBeTruthy();
    expect(view.getAllByTestId('measurement-choice-card')).toHaveLength(6);
    machine.startEvent();
    await view.rerender(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    expect(view.getByText('Selecciona el contexto Espacial o «no observable».')).toBeTruthy();
    expect(machine.state.draft?.videoMinute).toBe('32');
    expect(machine.state.events).toHaveLength(0);
    machine.dispose();
  });
  it('keeps the capture legible behind the anchored wheel', async () => {
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load();
    const view = await render(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    await fireEvent.press(view.getByLabelText('Elegir evento'));
    await view.rerender(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    expect(view.getByTestId('event-wheel-expanded-anchor')).toBeTruthy();
    const backdrop = view.getByTestId('event-wheel-backdrop');
    expect(backdrop.props.style.backgroundColor).toMatch(/rgba\(0,\s*\d+,\s*\d+,\s*0\.[0-4]\d*\)/);
    machine.dispose();
  });

  it('reveals a saved event immediately and saves before starting another, without discarding incomplete drafts', async () => {
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load();
    machine.startEvent(); machine.selectType('SHOT'); machine.selectResult('WIDE'); machine.updateDraft({ videoMinute: '18' });
    const view = await render(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    const refresh = async () => view.rerender(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    machine.startEvent(); await refresh();
    expect(machine.state.draft?.videoMinute).toBe('18');
    expect(machine.state.events).toHaveLength(0);
    expect(view.getByText('Selecciona el contexto Espacial o «no observable».')).toBeTruthy();
    for (const key of ['spatial', 'temporal', 'competitive', 'pressure', 'positional'] as const)
      machine.updateContext(key, { status: 'NOT_OBSERVABLE' });
    for (const key of ['technicalDifficulty', 'distance', 'precision', 'executionSpeed', 'opponents', 'nonDominantLimb', 'risk'] as const)
      machine.updateComplexity(key, { status: 'NOT_APPLICABLE' });
    await refresh();
    await fireEvent.press(view.getByLabelText('Guardar evento')); await refresh();
    expect(machine.state.events).toHaveLength(1);
    expect(machine.state.capturedExpanded).toBe(true);
    expect(view.getByLabelText('Editar evento 1')).toBeTruthy();
    expect(view.getByText('18′')).toBeTruthy();
    machine.startEvent(); machine.selectType('PASS', 'NORMAL'); machine.selectResult('SUCCESS'); machine.updateDraft({ videoMinute: '32' });
    for (const key of ['spatial', 'temporal', 'competitive', 'pressure', 'positional'] as const)
      machine.updateContext(key, { status: 'NOT_OBSERVABLE' });
    for (const key of ['technicalDifficulty', 'distance', 'precision', 'executionSpeed', 'opponents', 'nonDominantLimb', 'risk'] as const)
      machine.updateComplexity(key, { status: 'NOT_APPLICABLE' });
    await refresh();
    await fireEvent.press(view.getByLabelText('Guardar evento')); await refresh();
    expect(machine.state.events.map((event) => event.videoMinute)).toEqual(['18', '32']);
    expect(machine.state.draft).toBeNull();
    expect(view.getByLabelText('Editar evento 2')).toBeTruthy();
    machine.review();
    const review = await render(<AnalystMatchReviewView match={match} state={machine.state} machine={machine} />);
    expect(review.getAllByText(/18/).length).toBeGreaterThan(0);
    expect(review.getAllByText(/32/).length).toBeGreaterThan(0);
    expect(api.capture).toHaveBeenCalledTimes(1);
    machine.dispose();
  });
  it('opens and closes the event wheel without inventing a type, then changes the selected type explicitly', async () => {
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load();
    const view = await render(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    const refresh = async () => view.rerender(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    const press = async (label: string) => { await fireEvent.press(view.getByLabelText(label)); await refresh(); };
    await press('Elegir evento');
    expect(view.getByLabelText('Rueda de eventos')).toBeTruthy();
    expect(view.getByLabelText('Rueda de eventos').props.role).toBe('group');
    expect(view.getByTestId('event-wheel-overlay')).toBeTruthy();
    expect(view.getAllByTestId('event-wheel-sector')).toHaveLength(23);
    expect(view.getByTestId('event-wheel-anchor')).toBeTruthy();
    expect(view.getByTestId('event-wheel-expanded-anchor')).toBeTruthy();
    for (const family of ['Distribución', 'Ataque', 'Defensa', 'Arquero'])
      expect(view.getByLabelText(`Familia ${family}`)).toBeTruthy();
    expect(view.queryByText('Rueda completa de eventos')).toBeNull();
    expect(machine.state.draft?.context.spatial.status).toBe('UNSET');
    expect(machine.state.draft?.complexity.risk.status).toBe('UNSET');
    await press('Cerrar rueda');
    expect(machine.state.draft?.eventType).toBeNull();
    await press('Elegir evento');
    await press('Centro');
    expect(view.queryByLabelText('Rueda de eventos')).toBeNull();
    expect(view.queryByTestId('event-wheel-overlay')).toBeNull();
    expect(view.getByLabelText('Centro, Cambiar')).toBeTruthy();
    await press('Exitoso');
    expect(view.getByLabelText('Exitoso').props.accessibilityState.checked).toBe(true);
    expect(view.getByLabelText('Fallido').props.accessibilityState.checked).toBe(false);
    await press('Centro, Cambiar');
    await press('Remate');
    expect(machine.state.draft?.result).toBeNull();
    expect(machine.state.events).toHaveLength(0);
    machine.dispose();
  });

  it('offers only approved context categories and explicit temporal bands', async () => {
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load(); machine.selectType('PASS', 'THROUGH'); machine.selectResult('SUCCESS');
    const view = await render(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    const refresh = async () => view.rerender(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    const choose = async (label: string) => { await fireEvent.press(view.getByLabelText(label)); await refresh(); };
    expect(view.queryByLabelText('Espacial observado')).toBeNull();
    expect(view.queryByLabelText('Espacial: dato observado')).toBeNull();
    for (const label of ['Área propia', 'Primer tercio', 'Zona media', 'Último tercio', 'Área rival'])
      expect(view.getByLabelText(`Espacial: ${label}`)).toBeTruthy();
    await choose('Espacial: Área rival');
    expect(machine.state.draft?.context.spatial).toEqual({ status: 'OBSERVED', value: 'Área rival' });
    expect(machine.state.draft?.context.temporal.status).toBe('UNSET');
    expect(view.getByLabelText('Temporal: Primer 20 %')).toBeTruthy();
    expect(view.getByLabelText('Temporal: Desde el 80 %')).toBeTruthy();
    await choose('Temporal: no observable');
    for (const label of ['Ganando', 'Empatando', 'Perdiendo']) expect(view.getByLabelText(`Competitivo: ${label}`)).toBeTruthy();
    await choose('Competitivo: Empatando');
    for (const label of ['Sin presión', 'Baja', 'Media', 'Alta']) expect(view.getByLabelText(`Presión: ${label}`)).toBeTruthy();
    await choose('Presión: Baja');
    for (const label of ['Arquero', 'Central', 'Lateral', 'Volante', 'Extremo', 'Delantero'])
      expect(view.getByLabelText(`Posicional: ${label}`)).toBeTruthy();
    await choose('Posicional: Volante');
    for (const group of ['Dificultad técnica', 'Distancia', 'Precisión requerida', 'Velocidad de ejecución',
      'Rivales involucrados', 'Extremidad no dominante', 'Riesgo asumido']) {
      const levels = group === 'Extremidad no dominante' ? ['Sí', 'No'] : ['Inexistente', 'Baja', 'Media', 'Alta', 'Muy alta'];
      for (const level of levels) expect(view.getByLabelText(`${group}: ${level}`)).toBeTruthy();
      expect(view.getByLabelText(`${group}: no observable`)).toBeTruthy();
      expect(view.getByLabelText(`${group}: no aplica`)).toBeTruthy();
      await choose(`${group}: no aplica`);
    }
    machine.dispose();
  });

  it('guides labelled selections, supports progress correction, and only locally saves complete events', async () => {
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load();
    const view = await render(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    const refresh = async () => view.rerender(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    const press = async (label: string) => { await fireEvent.press(view.getByLabelText(label)); await refresh(); };
    const change = async (label: string, value: string) => { await fireEvent.changeText(view.getByLabelText(label), value); await refresh(); };
    await press('Elegir evento');
    await press('Centro');
    await change('Minuto del video', '23');
    expect(view.queryByLabelText('Guardar evento')).toBeNull();
    await press('Exitoso');
    for (const group of ['Espacial', 'Temporal', 'Competitivo', 'Presión', 'Posicional']) {
      expect(view.getAllByText(group).length).toBeGreaterThan(0);
      expect(view.queryByLabelText(`${group}: no aplica`)).toBeNull();
      await press(`${group}: no observable`);
    }
    for (const group of ['Dificultad técnica', 'Distancia', 'Precisión requerida', 'Velocidad de ejecución', 'Rivales involucrados', 'Extremidad no dominante', 'Riesgo asumido']) {
      expect(view.getAllByText(group).length).toBeGreaterThan(0);
      await press(`${group}: no aplica`);
    }
    expect(view.queryByLabelText('Observación opcional')).toBeNull();
    await press('Progreso: Espacial');
    await press('Espacial: no observable');
    expect(machine.state.draft?.complexity.risk.status).toBe('NOT_APPLICABLE');
    await press('Guardar evento');
    expect(machine.state.events).toHaveLength(1);
    expect(machine.state.events[0]?.observation).toBe('');
    expect(api.capture).toHaveBeenCalledTimes(1);
    expect(view.getByLabelText('Editar evento 1')).toBeTruthy();
    await press('Eventos capturados');
    expect(view.queryByLabelText('Editar evento 1')).toBeNull();
    await press('Eventos capturados');
    await press('Editar evento 1');
    await change('Minuto del video', '24');
    await press('Guardar evento');
    expect(machine.state.events).toHaveLength(1);
    expect(machine.state.events[0]?.videoMinute).toBe('24');
    machine.review();
    const review = await render(<AnalystMatchReviewView match={match} state={machine.state} machine={machine} />);
    expect(review.getAllByText(/24/).length).toBeGreaterThan(0);
    expect(review.getByText('Resultado: Exitoso')).toBeTruthy();
    machine.toFinal();
    const final = await render(<AnalystMatchFinalStep match={match} state={machine.state} machine={machine} />);
    expect(final.getByText(/1 evento revisado/)).toBeTruthy();
    expect(api.capture).toHaveBeenCalledTimes(1);
    machine.dispose();
  });

  it('keeps an unfinished event out of review and the final step, then saves a second completed event', async () => {
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load();
    machine.openWheel(); machine.selectType('PASS', 'THROUGH'); machine.selectResult('SUCCESS');
    machine.updateDraft({ videoMinute: '23' });
    machine.updateContext('spatial', { status: 'OBSERVED', value: '' });
    expect(machine.state.activeGroup).toBe(0);
    machine.updateContext('spatial', { status: 'OBSERVED', value: 'Área rival' });
    expect(machine.state.activeGroup).toBe(1);
    for (const key of ['temporal', 'competitive', 'pressure', 'positional'] as const) machine.updateContext(key, { status: 'NOT_OBSERVABLE' });
    for (const key of ['technicalDifficulty', 'distance', 'precision', 'executionSpeed', 'opponents', 'nonDominantLimb', 'risk'] as const)
      machine.updateComplexity(key, { status: 'NOT_APPLICABLE' });
    expect(machine.saveEvent()).toBe(true);
    machine.startEvent(); machine.selectType('SHOT'); machine.selectResult('WIDE'); machine.updateDraft({ videoMinute: '90+2' });
    expect(machine.saveEvent()).toBe(false);
    machine.review();
    expect(machine.state.events).toHaveLength(1);
    expect(machine.state.draft?.videoMinute).toBe('90+2');
    machine.toFinal();
    const final = await render(<AnalystMatchFinalStep match={match} state={machine.state} machine={machine} />);
    expect(final.getByText(/1 evento revisado/)).toBeTruthy();
    machine.backToCapture();
    for (const key of ['spatial', 'temporal', 'competitive', 'pressure', 'positional'] as const)
      machine.updateContext(key, { status: 'NOT_OBSERVABLE' });
    for (const key of ['technicalDifficulty', 'distance', 'precision', 'executionSpeed', 'opponents', 'nonDominantLimb', 'risk'] as const)
      machine.updateComplexity(key, { status: 'NOT_APPLICABLE' });
    expect(machine.saveEvent()).toBe(true);
    expect(machine.state.events.map((event) => event.videoMinute)).toEqual(['23', '90+2']);
    expect(api.capture).toHaveBeenCalledTimes(1);
    machine.dispose();
  });

  it('requires explicit goalkeeper detail before offering local save', async () => {
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load(); machine.openWheel(); machine.selectType('SAVE'); machine.selectResult('SUCCESS');
    machine.updateDraft({ videoMinute: '50' });
    for (const key of ['spatial', 'temporal', 'competitive', 'pressure', 'positional'] as const)
      machine.updateContext(key, { status: 'NOT_OBSERVABLE' });
    for (const key of ['technicalDifficulty', 'distance', 'precision', 'executionSpeed', 'opponents', 'nonDominantLimb', 'risk'] as const)
      machine.updateComplexity(key, { status: 'NOT_APPLICABLE' });
    const view = await render(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    expect(view.queryByLabelText('Guardar evento')).toBeNull();
    machine.updateGoalkeeper('handUsed', { status: 'OBSERVED', value: 'DOMINANT' });
    machine.updateGoalkeeper('handChanged', { status: 'OBSERVED', value: 'NO' });
    await view.rerender(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    expect(view.getByLabelText('Guardar evento')).toBeTruthy();
    machine.dispose();
  });
  it('renders no-participation without events and no FEM controls', async () => {
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load(); machine.setParticipation('DID_NOT_PARTICIPATE');
    const capture = await render(<AnalystMatchCaptureView match={match} state={machine.state} machine={machine} />);
    expect(capture.getAllByText(/No participó/i).length).toBeGreaterThan(0);
    expect(capture.queryByText(/Introducir puntos|Introducir rating|Calcular FEM/i)).toBeNull();
    machine.review();
    await capture.rerender(<AnalystMatchReviewView match={match} state={machine.state} machine={machine} />);
    expect(capture.getByText(/No participó; sin eventos/i)).toBeTruthy();
    await fireEvent.press(capture.getByText(/Continuar a datos finales/i));
    await capture.rerender(<AnalystMatchFinalStep match={match} state={machine.state} machine={machine} />);
    expect(capture.getByText(/Total de minutos jugados/i)).toBeTruthy();
    expect(capture.getByText(/Enlace de YouTube/i)).toBeTruthy();
    expect(capture.getByLabelText('Confirmar carga')).toBeTruthy();
    machine.dispose();
  });

  it('clears protected data after access loss or match context change', async () => {
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load(); machine.startEvent(); machine.setFinal({ totalMinutesPlayed: '97', youtubeUrl: 'https://youtu.be/syntheticVideo' });
    machine.clear();
    expect(machine.state.events).toHaveLength(0);
    expect(machine.state.draft).toBeNull();
    expect(machine.state.final.youtubeUrl).toBe('');
    expect(machine.state.kind).toBe('restricted');
    machine.dispose();
  });

});
