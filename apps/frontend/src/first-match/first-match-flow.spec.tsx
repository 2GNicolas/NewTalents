import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import type { FirstMatchApi, FirstMatchFlow } from './first-match-api';
import { createFirstMatchApi } from './first-match-api';
import { FirstMatchForm } from './first-match-form';
import { FirstMatchInvitation } from './first-match-invitation';
import { FirstMatchStateMachine } from './first-match-state';

const passportId = '22222222-2222-4222-8222-222222222222';
const invitation: FirstMatchFlow = { passportId, state: 'INVITATION', allowedActions: ['SCHEDULE'] };
const waiting: FirstMatchFlow = { passportId, state: 'WAITING', allowedActions: [], match: {
  id: '44444444-4444-4444-8444-444444444444', version: 1, matchDate: '2026-10-18',
  matchTime: '10:00', opponent: 'Rival de prueba', competition: 'Liga de prueba', venue: 'Cancha de prueba', state: 'WAITING',
} };
const availability = { configured: true, matchDate: '2026-10-18', periodStart: '2026-10-09',
  periodEndExclusive: '2027-01-09', cadence: 'QUARTERLY' as const, limit: 4, reserved: 1, used: 1, available: 2 };
const fields = { matchDate: '2026-10-18', matchTime: '10:00', opponent: 'Rival de prueba',
  competition: 'Liga de prueba', venue: 'Cancha de prueba' };

function screenWidth(width: number) {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

describe('Feature 009 first-match client and flow', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends typed no-store authorized GET/preview/POST and parses only safe server projections', async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    const fetcher = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return { ok: true, json: async () => String(url).includes('/allowance?') ? availability : String(init?.method) === 'POST' ? waiting : invitation } as Response;
    });
    const api = createFirstMatchApi({ apiBaseUrl: 'http://localhost:3100', getAccessToken: () => 'synthetic-token', fetcher });
    await expect(api.flow(passportId)).resolves.toMatchObject({ kind: 'success', value: invitation });
    await expect(api.preview(passportId, fields.matchDate)).resolves.toMatchObject({ kind: 'success', value: availability });
    await expect(api.schedule(passportId, { ...fields, expectedVersion: 0, idempotencyKey: '33333333-3333-4333-8333-333333333333' }))
      .resolves.toMatchObject({ kind: 'success', value: waiting });
    expect(requests).toHaveLength(3);
    expect(requests.every((request) => request.init?.cache === 'no-store' && request.init.headers && JSON.stringify(request.init.headers).includes('synthetic-token'))).toBe(true);
    expect(requests[1]?.url).toContain('matchDate=2026-10-18');
    expect(requests[2]?.init?.method).toBe('POST');
    expect(JSON.stringify(requests[2]?.init?.body)).not.toMatch(/analyst|custody/i);
  });

  it('sends versioned correction commands to the same match without a new scheduling POST', async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    const fetcher = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return { ok: true, json: async () => waiting } as Response;
    });
    const api = createFirstMatchApi({ apiBaseUrl: 'http://localhost:3100', getAccessToken: () => 'synthetic-token', fetcher });
    const matchId = waiting.match!.id;
    await api.reschedule(passportId, matchId, { ...fields, expectedVersion: 1,
      idempotencyKey: '33333333-3333-4333-8333-333333333333' });
    await api.cancel(passportId, matchId, { expectedVersion: 1,
      idempotencyKey: '55555555-5555-4555-8555-555555555555' });
    expect(requests.map((request) => [request.init?.method, request.url])).toEqual([
      ['PUT', `http://localhost:3100/passports/${passportId}/first-match/${matchId}`],
      ['POST', `http://localhost:3100/passports/${passportId}/first-match/${matchId}/cancel`],
    ]);
    expect(requests.every((request) => request.init?.cache === 'no-store'
      && JSON.parse(String(request.init?.body)).expectedVersion === 1)).toBe(true);
  });

  it('retries an uncertain submit with the same key, refreshes conflicts and never POSTS on reload', async () => {
    const flow = jest.fn().mockResolvedValueOnce({ kind: 'success', value: invitation })
      .mockResolvedValueOnce({ kind: 'success', value: waiting })
      .mockResolvedValueOnce({ kind: 'success', value: waiting });
    const schedule = jest.fn().mockResolvedValueOnce({ kind: 'unavailable' })
      .mockResolvedValueOnce({ kind: 'success', value: waiting });
    const api: FirstMatchApi = { flow, schedule, preview: jest.fn() };
    const firstSession = new FirstMatchStateMachine(api, passportId);
    await firstSession.load();
    await firstSession.schedule(fields);
    expect(firstSession.state.notice).toBe('unavailable');
    await firstSession.schedule(fields);
    expect(schedule).toHaveBeenCalledTimes(2);
    expect(schedule.mock.calls[0]?.[1].idempotencyKey).toBe(schedule.mock.calls[1]?.[1].idempotencyKey);
    expect(firstSession.state.flow?.state).toBe('WAITING');
    firstSession.dispose();
    const nextSession = new FirstMatchStateMachine(api, passportId);
    await nextSession.load();
    expect(nextSession.state.flow?.match?.id).toBe(waiting.match?.id);
    expect(schedule).toHaveBeenCalledTimes(2);
    nextSession.dispose();
  });

  it('keeps waiting until a fresh server read reports LOADED and drops pre-load actions', async () => {
    const loaded: FirstMatchFlow = { passportId, state: 'LOADED', allowedActions: [],
      match: { ...waiting.match!, state: 'LOADED' } };
    const flow = jest.fn().mockResolvedValueOnce({ kind: 'success', value: waiting })
      .mockResolvedValueOnce({ kind: 'success', value: loaded });
    const machine = new FirstMatchStateMachine({ flow, preview: jest.fn(), schedule: jest.fn() }, passportId);
    await machine.load();
    expect(machine.state.flow?.state).toBe('WAITING');
    await machine.load();
    expect(machine.state.flow).toMatchObject({ state: 'LOADED', allowedActions: [] });
    expect(machine.state.flow?.match).not.toHaveProperty('analystIdentityId');
    machine.dispose();
  });

  it('ignores pre-load actions and private fields on a LOADED client projection', async () => {
    const fetcher = jest.fn(async () => ({ ok: true, json: async () => ({
      passportId, state: 'LOADED', allowedActions: ['RESCHEDULE', 'CANCEL'],
      match: { ...waiting.match, state: 'LOADED', analystIdentityId: 'private', sportingData: 'unpublished' },
    }) } as Response));
    const api = createFirstMatchApi({ apiBaseUrl: 'http://localhost:3100', getAccessToken: () => 'synthetic-token', fetcher });
    const result = await api.flow(passportId);
    expect(result).toMatchObject({ kind: 'success', value: { state: 'LOADED', allowedActions: [] } });
    expect(JSON.stringify(result)).not.toMatch(/private|unpublished|analystIdentityId|sportingData/);
  });

  it('clears protected flow on lost access and preserves user input on a capacity error', async () => {
    const api: FirstMatchApi = {
      flow: jest.fn().mockResolvedValueOnce({ kind: 'success', value: waiting }).mockResolvedValueOnce({ kind: 'restricted' }),
      preview: jest.fn().mockResolvedValue({ kind: 'success', value: availability }),
      schedule: jest.fn().mockResolvedValue({ kind: 'allowance-full' }),
    };
    const machine = new FirstMatchStateMachine(api, passportId);
    await machine.load();
    expect(machine.state.flow?.match?.opponent).toBe('Rival de prueba');
    await machine.load();
    expect(machine.state).toMatchObject({ flow: null, availability: null, notice: 'restricted' });
    machine.dispose();

    screenWidth(390);
    const onSubmit = jest.fn();
    const form = await render(<FirstMatchForm passportId={passportId} availability={availability} notice="allowance-full"
      submitting={false} onDateChange={jest.fn()} onSubmit={onSubmit} onDiscard={jest.fn()} />);
    await fireEvent.changeText(form.getByTestId('first-match-field-opponent'), fields.opponent);
    expect(form.getByTestId('first-match-field-opponent').props.value).toBe(fields.opponent);
    await form.rerender(<FirstMatchForm passportId={passportId} availability={{ ...availability, available: 0 }} notice="allowance-full"
      submitting={false} onDateChange={jest.fn()} onSubmit={onSubmit} onDiscard={jest.fn()} />);
    expect(form.getByTestId('first-match-field-opponent').props.value).toBe(fields.opponent);
    expect(form.getByText(/No quedan cupos/)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refreshes the selected-date allowance after a capacity rejection without minting another intent', async () => {
    const preview = jest.fn().mockResolvedValue({ kind: 'success', value: { ...availability, available: 0 } });
    const schedule = jest.fn().mockResolvedValue({ kind: 'allowance-full' });
    const machine = new FirstMatchStateMachine({ flow: jest.fn().mockResolvedValue({ kind: 'success', value: invitation }), preview, schedule }, passportId);
    await machine.load();
    await machine.schedule(fields);
    expect(preview).toHaveBeenCalledWith(passportId, fields.matchDate);
    expect(machine.state).toMatchObject({ phase: 'ready', notice: 'allowance-full', availability: { available: 0 } });
    expect(schedule).toHaveBeenCalledTimes(1);
    machine.dispose();
  });

  it.each([390, 1280])('renders menu-free invitation and required responsive form at width %i', async (width) => {
    screenWidth(width);
    const start = jest.fn();
    const invite = await render(<FirstMatchInvitation availability={availability} onStart={start} viewportWidth={width} />);
    expect(invite.getByTestId(`first-match-invitation-${width >= 1024 ? 'desktop' : 'mobile'}`)).toBeTruthy();
    expect(invite.getByText(/2 partidos disponibles/)).toBeTruthy();
    expect(invite.queryByTestId('passport-nav-mobile')).toBeNull();
    expect(invite.queryByTestId('passport-nav-desktop')).toBeNull();
    await fireEvent.press(invite.getByRole('button', { name: 'Agendar primer partido' }));
    expect(start).toHaveBeenCalledTimes(1);
    await invite.unmount();

    const submit = jest.fn();
    const onDateChange = jest.fn();
    const form = await render(<FirstMatchForm passportId={passportId} availability={availability} viewportWidth={width}
      submitting={false} onDateChange={onDateChange} onSubmit={submit} onDiscard={jest.fn()} />);
    expect(form.getByTestId(width >= 1024 ? 'first-match-form-columns' : 'first-match-form-stack')).toBeTruthy();
    await fireEvent.press(form.getByRole('button', { name: 'Confirmar agendamiento' }));
    expect(submit).not.toHaveBeenCalled();
    expect(form.getAllByRole('alert')).toHaveLength(5);
    expect(form.getByTestId('first-match-field-matchDate').props.accessibilityLabel)
      .toBe('Fecha obligatoria. La fecha es obligatoria.');
    for (const [name, value] of Object.entries(fields)) await fireEvent.changeText(form.getByTestId(`first-match-field-${name}`), value);
    expect(onDateChange).toHaveBeenCalledWith(fields.matchDate);
    await fireEvent.press(form.getByRole('button', { name: 'Confirmar agendamiento' }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(fields));
    expect(form.queryByTestId('passport-nav-desktop')).toBeNull();
    expect(form.queryByTestId('passport-nav-mobile')).toBeNull();
    expect(form.getByText(/Reservados: 1; usados: 1/)).toBeTruthy();
  });
});
