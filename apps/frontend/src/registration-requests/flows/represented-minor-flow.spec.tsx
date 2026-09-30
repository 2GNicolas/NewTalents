import { act, fireEvent, render } from '@testing-library/react-native';
import { createElement } from 'react';

import { buildRepresentedMinorDraft, RepresentedMinorFlow } from './represented-minor-flow';
import { RegistrationEvidenceUploadQueue } from '../evidence/upload-queue';
import { REQUIRED_EVIDENCE } from './registration-submission';

describe('RepresentedMinorFlow', () => {
  it.each(REQUIRED_EVIDENCE.REPRESENTED_MINOR)('blocks leaving documents when %s is missing', async (missing) => {
    const queue = new RegistrationEvidenceUploadQueue({ transport: { upload: jest.fn() } });
    for (const category of REQUIRED_EVIDENCE.REPRESENTED_MINOR) if (category !== missing) queue.add({ category, label: category, source: { kind: 'web', file: { name: 'synthetic.pdf', type: 'application/pdf', size: 20 } } });
    const onSave = jest.fn();
    const screen = await render(createElement(RepresentedMinorFlow, { initialStep: 'documents', onSave, onSubmit: jest.fn(), evidenceQueue: queue }));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Guardar y continuar' })); });
    expect(screen.getByText('Paso 4 de 6')).toBeTruthy();
    expect(screen.getAllByText(new RegExp(`Selecciona .*${missing === 'IDENTITY_FRONT' ? 'frente' : missing === 'IDENTITY_BACK' ? 'reverso' : missing === 'MINOR_CIVIL_IDENTITY' ? 'registro civil' : 'representación legal'}`, 'i')).length).toBeGreaterThan(0);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('maps visible authorizations to all four exact consent values and the version', () => {
    const draft = buildRepresentedMinorDraft({ email: 'synthetic@example.test', password: 'SyntheticOnly2026!', representativeNames: 'Persona', representativeSurnames: 'Sintética', representativeDocumentType: 'CC', representativeDocumentNumber: 'TEST', representativeBirthDate: '1988-01-01', representativeCountry: 'Colombia', representativeCity: 'Bogotá', representativePhone: '3000000000', relationship: 'MOTHER', minorNames: 'Menor', minorSurnames: 'Sintético', minorDocumentType: 'TI', minorDocumentNumber: 'TEST2', minorBirthDate: '2015-01-01', minorCountry: 'Colombia', minorCity: 'Bogotá', authorityDeclared: true, privacyAccepted: true, truthfulnessAccepted: true, minorTreatmentAccepted: true });
    expect(draft.details.consent).toEqual({ privacyVersion: '2026-09', privacyAccepted: true, truthfulnessAccepted: true, representationAccepted: true, minorTreatmentAccepted: true });
    expect(draft.details.representative?.city).toBe('Bogotá');
  });
  it('builds separate representative and minor identities with no minor credentials or contact', () => {
    const draft = buildRepresentedMinorDraft({ email: 'representative@example.test', password: 'synthetic-password', representativeNames: 'Mariana', representativeSurnames: 'Torres', representativeDocumentType: 'CC', representativeDocumentNumber: '7392', representativeBirthDate: '1986-01-01', representativeCountry: 'Colombia', representativeCity: 'Bogotá D.C.', representativePhone: '+57 3000000017', relationship: 'MOTHER', minorNames: 'Samuel', minorSurnames: 'Torres', minorDocumentType: 'TI', minorDocumentNumber: '6158', minorBirthDate: '2014-03-09', minorCountry: 'Colombia', minorCity: 'Bogotá D.C.', authorityDeclared: true, privacyAccepted: true, truthfulnessAccepted: true, minorTreatmentAccepted: true });
    expect(draft.type).toBe('REPRESENTED_MINOR');
    expect(draft.details.representative?.phone).toBe('+57 3000000017');
    expect(draft.details.relationship).toBe('MOTHER');
    expect(draft.details.minor).not.toHaveProperty('email');
    expect(draft.details.minor).not.toHaveProperty('phone');
    expect(draft.details.minor).not.toHaveProperty('password');
  });

  it('shows mandatory representative phone, controlled relationship, minor account warning and exact evidence', async () => {
    const screen = await render(createElement(RepresentedMinorFlow, { initialStep: 'minor', onSave: jest.fn(), onSubmit: jest.fn() }));
    expect(screen.getByText('Paso 3 de 6')).toBeTruthy();
    expect(screen.getByText('Teléfono obligatorio')).toBeTruthy();
    expect(screen.getByText('El menor no recibirá cuenta, correo electrónico ni contraseña.')).toBeTruthy();

    const review = await render(createElement(RepresentedMinorFlow, { initialStep: 'review', onSave: jest.fn(), onSubmit: jest.fn() }));
    expect(review.getByText('Identidad del menor o registro civil')).toBeTruthy();
    expect(review.getByText('Evidencia de representación legal')).toBeTruthy();
  });

  it('blocks submission until authority and minor-treatment consent are both accepted', async () => {
    const onSubmit = jest.fn();
    const screen = await render(createElement(RepresentedMinorFlow, { initialStep: 'review', onSave: jest.fn(), onSubmit }));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Enviar solicitud' })); });
    expect(screen.getAllByText('Confirma la autoridad legal y el tratamiento de datos.').length).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not treat a checked-looking review control as persisted consent', async () => {
    const onSubmit = jest.fn().mockResolvedValue(false);
    const screen = await render(createElement(RepresentedMinorFlow, { initialStep: 'review', onSave: jest.fn(), onSubmit, getSubmissionError: () => 'No pudimos iniciar la sesión pendiente.' }));
    await act(async () => { fireEvent.press(screen.getByRole('checkbox', { name: 'Declaración de autoridad legal' })); });
    expect(screen.getByText('Declaraciones y consentimiento')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Privacidad (versión 2026-09)' })).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByText(/Estado confirmado/)).toBeNull();
  });
});
