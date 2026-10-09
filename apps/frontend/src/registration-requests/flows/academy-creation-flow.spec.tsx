import { act, fireEvent, render } from '@testing-library/react-native';
import { createElement } from 'react';

import { AcademyCreationFlow, buildFormalAcademyDraft, buildNaturalPersonAcademyDraft } from './academy-creation-flow';

const responsible = { names: 'Mariana', surnames: 'Torres', documentType: 'CC', documentNumber: '7392', birthDate: '1986-01-01', country: 'CO', city: '11001', phone: '+57 3000000017' };

describe('AcademyCreationFlow', () => {
  it('keeps formal and natural-person DTOs type-specific', () => {
    const common = { email: 'responsible@example.test', password: 'synthetic-password', academyName: 'Academia Horizonte', country: 'CO', city: '11001', trainingPlace: 'Cancha Norte', responsible, privacyAccepted: true, truthfulnessAccepted: true };
    const formal = buildFormalAcademyDraft({ ...common, organizationType: 'SAS', nit: '9014820', authorityDeclared: true });
    const natural = buildNaturalPersonAcademyDraft({ ...common, operationDeclared: true, proofCategories: ['PLACE_USE_AUTHORIZATION'] });
    expect(formal.details).toEqual(expect.objectContaining({ organizationType: 'SAS', nit: '9014820', authorityDeclared: true }));
    expect(formal.details).not.toHaveProperty('proofCategories');
    expect(natural.details).toEqual(expect.objectContaining({ operationDeclared: true, proofCategories: ['PLACE_USE_AUTHORIZATION'] }));
    expect(natural.details).not.toHaveProperty('nit');
    expect(natural.details).not.toHaveProperty('organizationType');
  });

  it('renders formal requirements independently with mandatory responsible phone and exact evidence', async () => {
    const screen = await render(createElement(AcademyCreationFlow, { type: 'FORMAL_ACADEMY', initialStep: 'academy', onSave: jest.fn(), onSubmit: jest.fn() }));
    expect(screen.getByText('Academia formal')).toBeTruthy();
    expect(screen.getByLabelText('NIT')).toBeTruthy();
    expect(screen.queryByText('Prueba de operación')).toBeNull();
  });

  it('uses neutral natural-person wording and controlled proof selection without certification claims', async () => {
    const screen = await render(createElement(AcademyCreationFlow, { type: 'NATURAL_PERSON_ACADEMY', initialStep: 'academy', onSave: jest.fn(), onSubmit: jest.fn() }));
    expect(screen.getByText('Academia operada por persona natural')).toBeTruthy();
    expect(screen.getByText(/no presenta la academia como una entidad jurídica formalmente certificada/i)).toBeTruthy();
    expect(screen.queryByLabelText('NIT')).toBeNull();

    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Guardar y continuar' })); });
    expect(screen.getAllByText('Ingresa el nombre operativo de la academia.').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Nombre operativo o comercial').props.value).toBe('');
  });

  it('prevents submission when the review was opened with required data missing', async () => {
    const onSubmit = jest.fn();
    const screen = await render(createElement(AcademyCreationFlow, { type: 'FORMAL_ACADEMY', initialStep: 'review', onSave: jest.fn(), onSubmit }));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Enviar solicitud' })); });
    expect(screen.getAllByText('Ingresa un correo electrónico válido.').length).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['FORMAL_ACADEMY', 'NATURAL_PERSON_ACADEMY'] as const)('does not call submit for an incomplete %s review', async (type) => {
    const onSubmit = jest.fn().mockResolvedValue(false);
    const screen = await render(createElement(AcademyCreationFlow, { type, initialStep: 'review', onSave: jest.fn(), onSubmit, getSubmissionError: () => 'Revisa los documentos e intenta de nuevo.' }));
    await act(async () => { fireEvent.press(screen.getByRole('checkbox', { name: 'Declaraciones requeridas' })); });
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Enviar solicitud' })); });
    expect(screen.getByText('Ingresa un correo electrónico válido.')).toBeTruthy();
    expect(screen.queryByText(/Estado confirmado/)).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Enviar solicitud' }).props.accessibilityState.disabled).toBe(false);
  });
});
