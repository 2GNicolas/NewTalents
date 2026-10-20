import { render, waitFor } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: '22222222-2222-4222-8222-222222222222' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('../authentication/authentication-provider', () => ({ useAuthentication: jest.fn() }));
jest.mock('../analyst-workspace/analyst-workspace-api', () => ({ createAnalystWorkspaceApi: jest.fn() }));
jest.mock('./analyst-match-upload-api', () => ({ createAnalystMatchUploadApi: jest.fn() }));

import CaptureRoute from '../../app/(authenticated)/analyst/matches/[matchId]/capture';
import { createAnalystWorkspaceApi } from '../analyst-workspace/analyst-workspace-api';
import { createAnalystMatchUploadApi } from './analyst-match-upload-api';
import { useAuthentication } from '../authentication/authentication-provider';

const match = { id: '22222222-2222-4222-8222-222222222222', sourceKind: 'FIRST_MATCH',
  passportId: '11111111-1111-4111-8111-111111111111', maskedReference: 'PAS-1111', playerName: 'Jugador sintético',
  matchDate: '2026-10-18', matchTime: '10:00', opponent: 'Rival', competition: 'Liga', venue: 'Cancha', state: 'WAITING' };
const workspaceFactory = createAnalystWorkspaceApi as jest.Mock;
const captureFactory = createAnalystMatchUploadApi as jest.Mock;
const authenticationFactory = useAuthentication as jest.Mock;
const getAccessToken = () => 'synthetic-token';

describe('Feature 011 direct capture route', () => {
  beforeEach(() => {
    workspaceFactory.mockReset(); captureFactory.mockReset();
    authenticationFactory.mockReturnValue({ getAccessToken, state: { phase: 'authenticated' },
      sessionAccess: { classification: 'product', capabilities: ['passport.review'] } });
    workspaceFactory.mockReturnValue({ match: jest.fn().mockResolvedValue({ kind: 'success', value: match }) });
  });

  it('requeries backend eligibility on each direct mount', async () => {
    const capture = jest.fn().mockResolvedValue({ kind: 'success', value: { matchId: match.id, passportId: match.passportId,
      sourceKind: 'FIRST_MATCH', availability: 'AVAILABLE', expectedVersion: 1 } });
    captureFactory.mockReturnValue({ capture });
    const first = await render(<CaptureRoute />);
    await waitFor(() => expect(first.getByText('Captura rápida en línea de tiempo')).toBeTruthy());
    await first.unmount();
    const second = await render(<CaptureRoute />);
    await waitFor(() => expect(second.getByText('Captura rápida en línea de tiempo')).toBeTruthy());
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it('does not open a historical or backend-unavailable capture', async () => {
    captureFactory.mockReturnValue({ capture: jest.fn().mockResolvedValue({ kind: 'success', value: { matchId: match.id,
      passportId: match.passportId, sourceKind: 'FIRST_MATCH', availability: 'UNAVAILABLE' } }) });
    const view = await render(<CaptureRoute />);
    await waitFor(() => expect(view.getByText('La captura no está disponible para este partido.')).toBeTruthy());
    expect(view.queryByText('Captura rápida en línea de tiempo')).toBeNull();
  });

  it('renders a backend-confirmed upload on direct read without calling final confirmation', async () => {
    workspaceFactory.mockReturnValue({ match: jest.fn().mockResolvedValue({ kind: 'success', value: { ...match, state: 'LOADED' } }) });
    const confirm = jest.fn();
    captureFactory.mockReturnValue({ capture: jest.fn().mockResolvedValue({ kind: 'success', value: {
      matchId: match.id, passportId: match.passportId, sourceKind: 'FIRST_MATCH', availability: 'CONFIRMED',
      upload: { matchId: match.id, sourceKind: 'FIRST_MATCH', participation: 'DID_NOT_PARTICIPATE', totalMinutesPlayed: 0,
        youtubeUrl: 'https://youtu.be/Feature011TestVideo', events: [], confirmedAt: '2026-10-16T12:00:00.000Z', outcome: 'APPLIED' },
    } }), confirm });
    const view = await render(<CaptureRoute />);
    await waitFor(() => expect(view.getByText('Carga confirmada')).toBeTruthy());
    expect(view.getByText('https://youtu.be/Feature011TestVideo')).toBeTruthy();
    expect(view.queryByText('Captura rápida en línea de tiempo')).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
    authenticationFactory.mockReturnValue({ getAccessToken: () => null, state: { phase: 'anonymous' }, sessionAccess: null });
    await view.rerender(<CaptureRoute />);
    await waitFor(() => expect(view.getByText('Acceso restringido.')).toBeTruthy());
    expect(view.queryByText('https://youtu.be/Feature011TestVideo')).toBeNull();
  });
});
