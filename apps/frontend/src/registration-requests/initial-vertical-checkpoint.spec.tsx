import { resolveRootRouteAction } from '../authentication/authenticated-route-policy';
import type { SessionAccessProjection } from '../authentication/authentication-types';
import { RegistrationEvidenceUploadQueue } from './evidence/upload-queue';
import { ApplicantCorrectionCoordinator } from './flows/applicant-status-flow';
import type { RegistrationRequestApi, RegistrationRequestSnapshot } from './registration-request-api';
import { RegistrationRequestStateMachine } from './registration-request-state';

const requestId = '22222222-2222-4222-8222-222222222222';
const pending: SessionAccessProjection = {
  classification: 'pending-onboarding', requestId,
  capabilities: ['registration.request.own.view'],
};

const correction: RegistrationRequestSnapshot = {
  id: requestId, type: 'PERSONAL_ADULT', status: 'REQUIRES_CORRECTION', version: 2,
  capabilities: ['registration.request.own.view', 'registration.request.own.upload-evidence', 'registration.request.own.resubmit'],
  createdAt: '2026-09-26T12:00:00.000Z', correctionRequired: true, safeReason: 'Actualiza solamente el reverso solicitado.',
  evidence: [{ id: 'evidence-back', category: 'IDENTITY_BACK', status: 'CLEAN', sizeBytes: 128, correctionRequired: true }],
};

describe('T092 initial vertical frontend checkpoint', () => {
  it('restores a pending session only to its backend-projected own status and denies ordinary product routes', () => {
    expect(resolveRootRouteAction('authenticated', '/', pending)).toEqual({ type: 'replace', href: `/(pending)/registration/${requestId}` });
    expect(resolveRootRouteAction('authenticated', `/registration/${requestId}`, pending)).toEqual({ type: 'none' });
    expect(resolveRootRouteAction('authenticated', '/registration/99999999-9999-4999-8999-999999999999', pending)).toEqual({ type: 'replace', href: `/(pending)/registration/${requestId}` });
    for (const route of ['/passports', '/academy', '/analysis', '/admin']) {
      expect(resolveRootRouteAction('authenticated', route, pending)).toEqual({ type: 'replace', href: `/(pending)/registration/${requestId}` });
    }
    expect(JSON.stringify(pending)).not.toMatch(/jwt|roles?/i);
  });

  it('restores the safe correction snapshot, uploads the permitted replacement and resubmits once', async () => {
    const submitted = { ...correction, status: 'SUBMITTED' as const, version: 3, correctionRequired: false, safeReason: undefined };
    const api: RegistrationRequestApi = {
      validateIdentity: jest.fn().mockResolvedValue({ kind: 'success', value: { available: true } }),
      create: jest.fn(), update: jest.fn(), submit: jest.fn(),
      read: jest.fn().mockResolvedValueOnce({ kind: 'success', value: correction }).mockResolvedValueOnce({ kind: 'success', value: correction }),
      resubmit: jest.fn().mockResolvedValue({ kind: 'success', value: submitted }),
    };
    const upload = jest.fn().mockResolvedValue({ kind: 'success', evidence: { id: 'replacement', category: 'IDENTITY_BACK', status: 'CLEAN', sizeBytes: 144 } });
    const queue = new RegistrationEvidenceUploadQueue({ transport: { upload }, createIdempotencyKey: () => '33333333-3333-4333-8333-333333333333' });
    queue.addReplacement({ category: 'IDENTITY_BACK', label: 'Reverso solicitado', source: { kind: 'web', file: { name: 'synthetic.pdf', type: 'application/pdf', size: 144 } } }, 'REQUIRES_CORRECTION');
    const machine = new RegistrationRequestStateMachine({ api, evidenceQueue: queue, createIdempotencyKey: () => '44444444-4444-4444-8444-444444444444' });
    await expect(machine.restore(requestId)).resolves.toBe(true);
    const coordinator = new ApplicantCorrectionCoordinator(machine, queue, () => 'pending-token');

    const first = coordinator.resubmit();
    const duplicateClick = coordinator.resubmit();
    await expect(Promise.all([first, duplicateClick])).resolves.toEqual([true, true]);

    expect(upload).toHaveBeenCalledTimes(1);
    expect(api.resubmit).toHaveBeenCalledTimes(1);
    expect(api.resubmit).toHaveBeenCalledWith(requestId, 2, '44444444-4444-4444-8444-444444444444');
    expect(machine.state.snapshot).toEqual(submitted);
    expect(queue.items.every((item) => !queue.hasEphemeralReference(item.id))).toBe(true);
  });
});
