import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));

import { AnalystMatchFinalStep } from './analyst-match-final-step';
import { AnalystMatchCaptureState, contextKeys, complexityKeys } from './analyst-match-upload-state';

const match = { id: '22222222-2222-4222-8222-222222222222', sourceKind: 'FIRST_MATCH',
  passportId: '11111111-1111-4111-8111-111111111111', maskedReference: 'PAS-1111', playerName: 'Jugador sintético',
  matchDate: '2026-10-18', matchTime: '10:00', opponent: 'Rival', competition: 'Liga', venue: 'Cancha', state: 'WAITING' as const };
const context = { matchId: match.id, passportId: match.passportId, sourceKind: 'FIRST_MATCH' as const,
  availability: 'AVAILABLE' as const, expectedVersion: 1 };
const confirm = jest.fn();
const api = { capture: jest.fn(async () => ({ kind: 'success' as const, value: context })), confirm };

async function ready() {
  const machine = new AnalystMatchCaptureState(api, match.id);
  await machine.load();
  return machine;
}
function saveEvent(machine: AnalystMatchCaptureState, observation = '') {
  machine.startEvent(); machine.selectType('GOAL'); machine.selectResult('NONE');
  machine.updateDraft({ videoMinute: '88', observation });
  for (const key of contextKeys) machine.updateContext(key, { status: 'NOT_OBSERVABLE' });
  for (const key of complexityKeys) machine.updateComplexity(key, { status: 'NOT_APPLICABLE' });
  expect(machine.saveEvent()).toBe(true);
}

describe('Feature 011 final confirmation step', () => {
  beforeEach(() => { confirm.mockReset(); api.capture.mockClear(); });

  it('preserves locally saved events, observation, draft, minutes and URL after correctable validation', async () => {
    confirm.mockResolvedValue({ kind: 'validation' });
    const machine = await ready(); saveEvent(machine, 'Observación privada');
    machine.startEvent(); machine.selectType('GOAL'); machine.updateDraft({ videoMinute: '89' });
    machine.review(); machine.toFinal();
    machine.setFinal({ totalMinutesPlayed: '12', youtubeUrl: 'https://youtu.be/Feature011TestVideo' });
    const view = await render(<AnalystMatchFinalStep match={match} state={machine.state} machine={machine} />);
    expect(view.queryByLabelText('No participó')).toBeNull();
    expect(view.getAllByText('Participó').length).toBeGreaterThan(0);
    await fireEvent.press(view.getByLabelText('Confirmar carga'));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    await view.rerender(<AnalystMatchFinalStep match={match} state={machine.state} machine={machine} />);
    expect(view.getByLabelText('Total de minutos jugados')).toBeTruthy();
    expect(view.getByLabelText('Enlace de YouTube')).toBeTruthy();
    expect(confirm.mock.calls[0]?.[1].events).toHaveLength(1);
    expect(confirm.mock.calls[0]?.[1].events[0]?.observation).toBe('Observación privada');
    expect(machine.state.events).toHaveLength(1);
    expect(machine.state.draft?.videoMinute).toBe('89');
    expect(machine.state.final).toEqual({ totalMinutesPlayed: '12', youtubeUrl: 'https://youtu.be/Feature011TestVideo' });
    await fireEvent.changeText(view.getByLabelText('Enlace de YouTube'), 'https://youtu.be/corrected');
    await view.rerender(<AnalystMatchFinalStep match={match} state={machine.state} machine={machine} />);
    await fireEvent.press(view.getByLabelText('Confirmar carga'));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
    expect(confirm.mock.calls[1]?.[1].youtubeUrl).toBe('https://youtu.be/corrected');
    expect(machine.state.events[0]?.observation).toBe('Observación privada');
    machine.dispose();
  });

  it('rejects invalid participant minutes locally without losing the saved event or entered link', async () => {
    const machine = await ready(); saveEvent(machine); machine.review(); machine.toFinal();
    machine.setFinal({ totalMinutesPlayed: '0', youtubeUrl: 'https://youtu.be/Feature011TestVideo' });
    await machine.confirm();
    expect(confirm).not.toHaveBeenCalled();
    expect(machine.state.finalError).toBe('validation');
    expect(machine.state.events).toHaveLength(1);
    expect(machine.state.final.youtubeUrl).toBe('https://youtu.be/Feature011TestVideo');
    machine.dispose();
  });

  it('sends explicit non-participation with zero and stable intention only on final control', async () => {
    confirm.mockResolvedValue({ kind: 'success', value: { outcome: 'APPLIED' } });
    const machine = await ready(); machine.setParticipation('DID_NOT_PARTICIPATE');
    machine.review(); machine.toFinal();
    machine.setFinal({ totalMinutesPlayed: '0', youtubeUrl: 'https://youtu.be/Feature011TestVideo' });
    expect(confirm).not.toHaveBeenCalled();
    const view = await render(<AnalystMatchFinalStep match={match} state={machine.state} machine={machine} />);
    expect(view.queryByLabelText('Participó')).toBeNull();
    await fireEvent.press(view.getByLabelText('Confirmar carga'));
    await fireEvent.press(view.getByLabelText('Confirmar carga'));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(confirm.mock.calls[0]?.[1]).toMatchObject({ participation: 'DID_NOT_PARTICIPATE',
      totalMinutesPlayed: 0, events: [] });
    await waitFor(() => expect(machine.state.confirmation).toBe('APPLIED'));
    await view.rerender(<AnalystMatchFinalStep match={match} state={machine.state} machine={machine} />);
    expect(view.getByText('Carga confirmada')).toBeTruthy();
    expect(view.getByText(/LOADED\/USED/)).toBeTruthy();
    expect(view.getByText(/no completa una evaluación FEM/i)).toBeTruthy();
    machine.dispose();
  });

  it('keeps a stable intention on retry, but clears protected fields on revocation', async () => {
    confirm.mockResolvedValueOnce({ kind: 'validation' }).mockResolvedValueOnce({ kind: 'restricted' });
    const machine = await ready(); saveEvent(machine, 'Privada');
    machine.review(); machine.toFinal();
    machine.setFinal({ totalMinutesPlayed: '97', youtubeUrl: 'https://youtu.be/Feature011TestVideo' });
    await machine.confirm();
    expect(machine.state.finalError).toBe('validation');
    expect(machine.state.events[0]?.observation).toBe('Privada');
    await machine.confirm();
    expect(confirm.mock.calls[0]?.[2]).toBe(confirm.mock.calls[1]?.[2]);
    expect(machine.state.kind).toBe('restricted');
    expect(machine.state.events).toHaveLength(0);
    expect(machine.state.final.youtubeUrl).toBe('');
    expect(machine.state.draft).toBeNull();
    machine.dispose();
  });

  it('requeries after conflict and blocks blind resubmission until the Analyst reviews again', async () => {
    confirm.mockResolvedValue({ kind: 'conflict' });
    const machine = await ready(); saveEvent(machine); machine.review(); machine.toFinal();
    machine.setFinal({ totalMinutesPlayed: '12', youtubeUrl: 'https://youtu.be/Feature011TestVideo' });
    await machine.confirm();
    expect(api.capture).toHaveBeenCalledTimes(2);
    expect(machine.state.finalError).toBe('conflict');
    await machine.confirm();
    expect(confirm).toHaveBeenCalledTimes(1);
    machine.backToReview(); machine.toFinal();
    expect(machine.state.finalError).toBeUndefined();
    machine.dispose();
  });

  it('disables the visible final control while one request is in flight', async () => {
    let settle: ((value: unknown) => void) | undefined;
    confirm.mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    const machine = await ready(); machine.setParticipation('DID_NOT_PARTICIPATE');
    machine.review(); machine.toFinal();
    machine.setFinal({ totalMinutesPlayed: '0', youtubeUrl: 'https://youtu.be/Feature011TestVideo' });
    const view = await render(<AnalystMatchFinalStep match={match} state={machine.state} machine={machine} />);
    const request = machine.confirm();
    await view.rerender(<AnalystMatchFinalStep match={match} state={machine.state} machine={machine} />);
    expect(view.getByLabelText('Confirmando carga').props.accessibilityState.disabled).toBe(true);
    await machine.confirm();
    expect(confirm).toHaveBeenCalledTimes(1);
    settle?.({ kind: 'success', value: { matchId: match.id, outcome: 'APPLIED' } });
    await request;
    machine.dispose();
  });
});
