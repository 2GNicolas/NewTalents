import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));

import { AnalystMatchDetailView } from '../analyst-workspace/analyst-matches';
import { createAnalystMatchUploadApi } from './analyst-match-upload-api';
import { AnalystMatchCaptureState } from './analyst-match-upload-state';

const match = { id: '22222222-2222-4222-8222-222222222222', sourceKind: 'FIRST_MATCH',
  passportId: '11111111-1111-4111-8111-111111111111', maskedReference: 'PAS-1111', playerName: 'Jugador sintético',
  matchDate: '2026-10-18', matchTime: '10:00', opponent: 'Rival', competition: 'Liga', venue: 'Cancha', state: 'WAITING' as const };

describe('Feature 011 authorized entry', () => {
  it('offers CTA only for backend-available WAITING and not historical LOADED', async () => {
    const open = jest.fn();
    const view = await render(<AnalystMatchDetailView detail={match} kind="ready" captureAvailability="AVAILABLE"
      onCapture={open} onBack={jest.fn()} onRetry={jest.fn()} />);
    await fireEvent.press(view.getByText('Registrar datos del partido'));
    expect(open).toHaveBeenCalledTimes(1);
    await view.rerender(<AnalystMatchDetailView detail={{ ...match, state: 'LOADED' }} kind="ready" captureAvailability="UNAVAILABLE"
      onCapture={open} onBack={jest.fn()} onRetry={jest.fn()} />);
    expect(view.queryByText('Registrar datos del partido')).toBeNull();
  });

  it('requests capture eligibility from server with no-store for direct routes', async () => {
    const fetcher = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ matchId: match.id,
      passportId: match.passportId, sourceKind: 'FIRST_MATCH', availability: 'AVAILABLE', expectedVersion: 1 }) } as Response));
    const api = createAnalystMatchUploadApi({ getAccessToken: () => 'token', apiBaseUrl: 'http://localhost:3100', fetcher });
    expect(await api.capture(match.id)).toMatchObject({ kind: 'success', value: { availability: 'AVAILABLE' } });
    expect(fetcher.mock.calls[0]?.[0]).toContain(`/matches/${match.id}/capture`);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', cache: 'no-store' });
  });
  it.each([401, 403, 404])('clears in-memory capture on HTTP %i', async (status) => {
    const fetcher = jest.fn(async () => ({ ok: false, status } as Response));
    const api = createAnalystMatchUploadApi({ getAccessToken: () => 'token', apiBaseUrl: 'http://localhost:3100', fetcher });
    const machine = new AnalystMatchCaptureState(api, match.id);
    machine.startEvent(); machine.updateDraft({ videoMinute: '23' });
    machine.setFinal({ youtubeUrl: 'https://youtu.be/secret', totalMinutesPlayed: '90' });
    await machine.load();
    expect(machine.state.kind).toBe('restricted');
    expect(machine.state.events).toHaveLength(0);
    expect(machine.state.draft).toBeNull();
    expect(machine.state.final.youtubeUrl).toBe('');
    machine.dispose();
  });
});
