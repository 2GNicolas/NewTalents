import { fireEvent, render } from '@testing-library/react-native';

import type { AdminRegistrationReview } from '../registration-request-api';
import { AdminRequestReview } from './admin-request-review';

const review: AdminRegistrationReview = {
  id: 'request-1', type: 'PERSONAL_ADULT', status: 'SUBMITTED', version: 3, versionFresh: true, approvalExecutionStatus: 'NONE', createdAt: '2026-09-28T12:00:00.000Z',
  structuredData: { applicants: [{ id: 'person-1', legalName: 'Persona sintética', document: { type: 'CC', number: '1000' } }], players: [], representatives: [], detail: { actingForSelf: true } },
  evidence: [{ id: 'evidence-1', category: 'IDENTITY_FRONT', status: 'CLEAN', sizeBytes: 1024 }], consents: [{ type: 'PRIVACY', version: 'v1', acceptedAt: '2026-09-28T12:00:00.000Z' }], duplicateReview: { state: 'CLEAR', canApprove: true }, capabilities: ['registration.review.view-evidence'], history: [{ at: '2026-09-28T12:00:00.000Z', action: 'SUBMIT', result: 'APPLIED' }],
};

describe('AdminRequestReview', () => {
  it('shows minimum structured data, ordinary document wording and the operational history last', async () => {
    const openEvidence = jest.fn();
    const correction = jest.fn(); const reject = jest.fn(); const approve = jest.fn();
    const privateReview = { ...review, structuredData: { ...review.structuredData, applicants: [{ legalName: 'Persona sintética', document: { type: 'CC', number: '1234567890' }, email: 'persona@example.test' }] } };
    const screen = await render(<AdminRequestReview review={privateReview} onBack={jest.fn()} onOpenEvidence={openEvidence} onCorrection={correction} onReject={reject} onContinue={approve} />);
    expect(screen.getByText('Información de la solicitud')).toBeTruthy();
    expect(screen.getByText('Documentos de la solicitud')).toBeTruthy();
    expect(screen.getByText('Proceso de revisión')).toBeTruthy();
    expect(screen.getByText('Eliminación segura de evidencias')).toBeTruthy();
    expect(screen.queryByText('1234567890')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Consultar Documento de identidad · frente' }));
    expect(openEvidence).toHaveBeenCalledWith('evidence-1');
    expect(screen.getByRole('button', { name: 'Solicitar corrección' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar revisión' })).toBeTruthy();
    expect(screen.queryByText(/candidate|fingerprint|clave de objeto/i)).toBeNull();
  });

  it('blocks continuation from a stale projection', async () => {
    const onContinue = jest.fn();
    const screen = await render(<AdminRequestReview review={{ ...review, versionFresh: false }} onBack={jest.fn()} onOpenEvidence={jest.fn()} onContinue={onContinue} />);
    const button = screen.getByRole('button', { name: 'Continuar revisión' });
    fireEvent.press(button);
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByText(/vista quedó desactualizada/i)).toBeTruthy();
  });
});
