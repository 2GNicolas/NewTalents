import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));

import { AnalystMatchDetailView } from '../analyst-workspace/analyst-matches';
import { AnalystMatchConfirmedView } from './analyst-match-confirmed';
import { createAnalystMatchUploadApi, type CaptureApi, type ConfirmedUpload } from './analyst-match-upload-api';
import { AnalystMatchCaptureState } from './analyst-match-upload-state';

const match = { id: '22222222-2222-4222-8222-222222222222', sourceKind: 'FIRST_MATCH',
  passportId: '11111111-1111-4111-8111-111111111111', maskedReference: 'PAS-1111', playerName: 'Jugador sintético',
  matchDate: '2026-10-18', matchTime: '10:00', opponent: 'Rival', competition: 'Liga', venue: 'Cancha', state: 'LOADED' as const };
const event = { sequence: 1, eventType: 'GOAL', result: 'NONE', videoMinute: '90+7',
  context: {}, complexity: {}, observation: 'Observación privada sintética' };
const upload: ConfirmedUpload = { matchId: match.id, sourceKind: 'FIRST_MATCH', participation: 'PARTICIPATED',
  totalMinutesPlayed: 97, youtubeUrl: 'https://youtu.be/Feature011TestVideo', events: [event],
  confirmedAt: '2026-10-16T12:00:00.000Z', outcome: 'APPLIED' };
const context = { matchId: match.id, passportId: match.passportId, sourceKind: 'FIRST_MATCH' as const,
  availability: 'CONFIRMED' as const, upload };

describe('Feature 011 confirmed private upload', () => {
  it('renders the authorized URL, event and optional observation without a FEM rating or completed analysis', async () => {
    const view = await render(<AnalystMatchConfirmedView match={match} upload={upload} />);
    expect(view.getByText('Carga confirmada')).toBeTruthy();
    expect(view.getByLabelText('Etapa 4 de 4: Confirmada')).toBeTruthy();
    expect(view.getByText('https://youtu.be/Feature011TestVideo')).toBeTruthy();
    expect(view.getByText(/Observación privada sintética/)).toBeTruthy();
    expect(view.getByText(/97 minutos/)).toBeTruthy();
    expect(view.queryByText(/evaluación terminada|rating|puntuación/i)).toBeNull();
  });

  it('shows explicit non-participation without inventing events or a player evaluation', async () => {
    const view = await render(<AnalystMatchConfirmedView match={match} upload={{ ...upload,
      participation: 'DID_NOT_PARTICIPATE', totalMinutesPlayed: 0, events: [] }} />);
    expect(view.getByText(/No participó/)).toBeTruthy();
    expect(view.queryByText(/90\+7/)).toBeNull();
  });

  it('does not invent measured values for a confirmed failed event', async () => {
    const failed = { ...event, eventType: 'CROSS', result: 'FAILURE', context: {}, complexity: {} };
    const view = await render(<AnalystMatchConfirmedView match={match} upload={{ ...upload, events: [failed] }} />);
    expect(view.getByText('Resultado: Fallido')).toBeTruthy();
    expect(view.queryByText(/Espacial:|Dificultad técnica:/)).toBeNull();
  });

  it('uses readable labels for confirmed result and complexity values', async () => {
    const readableEvent = { ...event, eventType: 'PASS', variant: 'NORMAL', result: 'SUCCESS',
      complexity: { ...event.complexity, technicalDifficulty: { status: 'OBSERVED', value: 'MEDIUM' } } };
    const view = await render(<AnalystMatchConfirmedView match={match} upload={{ ...upload, events: [readableEvent] }} />);
    expect(view.getByText('Resultado: Exitoso')).toBeTruthy();
    expect(view.getByText('Dificultad técnica: Media')).toBeTruthy();
  });

  it('only offers a confirmed-detail entry for backend-confirmed LOADED, not historical LOADED', async () => {
    const onCapture = jest.fn();
    const view = await render(<AnalystMatchDetailView detail={match} kind="ready" captureAvailability="CONFIRMED"
      onCapture={onCapture} onBack={jest.fn()} onRetry={jest.fn()} />);
    await fireEvent.press(view.getByText('Consultar carga confirmada'));
    expect(onCapture).toHaveBeenCalledTimes(1);
    await view.rerender(<AnalystMatchDetailView detail={match} kind="ready" captureAvailability="UNAVAILABLE"
      onCapture={onCapture} onBack={jest.fn()} onRetry={jest.fn()} />);
    expect(view.queryByText('Consultar carga confirmada')).toBeNull();
  });

  it('parses only a bound private upload and clears it after HTTP 401/403/404', async () => {
    for (const status of [401, 403, 404]) {
      let currentStatus = 200;
      const fetcher = jest.fn(async () => currentStatus === 200
        ? ({ ok: true, status: 200, json: async () => context } as Response)
        : ({ ok: false, status: currentStatus } as Response));
      const api = createAnalystMatchUploadApi({ getAccessToken: () => 'token', apiBaseUrl: 'http://localhost:3100', fetcher });
      const machine = new AnalystMatchCaptureState(api, match.id);
      await machine.load();
      expect(machine.state.context?.upload?.youtubeUrl).toBe(upload.youtubeUrl);
      currentStatus = status;
      await machine.load();
      expect(machine.state.kind).toBe('restricted');
      expect(machine.state.context).toBeNull();
      expect(JSON.stringify(machine.state)).not.toMatch(/Feature011TestVideo|Observación privada|90\+7/);
      machine.dispose();
    }
  });

  it('clears protected upload when the authorization subscription reports access loss', async () => {
    let revoke: (() => void) | undefined;
    const api: CaptureApi = { capture: async () => ({ kind: 'success', value: context }),
      onAccessLost: (listener) => { revoke = listener; return () => {}; } };
    const machine = new AnalystMatchCaptureState(api, match.id);
    await machine.load();
    expect(machine.state.context?.upload).toBeTruthy();
    revoke?.();
    expect(machine.state.kind).toBe('restricted');
    expect(machine.state.context).toBeNull();
    machine.dispose();
  });
});
