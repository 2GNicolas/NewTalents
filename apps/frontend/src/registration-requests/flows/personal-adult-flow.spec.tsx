import { act, fireEvent, render } from '@testing-library/react-native';
import { createElement } from 'react';

import { buildPersonalAdultDraft, PersonalAdultFlow } from './personal-adult-flow';

describe('PersonalAdultFlow', () => {
  it('builds the closed adult DTO with credentials, self action, identity and approved consents', () => {
    const draft = buildPersonalAdultDraft({ email: 'adult@example.test', password: 'synthetic-password', legalNames: 'Laura', legalSurnames: 'Rojas', documentType: 'CC', documentNumber: '123', birthDate: '1994-08-14', country: 'Colombia', city: 'Bogotá D.C.', phone: '', privacyAccepted: true, truthfulnessAccepted: true });
    expect(draft).toEqual({ type: 'PERSONAL_ADULT', details: expect.objectContaining({ actingForSelf: true, credentials: expect.objectContaining({ email: 'adult@example.test' }), person: expect.objectContaining({ legalNames: 'Laura', legalSurnames: 'Rojas' }), consent: expect.objectContaining({ privacyAccepted: true, truthfulnessAccepted: true }) }) });
    expect(JSON.stringify(draft)).not.toMatch(/isAdult|sport|position|statistics/i);
  });

  it('renders the five-step identity and review experiences with optional phone and required evidence', async () => {
    const identity = await render(createElement(PersonalAdultFlow, { initialStep: 'identity', onSave: jest.fn(), onSubmit: jest.fn() }));
    expect(identity.getByText('Paso 2 de 5')).toBeTruthy();
    expect(identity.getByLabelText('Teléfono (opcional)')).toBeTruthy();
    expect(identity.queryByText(/posición|estadísticas/i)).toBeNull();

    const review = await render(createElement(PersonalAdultFlow, { initialStep: 'review', onSave: jest.fn(), onSubmit: jest.fn() }));
    expect(review.getByText('Documentos de identidad')).toBeTruthy();
    expect(review.getByText('Documento — frente')).toBeTruthy();
    expect(review.getByText('Documento — reverso')).toBeTruthy();
  });

  it('requires consent before submission and provides an accessible retry-safe submission action', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const screen = await render(createElement(PersonalAdultFlow, { initialStep: 'review', onSave: jest.fn(), onSubmit }));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Enviar solicitud' })); });
    expect(screen.getAllByText('Confirma el tratamiento de datos y la veracidad.').length).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Tratamiento de datos personales' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Declaración de veracidad' })).toBeTruthy();
  });

  it('announces a failed upload and only confirms the backend success on retry', async () => {
    const onSubmit = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const screen = await render(createElement(PersonalAdultFlow, { initialStep: 'review', onSave: jest.fn(), onSubmit, getSubmissionError: () => 'El escáner no está disponible. Conservamos tus documentos.' }));
    await act(async () => { fireEvent.press(screen.getByRole('checkbox', { name: 'Consentimiento obligatorio' })); });
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Enviar solicitud' })); });
    expect(screen.getByText('El escáner no está disponible. Conservamos tus documentos.')).toBeTruthy();
    expect(screen.queryByText(/Estado confirmado/)).toBeNull();
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Enviar solicitud' })); });
    expect(screen.getByText('Solicitud enviada. Estado confirmado: en revisión.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar solicitud' }).props.accessibilityState.disabled).toBe(true);
  });
});
