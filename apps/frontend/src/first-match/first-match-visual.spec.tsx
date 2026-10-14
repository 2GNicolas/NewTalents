import { fireEvent, render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import { FirstMatchInvitation } from './first-match-invitation';
import { FirstMatchForm } from './first-match-form';
import { FirstMatchWaiting } from './first-match-waiting';

const passportId = '22222222-2222-4222-8222-222222222222';
const match = {
  id: '44444444-4444-4444-8444-444444444444', version: 1,
  matchDate: '2026-10-18', matchTime: '10:00', opponent: 'Rival de prueba',
  competition: 'Liga de prueba', venue: 'Cancha de prueba', state: 'WAITING' as const,
};

describe('Feature 009 visual structure and accessible controls', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([390, 1440])('keeps invitation, form and waiting menu-free at %i CSS pixels', async (width) => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
    const start = jest.fn();
    const invitation = await render(<FirstMatchInvitation availability={null} onStart={start} viewportWidth={width} />);
    expect(invitation.getByRole('button', { name: 'Agendar primer partido' })).toBeTruthy();
    expect(invitation.queryByTestId('passport-nav-mobile')).toBeNull();
    expect(invitation.queryByTestId('passport-nav-desktop')).toBeNull();
    await fireEvent.press(invitation.getByRole('button', { name: 'Agendar primer partido' }));
    expect(start).toHaveBeenCalledTimes(1);
    await invitation.unmount();

    const form = await render(<FirstMatchForm passportId={passportId} availability={null} submitting={false}
      onDateChange={jest.fn()} onSubmit={jest.fn()} onDiscard={jest.fn()} viewportWidth={width} />);
    expect(form.getByTestId(width >= 1024 ? 'first-match-form-columns' : 'first-match-form-stack')).toBeTruthy();
    for (const field of ['matchDate', 'matchTime', 'opponent', 'competition', 'venue']) {
      expect(form.getByTestId(`first-match-field-${field}`)).toBeTruthy();
    }
    expect(form.getByRole('button', { name: 'Cancelar formulario' })).toBeTruthy();
    expect(form.queryByTestId('passport-nav-mobile')).toBeNull();
    await form.unmount();

    const waiting = await render(<FirstMatchWaiting match={match} allowedActions={['RESCHEDULE', 'CANCEL']}
      onReschedule={jest.fn()} onCancel={jest.fn()} viewportWidth={width} />);
    expect(waiting.getByTestId('first-match-waiting-details')).toBeTruthy();
    expect(waiting.getByTestId('first-match-waiting-actions')).toBeTruthy();
    expect(waiting.getByRole('button', { name: 'Reagendar' })).toBeTruthy();
    expect(waiting.getByRole('button', { name: 'Cancelar partido' })).toBeTruthy();
    expect(waiting.queryByTestId('passport-nav-mobile')).toBeNull();
    expect(waiting.queryByTestId('passport-nav-desktop')).toBeNull();
  });

  it('names field errors and keeps availability as an announced status', async () => {
    const form = await render(<FirstMatchForm passportId={passportId} availability={null} submitting={false}
      onDateChange={jest.fn()} onSubmit={jest.fn()} onDiscard={jest.fn()} viewportWidth={390} />);
    await fireEvent.press(form.getByRole('button', { name: 'Confirmar agendamiento' }));
    expect(form.getAllByRole('alert')).toHaveLength(5);
    expect(form.getByTestId('first-match-field-opponent').props.accessibilityLabel)
      .toContain('El rival es obligatorio.');
    expect(JSON.stringify(form.toJSON())).toContain('polite');
  });
});
