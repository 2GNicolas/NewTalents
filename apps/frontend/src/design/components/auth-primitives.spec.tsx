import { fireEvent, render } from '@testing-library/react-native';

import {
  AuthAlert,
  AuthButton,
  AuthConfirmationSurface,
  AuthLoading,
  AuthTextField,
} from './auth-primitives';

describe('authentication visual primitives', () => {
  it('connects a labeled field with its error without color-only feedback', async () => {
    const screen = await render(
      <AuthTextField
        label="Correo electrónico"
        value=""
        onChangeText={jest.fn()}
        error="Introduce un correo válido."
      />,
    );

    expect(screen.getByLabelText('Correo electrónico')).toBeTruthy();
    expect(screen.getByRole('alert', { name: 'Introduce un correo válido.' })).toBeTruthy();
  });

  it('keeps password visibility accessible and changes only the input treatment', async () => {
    const screen = await render(
      <AuthTextField label="Contraseña" value="secreto" onChangeText={jest.fn()} isPassword />,
    );

    const field = screen.getByLabelText('Contraseña');
    expect(field.props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(false);
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toBeTruthy();
  });

  it('applies and clears the illuminated focus treatment without changing field availability', async () => {
    const screen = await render(<AuthTextField label="Correo electrónico" value="" onChangeText={jest.fn()} />);
    const field = screen.getByLabelText('Correo electrónico');
    await fireEvent(field, 'focus');
    expect(screen.getByTestId('auth-field-Correo electrónico').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ borderColor: '#C7FF2E' })]));
    await fireEvent(field, 'blur');
    expect(screen.getByTestId('auth-field-Correo electrónico').props.style).not.toEqual(expect.arrayContaining([expect.objectContaining({ borderColor: '#C7FF2E' })]));
  });

  it('announces alerts and preserves a 44 point action while loading', async () => {
    const screen = await render(
      <>
        <AuthAlert variant="warning" message="Inténtalo de nuevo más tarde." />
        <AuthButton label="Continuar" loading onPress={jest.fn()} />
        <AuthLoading label="Cargando" />
      </>,
    );

    expect(screen.getByLabelText('Inténtalo de nuevo más tarde.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar' }).props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(screen.getByLabelText('Cargando')).toBeTruthy();
  });

  it('presents an explicit confirmation surface with cancel and destructive actions', async () => {
    const screen = await render(
      <AuthConfirmationSurface
        visible
        title="Cerrar todas las sesiones"
        message="Se cerrarán las sesiones activas."
        confirmLabel="Cerrar todas"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Cerrar todas las sesiones')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar todas' })).toBeTruthy();
  });
});
