import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ passportId: '22222222-2222-4222-8222-222222222222' }),
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('../authentication/authentication-provider', () => ({
  useAuthentication: () => ({ getAccessToken: stableSyntheticToken }),
}));
jest.mock('./first-match-api', () => ({ createFirstMatchApi: jest.fn() }));

import FirstMatchRoute from '../../app/(authenticated)/passports/[passportId]/first-match';
import type { FirstMatchApi, FirstMatchFlow } from './first-match-api';
import { createFirstMatchApi } from './first-match-api';
import { FirstMatchForm } from './first-match-form';
import { FirstMatchStateMachine } from './first-match-state';
import { FirstMatchWaiting } from './first-match-waiting';

const passportId = '22222222-2222-4222-8222-222222222222';
const matchId = '44444444-4444-4444-8444-444444444444';
const stableSyntheticToken = () => 'synthetic-token';
const waiting: FirstMatchFlow = { passportId, state: 'WAITING', allowedActions: ['RESCHEDULE', 'CANCEL'], match: {
  id: matchId, version: 1, matchDate: '2026-10-18', matchTime: '10:00', opponent: 'Rival de prueba',
  competition: 'Liga de prueba', venue: 'Cancha de prueba', state: 'WAITING',
} };
const invitation: FirstMatchFlow = { passportId, state: 'INVITATION', allowedActions: ['SCHEDULE'] };
const availability = { configured: true, matchDate: '2026-10-18', periodStart: '2026-10-09',
  periodEndExclusive: '2027-01-09', cadence: 'QUARTERLY' as const, limit: 1, reserved: 1, used: 0, available: 0 };

function screenWidth(width: number) {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

describe('Feature 009 correction and persistent waiting', () => {
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => jest.clearAllMocks());

  it.each([390, 1280])('places secondary actions below saved waiting details without a passport menu at %i', async (width) => {
    screenWidth(width);
    const onReschedule = jest.fn();
    const onCancel = jest.fn();
    const view = await render(<FirstMatchWaiting match={waiting.match!} allowedActions={waiting.allowedActions}
      onReschedule={onReschedule} onCancel={onCancel} viewportWidth={width} />);
    expect(view.getByTestId(`first-match-waiting-${width >= 1024 ? 'desktop' : 'mobile'}`)).toBeTruthy();
    expect(view.getByText('Rival de prueba')).toBeTruthy();
    expect(view.getByText('Liga de prueba')).toBeTruthy();
    expect(view.getByText('Cancha de prueba')).toBeTruthy();
    expect(view.getByTestId('first-match-waiting-actions')).toBeTruthy();
    expect(view.getByTestId('first-match-waiting-details')).toBeTruthy();
    const rendered = JSON.stringify(view.toJSON());
    expect(rendered.indexOf('first-match-waiting-details')).toBeLessThan(rendered.indexOf('first-match-waiting-actions'));
    expect(view.queryByTestId('passport-nav-desktop')).toBeNull();
    expect(view.queryByTestId('passport-nav-mobile')).toBeNull();
    expect(view.queryByText(/Analista asignado/)).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Reagendar' }));
    await fireEvent.press(view.getByRole('button', { name: 'Cancelar partido' }));
    expect(onReschedule).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('prefills the same match in edit mode and treats form Cancelar as discard only', async () => {
    screenWidth(390);
    const onDiscard = jest.fn();
    const onSubmit = jest.fn();
    const view = await render(<FirstMatchForm passportId={passportId} availability={availability} submitting={false}
      mode="reschedule" initialFields={waiting.match!} currentMatchDate={waiting.match!.matchDate}
      onDateChange={jest.fn()} onSubmit={onSubmit} onDiscard={onDiscard} />);
    expect(view.getByTestId('first-match-field-opponent').props.value).toBe('Rival de prueba');
    expect(view.getByRole('button', { name: 'Confirmar reagendamiento' })).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Confirmar reagendamiento' }));
    expect(onSubmit).toHaveBeenCalledWith({ matchDate: '2026-10-18', matchTime: '10:00',
      opponent: 'Rival de prueba', competition: 'Liga de prueba', venue: 'Cancha de prueba' });
    await fireEvent.press(view.getByRole('button', { name: 'Cancelar formulario' }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('opens the same match for editing and preserves the booked match on a server validation error', async () => {
    screenWidth(390);
    const flow = jest.fn().mockResolvedValue({ kind: 'success', value: waiting });
    const reschedule = jest.fn().mockResolvedValue({ kind: 'invalid' });
    (createFirstMatchApi as jest.Mock).mockReturnValue({ flow,
      preview: jest.fn().mockResolvedValue({ kind: 'success', value: availability }),
      schedule: jest.fn(), reschedule, cancel: jest.fn() });
    const view = await render(<FirstMatchRoute />);
    await waitFor(() => expect(view.getByTestId('first-match-waiting-details')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Reagendar' }));
    await waitFor(() => expect(view.getByTestId('first-match-field-opponent').props.value).toBe('Rival de prueba'));
    await fireEvent.press(view.getByRole('button', { name: 'Confirmar reagendamiento' }));
    await waitFor(() => expect(reschedule).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.getByText(/Revisa la fecha, hora y los datos/)).toBeTruthy());
    expect(flow).toHaveBeenCalledTimes(2);
    expect(view.getByText(/Se conserva una sola unidad del partido/)).toBeTruthy();
    expect(reschedule.mock.calls[0]?.[1]).toBe(matchId);
    expect(reschedule.mock.calls[0]?.[2]).toMatchObject({ expectedVersion: 1, opponent: 'Rival de prueba' });
    await fireEvent.press(view.getByRole('button', { name: 'Cancelar formulario' }));
    expect(view.getByTestId('first-match-waiting-details')).toBeTruthy();
    expect(view.getByText('Rival de prueba')).toBeTruthy();
  });

  it('refreshes after a rejected correction while retaining the server booking, and retries uncertain cancellation with one key', async () => {
    const flow = jest.fn().mockResolvedValue({ kind: 'success', value: waiting });
    const reschedule = jest.fn().mockResolvedValue({ kind: 'conflict' });
    const cancel = jest.fn().mockResolvedValueOnce({ kind: 'unavailable' })
      .mockResolvedValueOnce({ kind: 'success', value: invitation });
    const api: FirstMatchApi = { flow, preview: jest.fn().mockResolvedValue({ kind: 'success', value: availability }),
      schedule: jest.fn(), reschedule, cancel };
    const machine = new FirstMatchStateMachine(api, passportId);
    await machine.load();
    await machine.reschedule(waiting.match!, { matchDate: '2026-10-19', matchTime: '11:00',
      opponent: 'Nuevo rival', competition: 'Liga de prueba', venue: 'Cancha de prueba' });
    expect(flow).toHaveBeenCalledTimes(2);
    expect(machine.state).toMatchObject({ notice: 'conflict', flow: { state: 'WAITING', match: { id: matchId,
      opponent: 'Rival de prueba', version: 1 } } });
    expect(reschedule.mock.calls[0]?.[2]).toMatchObject({ expectedVersion: 1 });
    await machine.cancel(waiting.match!);
    expect(machine.state).toMatchObject({ notice: 'unavailable', flow: { state: 'WAITING', match: { id: matchId } } });
    await machine.cancel(waiting.match!);
    expect(cancel.mock.calls[0]?.[2].idempotencyKey).toBe(cancel.mock.calls[1]?.[2].idempotencyKey);
    expect(cancel.mock.calls[0]?.[2].expectedVersion).toBe(1);
    machine.dispose();
  });

  it('keeps booked-match cancellation behind separate confirmation and hides actions after load', async () => {
    screenWidth(390);
    const flow = jest.fn().mockResolvedValueOnce({ kind: 'success', value: waiting })
      .mockResolvedValueOnce({ kind: 'success', value: invitation });
    const cancel = jest.fn().mockResolvedValue({ kind: 'success', value: invitation });
    (createFirstMatchApi as jest.Mock).mockReturnValue({ flow, preview: jest.fn().mockResolvedValue({ kind: 'success', value: availability }), schedule: jest.fn(),
      reschedule: jest.fn(), cancel });
    const view = await render(<FirstMatchRoute />);
    await waitFor(() => expect(view.getByTestId('first-match-waiting-details')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Cancelar partido' }));
    expect(cancel).not.toHaveBeenCalled();
    expect(view.getByText(/¿Cancelar este partido/)).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Conservar partido' }));
    expect(cancel).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Cancelar partido' }));
    await fireEvent.press(view.getByRole('button', { name: 'Confirmar cancelación del partido' }));
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.getByRole('button', { name: 'Agendar primer partido' })).toBeTruthy());
    await view.unmount();

    const loaded: FirstMatchFlow = { ...waiting, state: 'LOADED', allowedActions: [],
      match: { ...waiting.match!, state: 'LOADED' } };
    (createFirstMatchApi as jest.Mock).mockReturnValue({ flow: jest.fn().mockResolvedValue({ kind: 'success', value: loaded }),
      preview: jest.fn().mockResolvedValue({ kind: 'success', value: availability }), schedule: jest.fn(), reschedule: jest.fn(), cancel: jest.fn() });
    const loadedView = await render(<FirstMatchRoute />);
    await waitFor(() => expect(loadedView.getByText(/Abriendo pasaporte/)).toBeTruthy());
    await waitFor(() => expect(loadedView.queryByRole('button', { name: 'Reagendar' })).toBeNull());
    expect(loadedView.queryByRole('button', { name: 'Cancelar partido' })).toBeNull();
  });
});
