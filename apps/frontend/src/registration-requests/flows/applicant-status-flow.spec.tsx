import { createElement } from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { RegistrationRequestSnapshot, RegistrationRequestState } from '../registration-request-state';
import type { RegistrationEvidenceUploadQueue } from '../evidence/upload-queue';
import { ApplicantCorrectionCoordinator, ApplicantStatusFlow, getApplicantStatusPageStyle } from './applicant-status-flow';

const requestId = '22222222-2222-4222-8222-222222222222';
const submitted = (overrides: Partial<RegistrationRequestSnapshot> = {}): RegistrationRequestSnapshot => ({
  id: requestId,
  type: 'PERSONAL_ADULT',
  status: 'SUBMITTED',
  version: 2,
  capabilities: ['registration.request.own.view'],
  createdAt: '2026-09-23T12:00:00.000Z',
  submittedAt: '2026-09-23T12:05:00.000Z',
  evidence: [],
  ...overrides,
});

const ready = (snapshot: RegistrationRequestSnapshot): RegistrationRequestState => ({ phase: 'ready', snapshot, draft: null, validationIssues: [] });

function correctionSnapshot(): RegistrationRequestSnapshot {
  return submitted({
    status: 'REQUIRES_CORRECTION',
    version: 3,
    correctionRequired: true,
    safeReason: 'El reverso no permite verificar la información con claridad.',
    capabilities: ['registration.request.own.view', 'registration.request.own.upload-evidence', 'registration.request.own.resubmit'],
    evidence: [
      { id: 'evidence-front', category: 'IDENTITY_FRONT', status: 'CLEAN', sizeBytes: 100, correctionRequired: false },
      { id: 'evidence-back', category: 'IDENTITY_BACK', status: 'CLEAN', sizeBytes: 100, correctionRequired: true },
    ],
  });
}

describe('ApplicantStatusFlow', () => {
  it('keeps the desktop status chrome within the viewport so logout remains visible', () => {
    expect(getApplicantStatusPageStyle('web', 940)).toEqual(expect.objectContaining({ minHeight: 'calc(100dvh - 60px)' }));
  });

  it('renders submitted requests as immutable applicant-safe status', async () => {
    const logout = jest.fn(); const back = jest.fn();
    const screen = await render(createElement(ApplicantStatusFlow, {
      state: ready(submitted()),
      uploadQueue: {} as RegistrationEvidenceUploadQueue,
      onRetryRestore: jest.fn(),
      onResubmit: jest.fn(),
      onRefreshCapabilities: jest.fn(),
      onLogout: logout,
      onReturnToEntry: back,
    }));

    expect(screen.getByText('Solicitud enviada')).toBeTruthy();
    expect(screen.getByText('Hemos recibido tu solicitud, en breve el equipo de New Talents la revisará.')).toBeTruthy();
    expect(screen.queryByText('Línea de tiempo')).toBeNull();
    expect(screen.queryByLabelText('Línea de tiempo de la solicitud')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Corregir solicitud' })).toBeNull();
    expect(screen.queryByText(/duplicad|candidato|malware|object|storage|auditor/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Volver al inicio' })).toBeNull();
    expect(screen.getAllByText('Cerrar sesión')).toHaveLength(1);
    fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('announces only the safe reason and explicitly correctable evidence', async () => {
    const screen = await render(createElement(ApplicantStatusFlow, {
      state: ready(correctionSnapshot()),
      uploadQueue: { items: [], subscribe: jest.fn(() => jest.fn()) } as unknown as RegistrationEvidenceUploadQueue,
      onRetryRestore: jest.fn(),
      onResubmit: jest.fn(),
      onRefreshCapabilities: jest.fn(),
    }));

    expect(screen.getByText('Requiere corrección')).toBeTruthy();
    expect(screen.getByText('El reverso no permite verificar la información con claridad.')).toBeTruthy();
    expect(screen.getByText('Documento de identidad — reverso')).toBeTruthy();
    expect(screen.queryByText('Documento de identidad — frente')).toBeNull();
    expect(screen.getAllByText('Requiere corrección').some((node) => node.props.accessibilityLiveRegion === 'assertive')).toBe(true);
  });

  it('keeps development preview rendering read-only and mutation-free', async () => {
    const resubmit = jest.fn();
    const screen = await render(createElement(ApplicantStatusFlow, {
      state: ready(correctionSnapshot()),
      uploadQueue: { items: [], subscribe: jest.fn(() => jest.fn()) } as unknown as RegistrationEvidenceUploadQueue,
      onRetryRestore: jest.fn(), onResubmit: resubmit, onRefreshCapabilities: jest.fn(), readOnly: true,
    }));
    const action = screen.getByText('Corregir solicitud').parent!;
    expect(action.props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(action);
    expect(resubmit).not.toHaveBeenCalled();
  });

  it('covers loading, denied and retryable service failure without inventing state', async () => {
    const base = { uploadQueue: {} as RegistrationEvidenceUploadQueue, onRetryRestore: jest.fn(), onResubmit: jest.fn(), onRefreshCapabilities: jest.fn() };
    const loading = await render(createElement(ApplicantStatusFlow, { ...base, state: { phase: 'loading', snapshot: null, draft: null, validationIssues: [] } }));
    expect(loading.getByText('Cargando estado de la solicitud…')).toBeTruthy();
    await loading.unmount();

    const denied = await render(createElement(ApplicantStatusFlow, { ...base, state: { phase: 'failed', snapshot: null, draft: null, notice: 'denied-or-not-found', validationIssues: [] } }));
    expect(denied.getByText('No pudimos mostrar esta solicitud.')).toBeTruthy();
    await denied.unmount();

    const unavailable = await render(createElement(ApplicantStatusFlow, { ...base, state: { phase: 'failed', snapshot: null, draft: null, notice: 'connectivity-failure', validationIssues: [] } }));
    fireEvent.press(unavailable.getByRole('button', { name: 'Reintentar' }));
    expect(base.onRetryRestore).toHaveBeenCalledTimes(1);
  });

  it('refreshes backend capabilities for approval and exposes safe retry on refresh failure', async () => {
    const refresh = jest.fn(async () => undefined);
    const screen = await render(createElement(ApplicantStatusFlow, {
      state: ready(submitted({ status: 'APPROVED', version: 7 })),
      uploadQueue: {} as RegistrationEvidenceUploadQueue,
      authenticationNotice: 'connectivity-failure',
      onRetryRestore: jest.fn(),
      onResubmit: jest.fn(),
      onRefreshCapabilities: refresh,
    }));
    expect(screen.getAllByText('Solicitud aprobada').length).toBeGreaterThan(0);
    fireEvent.press(screen.getByRole('button', { name: 'Actualizar acceso' }));
    expect(refresh).toHaveBeenCalled();
  });
});

describe('ApplicantCorrectionCoordinator', () => {
  function subject(uploadResult = true, resubmitResult = true) {
    const snapshot = correctionSnapshot();
    const machine = {
      state: ready(snapshot),
      can: jest.fn((capability: string) => snapshot.capabilities.includes(capability)),
      restore: jest.fn(async () => true),
      resubmit: jest.fn(async () => resubmitResult),
      retry: jest.fn(async () => resubmitResult),
      setClientValidationIssues: jest.fn(),
    };
    const queue = {
      items: [{ id: 'replacement', category: 'IDENTITY_BACK', safeLabel: 'Documento corregido', status: 'selected', progress: 0, correctionReplacement: true }],
      uploadRequired: jest.fn(async () => uploadResult),
      clearEphemeralReferences: jest.fn(),
    };
    return { coordinator: new ApplicantCorrectionCoordinator(machine as never, queue as never, () => 'pending-access-token'), machine, queue };
  }

  it('uploads the permitted replacement before one single-flight resubmission', async () => {
    const test = subject();
    const first = test.coordinator.resubmit();
    const second = test.coordinator.resubmit();
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(test.queue.uploadRequired).toHaveBeenCalledWith(['IDENTITY_BACK'], expect.objectContaining({ requestId, expectedVersion: 3, accessToken: 'pending-access-token' }));
    expect(test.machine.restore).toHaveBeenCalledWith(requestId);
    expect(test.machine.resubmit).toHaveBeenCalledTimes(1);
  });

  it('does not resubmit or clear recovery files when replacement upload fails', async () => {
    const test = subject(false);
    await expect(test.coordinator.resubmit()).resolves.toBe(false);
    expect(test.machine.resubmit).not.toHaveBeenCalled();
    expect(test.queue.clearEphemeralReferences).not.toHaveBeenCalled();
    test.queue.items[0].status = 'failed';
    expect(test.coordinator.safeFailureMessage()).toMatch(/PDF, JPEG o PNG/);
    expect(test.queue.items).toHaveLength(1);
  });

  it('does not resubmit when the backend does not grant correction capabilities', async () => {
    const test = subject();
    test.machine.can.mockReturnValue(false);
    await expect(test.coordinator.resubmit()).resolves.toBe(false);
    expect(test.queue.uploadRequired).not.toHaveBeenCalled();
    expect(test.machine.resubmit).not.toHaveBeenCalled();
    expect(test.coordinator.safeFailureMessage()).toMatch(/problema temporal/i);
  });

  it('does not upload or resubmit without the authenticated pending access token', async () => {
    const test = subject();
    const coordinator = new ApplicantCorrectionCoordinator(test.machine as never, test.queue as never);
    await expect(coordinator.resubmit()).resolves.toBe(false);
    expect(test.queue.uploadRequired).not.toHaveBeenCalled();
    expect(test.machine.resubmit).not.toHaveBeenCalled();
  });

  it('repeats a failed snapshot refresh instead of reporting a false resubmission success', async () => {
    const test = subject();
    test.machine.restore.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    test.machine.state.notice = 'connectivity-failure';

    await expect(test.coordinator.resubmit()).resolves.toBe(false);
    await expect(test.coordinator.resubmit()).resolves.toBe(true);

    expect(test.machine.restore).toHaveBeenCalledTimes(2);
    expect(test.machine.resubmit).toHaveBeenCalledTimes(1);
    expect(test.machine.retry).not.toHaveBeenCalled();
  });

  it('retries a failed resubmission through the state machine stable idempotency operation', async () => {
    const test = subject(true, false);
    test.machine.resubmit.mockImplementationOnce(async () => {
      test.machine.state.notice = 'connectivity-failure';
      return false;
    });
    test.machine.retry.mockResolvedValueOnce(true);

    await expect(test.coordinator.resubmit()).resolves.toBe(false);
    await expect(test.coordinator.resubmit()).resolves.toBe(true);

    expect(test.queue.uploadRequired).toHaveBeenCalledTimes(1);
    expect(test.machine.restore).toHaveBeenCalledTimes(1);
    expect(test.machine.resubmit).toHaveBeenCalledTimes(1);
    expect(test.machine.retry).toHaveBeenCalledTimes(1);
  });
});
