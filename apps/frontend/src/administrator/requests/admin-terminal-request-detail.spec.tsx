import { render } from '@testing-library/react-native';

import type { AdminRegistrationReview } from '../../registration-requests/registration-request-api';
import { AdminTerminalRequestDetail } from './admin-terminal-request-detail';

const approved: AdminRegistrationReview = {
  id: '10000000-0000-4000-8000-000000000001', type: 'PERSONAL_ADULT', status: 'APPROVED', version: 4, versionFresh: true,
  approvalExecutionStatus: 'FINALIZED', createdAt: '2026-09-29T12:00:00.000Z', submittedAt: '2026-09-29T12:05:00.000Z',
  structuredData: { applicants: [{ legalName: 'Valentina Pérez', email: 'private@example.test', document: { number: '123456789' } }], players: [], representatives: [], detail: { actingForSelf: true } },
  evidence: [{ id: 'evidence', category: 'IDENTITY_FRONT', status: 'DELETED', sizeBytes: 10 }], consents: [], duplicateReview: { state: 'CLEAR', canApprove: false }, capabilities: [],
  history: [{ at: '2026-09-29T12:05:00.000Z', action: 'SUBMIT', fromStatus: 'DRAFT', toStatus: 'SUBMITTED', result: 'APPLIED' }, { at: '2026-09-29T13:00:00.000Z', action: 'APPROVE', fromStatus: 'SUBMITTED', toStatus: 'APPROVED', result: 'APPLIED' }],
};

describe('AdminTerminalRequestDetail', () => {
  it('shows approved submitted information and safe history without review or evidence controls', async () => {
    const screen = await render(<AdminTerminalRequestDetail review={approved} onBack={jest.fn()} />);
    expect(screen.getByRole('header', { name: 'Solicitud aprobada' })).toBeTruthy();
    expect(screen.getByText('Valentina Pérez')).toBeTruthy();
    expect(screen.getByText('Nombre del solicitante')).toBeTruthy();
    expect(screen.getByText('Aprobación aplicada')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Solicitar corrección' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continuar revisión' })).toBeNull();
    expect(screen.queryByText('Documentos de la solicitud')).toBeNull();
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/private@example|123456789|evidence/i);
  });

  it('announces the dossier as the return destination when opened from a dossier', async () => {
    const screen = await render(<AdminTerminalRequestDetail review={approved} backLabel="Volver al expediente" onBack={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Volver al expediente' })).toBeTruthy();
  });
});
