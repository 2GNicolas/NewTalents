import { render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ passportId: '22222222-2222-4222-8222-222222222222' }),
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock('../authentication/authentication-provider', () => ({
  useAuthentication: () => ({ getAccessToken: () => 'synthetic-token' }),
}));
jest.mock('./first-match-api', () => ({
  createFirstMatchApi: jest.fn(),
}));

import FirstMatchRoute from '../../app/(authenticated)/passports/[passportId]/first-match';
import { createFirstMatchApi } from './first-match-api';

const apiFactory = createFirstMatchApi as jest.Mock;
const passportId = '22222222-2222-4222-8222-222222222222';

describe('first-match dedicated route reload', () => {
  beforeEach(() => jest.clearAllMocks());

  it('recovers the same waiting match from GET on every mount and never schedules on reload', async () => {
    const flow = jest.fn().mockResolvedValue({ kind: 'success', value: {
      passportId, state: 'WAITING', allowedActions: [], match: {
        id: '44444444-4444-4444-8444-444444444444', version: 1, matchDate: '2026-10-18',
        matchTime: '10:00', opponent: 'Rival sintético', competition: 'Liga', venue: 'Cancha', state: 'WAITING',
      },
    } });
    const schedule = jest.fn();
    apiFactory.mockReturnValue({ flow, schedule, preview: jest.fn() });
    const first = await render(<FirstMatchRoute />);
    await waitFor(() => expect(first.getByTestId('first-match-waiting-details')).toBeTruthy());
    expect(first.getByText('Rival sintético')).toBeTruthy();
    expect(first.queryByTestId('passport-nav-desktop')).toBeNull();
    await first.unmount();
    const second = await render(<FirstMatchRoute />);
    await waitFor(() => expect(second.getByText('Rival sintético')).toBeTruthy());
    expect(flow).toHaveBeenCalledTimes(2);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('leaves waiting only on a server-reported LOADED state, without exposing internal data', async () => {
    const match = { id: '44444444-4444-4444-8444-444444444444', version: 1,
      matchDate: '2026-10-18', matchTime: '10:00', opponent: 'Rival', competition: 'Liga', venue: 'Cancha' };
    const flow = jest.fn().mockResolvedValueOnce({ kind: 'success', value: {
      passportId, state: 'WAITING', allowedActions: [], match: { ...match, state: 'WAITING' },
    } }).mockResolvedValueOnce({ kind: 'success', value: {
      passportId, state: 'LOADED', allowedActions: [], match: { ...match, state: 'LOADED' },
    } });
    apiFactory.mockReturnValue({ flow, schedule: jest.fn(), preview: jest.fn() });
    const view = await render(<FirstMatchRoute />);
    await waitFor(() => expect(view.getByTestId('first-match-waiting-details')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
    await view.unmount();
    const reopened = await render(<FirstMatchRoute />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/passports/${passportId}/sections/resumen`));
    expect(reopened.queryByTestId('first-match-waiting-details')).toBeNull();
    expect(reopened.queryByText(/Analista asignado|estadísticas|evidencia/i)).toBeNull();
    expect(apiFactory.mock.results[0]?.value.schedule).not.toHaveBeenCalled();
  });

  it('shows a retryable load failure without claiming that a fresh route kept unsaved fields', async () => {
    apiFactory.mockReturnValue({ flow: jest.fn().mockResolvedValue({ kind: 'unavailable' }),
      schedule: jest.fn(), preview: jest.fn() });
    const view = await render(<FirstMatchRoute />);
    await waitFor(() => expect(view.getByText('No pudimos cargar el primer partido. Vuelve a intentar.')).toBeTruthy());
    expect(view.queryByText(/Conservamos los datos ingresados/)).toBeNull();
    expect(view.getByRole('button', { name: 'Volver a intentar' })).toBeTruthy();
  });
});
