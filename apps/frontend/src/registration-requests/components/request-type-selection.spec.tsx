import { act, fireEvent, render } from '@testing-library/react-native';
import { createElement } from 'react';

import { RequestTypeSelection } from './request-type-selection';

describe('RequestTypeSelection', () => {
  it('presents Personal and Academia before their explicit request types', async () => {
    const screen = await render(createElement(RequestTypeSelection, { onContinue: jest.fn() }));

    expect(screen.getByRole('button', { name: 'Personal' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Academia' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Para mí' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Para un menor que represento' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Academia formal' })).toBeNull();
  });

  it('supports keyboard-accessible selection and continues with the exact typed route', async () => {
    const onContinue = jest.fn();
    const screen = await render(createElement(RequestTypeSelection, { onContinue }));

    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Academia' })); });
    await act(async () => { fireEvent.press(screen.getByRole('radio', { name: 'Academia formal' })); });
    fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));

    expect(onContinue).toHaveBeenCalledWith('FORMAL_ACADEMY');
  });

  it('keeps touch targets accessible and announces the selected type without exposing an admin action', async () => {
    const screen = await render(createElement(RequestTypeSelection, { onContinue: jest.fn() }));
    const minor = screen.getByRole('radio', { name: 'Para un menor que represento' });
    await act(async () => { fireEvent.press(minor); });

    expect(minor.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(screen.getByText('Solicitud personal para menor representado')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /administr/i })).toBeNull();
  });

  it('exposes the public-home back action', async () => {
    const onBack = jest.fn();
    const screen = await render(createElement(RequestTypeSelection, { onContinue: jest.fn(), onBack }));
    fireEvent.press(screen.getByRole('button', { name: 'Volver al inicio' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
