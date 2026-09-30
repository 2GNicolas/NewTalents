import { act, fireEvent, render } from '@testing-library/react-native';
import { createElement } from 'react';

import { AdditionalAccountFlow, buildAdditionalAccountDraft } from './additional-account-flow';

describe('AdditionalAccountFlow', () => {
  it('builds the request in the projected academy context and never permits changing it', async () => {
    const draft = buildAdditionalAccountDraft('academy-1', { names: 'Laura', surnames: 'Martínez', documentType: 'CC', documentNumber: '1234', birthDate: '1990-01-01', country: 'CO', city: '11001', phone: '3000000000', function: 'Coordinadora', responsibleAuthorization: true, privacyAccepted: true, truthfulnessAccepted: true });
    expect(draft).toMatchObject({ type: 'ADDITIONAL_ACADEMY_ACCOUNT', academyId: 'academy-1', details: { function: 'Coordinadora', responsibleAuthorization: true } });
    expect(draft.details).not.toHaveProperty('academyId');
    const screen = await render(createElement(AdditionalAccountFlow, { academy: { id: 'academy-1', name: 'Academia Horizonte', location: 'Bogotá', approved: true }, onSubmit: jest.fn() }));
    expect(screen.getByText('Esta academia no se puede modificar desde esta solicitud.')).toBeTruthy();
    expect(screen.queryByLabelText(/^Academia$/i)).toBeNull();
    expect(screen.getByLabelText('Nombres legales')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Autorización de la academia' })).toBeTruthy();
  });

  it('blocks submit with the specific first missing evidence category', async () => {
    const onSubmit = jest.fn().mockResolvedValue(false);
    const screen = await render(createElement(AdditionalAccountFlow, { academy: { id: 'academy-1', name: 'Academia Horizonte', location: 'Bogotá', approved: true }, onSubmit, initialValid: true }));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Enviar solicitud' })); });
    expect(await screen.findByText(/evidencia requerida: documento de identidad — frente/i)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Enviar solicitud' }).props.accessibilityState.disabled).toBe(false);
  });
});
