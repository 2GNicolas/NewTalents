import { fireEvent, render } from '@testing-library/react-native';

import type { RegistrationRequestSnapshot } from '../registration-request-api';
import { AdminInbox } from './admin-inbox';

const row: RegistrationRequestSnapshot = { id: 'request-1', type: 'PERSONAL_ADULT', status: 'SUBMITTED', version: 1, capabilities: ['registration.review.view'], createdAt: '2026-09-28T12:00:00.000Z', safeApplicantLabel: 'Solicitud sintética', evidenceComplete: true, evidence: [] };

describe('AdminInbox', () => {
  it('renders the unified queue without bulk approval or an authorized-admin menu label', async () => {
    const onOpen = jest.fn();
    const screen = await render(<AdminInbox view={{ filters: {}, rows: [row], scrollOffset: 0, state: 'ready' }} onFilters={jest.fn()} onOpen={onOpen} onLoadNext={jest.fn()} onRetry={jest.fn()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Abrir Solicitud sintética' }));
    expect(onOpen).toHaveBeenCalledWith(row);
    expect(screen.queryByText(/Administrador autorizado/i)).toBeNull();
    expect(screen.queryByText(/Aprobar seleccionadas/i)).toBeNull();
  });

  it('exposes empty and retryable unavailable states', async () => {
    const onRetry = jest.fn();
    const screen = await render(<AdminInbox view={{ filters: {}, rows: [], scrollOffset: 0, state: 'unavailable' }} onFilters={jest.fn()} onOpen={jest.fn()} onLoadNext={jest.fn()} onRetry={onRetry} />);
    fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it.each(['APPROVED', 'REJECTED'] as const)('reports verified evidence deletion for terminal %s rows', async (status) => {
    const screen = await render(<AdminInbox view={{ filters: {}, rows: [{ ...row, status, evidenceComplete: false }], scrollOffset: 0, state: 'ready' }} onFilters={jest.fn()} onOpen={jest.fn()} onLoadNext={jest.fn()} onRetry={jest.fn()} />);
    expect(screen.getByText('Evidencia eliminada')).toBeTruthy();
    expect(screen.queryByText('Evidencia pendiente')).toBeNull();
  });
});
