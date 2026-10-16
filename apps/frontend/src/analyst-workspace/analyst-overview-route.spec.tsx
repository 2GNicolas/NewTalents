import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockAuthentication = { state: { phase: 'authenticated' },
  sessionAccess: { classification: 'product', capabilities: ['passport.review'] },
  getAccessToken: () => 'synthetic-token' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../authentication/authentication-provider', () => ({ useAuthentication: () => mockAuthentication }));
jest.mock('./analyst-workspace-api', () => ({ createAnalystWorkspaceApi: jest.fn() }));

import AnalystEntryRoute from '../../app/(authenticated)/analyst/index';
import { createAnalystWorkspaceApi } from './analyst-workspace-api';

const overview = { timeZone: 'America/Bogota', analystLabel: 'Laura de prueba', pending: { availability: 'AVAILABLE', data: [], hasMore: false },
  upcoming: { availability: 'AVAILABLE', data: [], hasMore: false }, completed: { availability: 'UNAVAILABLE' } };

describe('authenticated Analyst entry route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthentication.state.phase = 'authenticated';
    mockAuthentication.sessionAccess.capabilities = ['passport.review'];
  });

  it('loads the real overview state through the authenticated route', async () => {
    const load = jest.fn(async () => ({ kind: 'success', value: overview }));
    (createAnalystWorkspaceApi as jest.Mock).mockReturnValue({ overview: load });
    const view = await render(<AnalystEntryRoute />);
    await waitFor(() => expect(view.getByText('Análisis pendientes')).toBeTruthy());
    expect(load).toHaveBeenCalledTimes(1);
    expect(view.getByText('Análisis realizados')).toBeTruthy();
    expect(view.getByText(/no disponible/i)).toBeTruthy();
    await fireEvent.press(view.getByText('Ver calendario'));
    expect(mockPush).toHaveBeenCalledWith('/(authenticated)/analyst/matches');
    await view.unmount();
    const reopened = await render(<AnalystEntryRoute />);
    await waitFor(() => expect(reopened.getByText('Análisis pendientes')).toBeTruthy());
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not load or retain protected data without the projected Analyst capability', async () => {
    mockAuthentication.sessionAccess.capabilities = [];
    const load = jest.fn(async () => ({ kind: 'success', value: overview }));
    (createAnalystWorkspaceApi as jest.Mock).mockReturnValue({ overview: load });
    const view = await render(<AnalystEntryRoute />);
    expect(view.getByText(/acceso restringido/i)).toBeTruthy();
    expect(view.queryByText('Análisis pendientes')).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
});
