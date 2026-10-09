import { fireEvent, render } from '@testing-library/react-native';

import { DraftForm } from '../../src/passport/forms/draft-form';

async function fillPlayer(screen: Awaited<ReturnType<typeof render>>, dateOfBirth: string) {
  await fireEvent.changeText(screen.getByLabelText('Nombre legal del jugador'), 'Nombre De Prueba');
  await fireEvent.changeText(screen.getByLabelText('Fecha de nacimiento'), dateOfBirth);
  await fireEvent.changeText(screen.getByLabelText('Tipo de documento del jugador'), 'TI');
  await fireEvent.changeText(screen.getByLabelText('Número de documento del jugador'), 'ABC-123');
  await fireEvent.changeText(screen.getByLabelText('Posición'), 'Delantero');
  await fireEvent.changeText(screen.getByLabelText('Categoría de edad'), 'Sub-15');
  await fireEvent.changeText(screen.getByLabelText('Ciudad'), 'Medellín');
  await fireEvent.changeText(screen.getByLabelText('País'), 'Colombia');
  await fireEvent.press(screen.getByRole('button', { name: 'Izquierda' }));
}

describe('corrective responsibility forms', () => {
  it('submits SELF without an authoritative isAdult field and explains server-derived age', async () => {
    const onSubmit = jest.fn();
    const screen = await render(<DraftForm mode="create" managementContext="SELF" onSubmit={onSubmit} />);

    expect(screen.getByText(/servidor.*Colombia.*18 años/i)).toBeTruthy();
    expect(screen.queryByLabelText(/es mayor de edad/i)).toBeNull();
    await fillPlayer(screen, '1990-05-04');
    await fireEvent.press(screen.getByRole('button', { name: 'Crear borrador' }));

    const input = onSubmit.mock.calls[0][0].input;
    expect(input.managementContext).toBe('SELF');
    expect(input).not.toHaveProperty('isAdult');
  });

  it('requires private representative identity, approved relationship and explicit confirmation for a minor', async () => {
    const onSubmit = jest.fn();
    const screen = await render(<DraftForm mode="create" managementContext="LEGAL_REPRESENTATIVE" onSubmit={onSubmit} />);
    await fillPlayer(screen, '2013-05-04');

    await fireEvent.changeText(screen.getByLabelText('Nombre legal del representante'), 'María Responsable');
    await fireEvent.changeText(screen.getByLabelText('Tipo de documento del representante'), 'CC');
    await fireEvent.changeText(screen.getByLabelText('Número de documento del representante'), '987654321');
    await fireEvent.press(screen.getByRole('button', { name: 'Madre' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: /confirmo que tengo autoridad/i }));
    await fireEvent.press(screen.getByRole('button', { name: 'Crear borrador' }));

    expect(onSubmit.mock.calls[0][0].input).toMatchObject({
      managementContext: 'LEGAL_REPRESENTATIVE',
      representative: {
        legalName: 'María Responsable',
        documentType: 'CC',
        documentNumber: '987654321',
        relationship: 'MOTHER',
        authorityConfirmed: true,
      },
    });
  });

  it('collects an existing representative-owned confirmation for academy minor creation', async () => {
    const onSubmit = jest.fn();
    const screen = await render(
      <DraftForm
        mode="create"
        managementContext="ACADEMY"
        academyId="66666666-6666-4666-8666-666666666666"
        onSubmit={onSubmit}
      />,
    );
    await fillPlayer(screen, '2013-05-04');
    await fireEvent.changeText(screen.getByLabelText('Confirmación del representante'), '77777777-7777-4777-8777-777777777777');
    await fireEvent.press(screen.getByRole('button', { name: 'Crear borrador' }));

    expect(onSubmit.mock.calls[0][0].input).toMatchObject({
      managementContext: 'ACADEMY',
      academyId: '66666666-6666-4666-8666-666666666666',
      representativeConfirmationId: '77777777-7777-4777-8777-777777777777',
    });
    expect(screen.queryByRole('checkbox', { name: /empleado/i })).toBeNull();
  });

  it('allows protected identity and birth-date correction only through edit input', async () => {
    const onSubmit = jest.fn();
    const screen = await render(<DraftForm mode="edit" initial={{
      passportId: '44444444-4444-4444-8444-444444444444',
      playerLegalName: 'Nombre Inicial',
      dateOfBirth: '2011-05-04',
      playerDocument: { documentType: 'TI', documentNumber: 'ABC-123' },
      footballProfile: {
        primaryPosition: 'Delantero', declaredAgeCategory: 'Sub-15', city: 'Medellín', country: 'Colombia', dominantFoot: 'LEFT',
      },
      version: 3,
      lifecycleState: 'DRAFT',
    }} onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByLabelText('Fecha de nacimiento'), '2011-05-05');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(onSubmit.mock.calls[0][0]).toMatchObject({ mode: 'edit', input: { dateOfBirth: '2011-05-05', expectedVersion: 3 } });
  });
});
