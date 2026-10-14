import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
const mockGetAccessToken = () => 'synthetic-token';
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ requestId: '11111111-1111-4111-8111-111111111111' }),
  useRouter: () => mockRouter,
}));
jest.mock('../../authentication/authentication-provider', () => ({
  useAuthentication: () => ({ getAccessToken: mockGetAccessToken }),
}));
jest.mock('../registration-request-api', () => ({
  createRegistrationRequestApi: jest.fn(),
}));

import AdminApprovalScreen from '../../../app/(admin)/registration/[requestId]/approval';
import type { AdminRegistrationReview } from '../registration-request-api';
import { createRegistrationRequestApi } from '../registration-request-api';
import { AdminDossierApproval } from './admin-dossier-approval';

const requestId = '11111111-1111-4111-8111-111111111111';
const passportId = '22222222-2222-4222-8222-222222222222';
const review: AdminRegistrationReview = {
  id: requestId, type: 'PERSONAL_ADULT', status: 'SUBMITTED', version: 3, versionFresh: true,
  approvalExecutionStatus: 'NONE', createdAt: '2026-10-13T10:00:00.000Z',
  structuredData: { applicants: [], players: [], representatives: [], detail: {} },
  evidence: [{ id: 'synthetic-evidence', category: 'IDENTITY_FRONT', status: 'CLEAN', sizeBytes: 1 }],
  consents: [], duplicateReview: { state: 'CLEAR', canApprove: true },
  capabilities: ['registration.review.confirm-dossier'], history: [],
};

async function submitApproval(screen: Awaited<ReturnType<typeof render>>) {
  await fireEvent.changeText(screen.getByLabelText('Nombre del expediente manual'), 'EXP-009-2026');
  await fireEvent.press(screen.getByRole('checkbox', { name: /confirmo la transferencia manual/i }));
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar expediente y continuar' }));
}

describe('AdminDossierApproval', () => {
  it('confirms a manual dossier and keeps the response waiting for verified deletion', async () => {
    const onApprove = jest.fn();
    const screen = await render(<AdminDossierApproval evidenceCategories={['IDENTITY_FRONT', 'IDENTITY_BACK']} state="ready" onBack={jest.fn()} onApprove={onApprove} onRetryDeletion={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Nombre del expediente manual'), 'EXP-006-2026');
    await fireEvent.press(screen.getByRole('checkbox', { name: /confirmo la transferencia manual/i }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar expediente y continuar' }));
    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ dossierName: 'EXP-006-2026', categories: ['IDENTITY_FRONT', 'IDENTITY_BACK'] }));
    expect(screen.getByText('Eliminación segura de evidencias')).toBeTruthy();
    expect(screen.getByText('Respuesta enviada')).toBeTruthy();
  });

  it('offers an explicit retry only in recovery and describes status without color alone', async () => {
    const onRetryDeletion = jest.fn();
    const screen = await render(<AdminDossierApproval evidenceCategories={['IDENTITY_FRONT']} state="recovery-required" onBack={jest.fn()} onApprove={jest.fn()} onRetryDeletion={onRetryDeletion} />);
    expect(screen.getByText(/requiere recuperación/i)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar eliminación segura' }));
    expect(onRetryDeletion).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Error')).toBeTruthy();
    expect(screen.getByText('Pendiente')).toBeTruthy();
  });

  it('links an approved request to the existing passport custody workspace', async () => {
    const onOpenCustody = jest.fn();
    const screen = await render(<AdminDossierApproval evidenceCategories={['IDENTITY_FRONT']} state="approved" onBack={jest.fn()} onApprove={jest.fn()} onRetryDeletion={jest.fn()} onOpenCustody={onOpenCustody} />);

    await fireEvent.press(screen.getByRole('link', { name: 'Abrir pasaporte en Custodia' }));
    expect(onOpenCustody).toHaveBeenCalledTimes(1);
  });
});

describe('Feature 009 Administrator continuation after final approval', () => {
  beforeEach(() => jest.clearAllMocks());

  it('waits for a final ACTIVE passport result, then opens its exact manual custody detail without assigning', async () => {
    let finish!: (result: unknown) => void;
    const approveAdmin = jest.fn(() => new Promise((resolve) => { finish = resolve; }));
    const readAdmin = jest.fn().mockResolvedValue({ kind: 'success', value: review });
    (createRegistrationRequestApi as jest.Mock).mockReturnValue({ readAdmin, approveAdmin });
    const screen = await render(<AdminApprovalScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar expediente y continuar' })).toBeTruthy());
    await submitApproval(screen);
    expect(approveAdmin).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await act(async () => finish({ kind: 'success', value: { outcome: 'approved', requestStatus: 'APPROVED', passportId, passportState: 'ACTIVE' } }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(`/admin/custody/${passportId}`));
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(approveAdmin).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ outcome: 'recovery-required', requestStatus: 'SUBMITTED', passportId, passportState: 'ACTIVE' }, 'recovery'],
    [{ outcome: 'approved', requestStatus: 'APPROVED', passportState: 'ACTIVE' }, 'without passport'],
    [{ outcome: 'approved', requestStatus: 'APPROVED', passportId, passportState: 'APPROVED' }, 'non-active passport'],
  ] as const)('never navigates for %s (%s)', async (value) => {
    (createRegistrationRequestApi as jest.Mock).mockReturnValue({
      readAdmin: jest.fn().mockResolvedValue({ kind: 'success', value: review }),
      approveAdmin: jest.fn().mockResolvedValue({ kind: 'success', value }),
    });
    const screen = await render(<AdminApprovalScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar expediente y continuar' })).toBeTruthy());
    await submitApproval(screen);
    await waitFor(() => expect(screen.getAllByText(value.outcome === 'recovery-required'
      ? /requiere recuperaci\u00f3n/i : /Respuesta enviada/).length).toBeGreaterThan(0));
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('does not navigate while deletion is pending, then resumes the same intention on final approval', async () => {
    jest.useFakeTimers();
    try {
      const finalReview = { ...review, status: 'APPROVED' as const, approvalExecutionStatus: 'FINALIZED' };
      const readAdmin = jest.fn().mockResolvedValueOnce({ kind: 'success', value: review })
        .mockResolvedValueOnce({ kind: 'success', value: { ...review, approvalExecutionStatus: 'DELETING_EVIDENCE' } })
        .mockResolvedValueOnce({ kind: 'success', value: { ...review, approvalExecutionStatus: 'DELETING_EVIDENCE' } })
        .mockResolvedValue({ kind: 'success', value: finalReview });
      const approveAdmin = jest.fn().mockResolvedValueOnce({ kind: 'success', value: { outcome: 'pending-deletion', requestStatus: 'SUBMITTED', passportId, passportState: 'ACTIVE' } })
        .mockResolvedValueOnce({ kind: 'success', value: { outcome: 'approved', requestStatus: 'APPROVED', passportId, passportState: 'ACTIVE' } });
      (createRegistrationRequestApi as jest.Mock).mockReturnValue({ readAdmin, approveAdmin });
      const screen = await render(<AdminApprovalScreen />);
      await submitApproval(screen);
      expect(mockRouter.replace).not.toHaveBeenCalled();
      await act(async () => { jest.advanceTimersByTime(2000); await Promise.resolve(); });
      expect(mockRouter.replace).not.toHaveBeenCalled();
      await act(async () => { jest.advanceTimersByTime(2000); await Promise.resolve(); });
      expect(mockRouter.replace).toHaveBeenCalledWith(`/admin/custody/${passportId}`);
      expect(approveAdmin).toHaveBeenCalledTimes(2);
      expect(approveAdmin.mock.calls[0]?.[1]).toEqual(approveAdmin.mock.calls[1]?.[1]);
      screen.unmount();
    } finally { jest.useRealTimers(); }
  });
});
