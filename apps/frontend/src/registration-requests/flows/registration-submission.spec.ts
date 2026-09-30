import type { RegistrationRequestApi, RegistrationRequestSnapshot, RegistrationDraft } from '../registration-request-api';
import { RegistrationRequestStateMachine } from '../registration-request-state';
import { RegistrationEvidenceUploadQueue, type EvidenceCategory, type EvidenceUploadTransport } from '../evidence/upload-queue';
import { createFlowOperations } from './registration-flow-route';
import { RegistrationSubmissionCoordinator, REQUIRED_EVIDENCE, validateCompletedRegistrationDraft } from './registration-submission';

const requestId = '22222222-2222-4222-8222-222222222222';
const submitKey = '11111111-1111-4111-8111-111111111111';
const person = { legalNames: 'Persona', legalSurnames: 'Sintética', documentType: 'CC', documentNumber: '123', birthDate: '1990-01-01', country: 'CO', city: '11001' };
const credentials = { email: 'pending@example.test', password: 'synthetic-password', passwordConfirmation: 'synthetic-password' };
const consent = { privacyVersion: '2026-09', privacyAccepted: true as const, truthfulnessAccepted: true as const };
const drafts: readonly RegistrationDraft[] = [
  { type: 'PERSONAL_ADULT', details: { credentials, person, actingForSelf: true, consent } },
  { type: 'REPRESENTED_MINOR', details: { credentials, representative: { ...person, phone: '+57 3000000017' }, minor: { ...person, documentType: 'TI', documentNumber: '1234567890', birthDate: '2014-01-01' }, relationship: 'MOTHER', authorityDeclared: true, consent: { ...consent, representationAccepted: true, minorTreatmentAccepted: true } } },
  { type: 'FORMAL_ACADEMY', details: { credentials, academy: { academyName: 'Academia Sintética', country: 'CO', city: '11001', responsiblePerson: { ...person, phone: '+57 3000000017' } }, organizationType: 'SAS', nit: '901000', authorityDeclared: true, consent } },
  { type: 'NATURAL_PERSON_ACADEMY', details: { credentials, academy: { academyName: 'Academia Sintética', country: 'CO', city: '11001', responsiblePerson: { ...person, phone: '+57 3000000017' } }, operationDeclared: true, proofCategories: ['PLACE_USE_AUTHORIZATION'], consent } },
];
const academyDrafts: readonly RegistrationDraft[] = [
  { type: 'ADDITIONAL_ACADEMY_ACCOUNT', academyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', details: { person, function: 'Coordinación', responsibleAuthorization: true, consent } },
  { type: 'ACADEMY_ADULT_PLAYER', academyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', details: { player: person, adultAuthorization: true, consent: { ...consent, academyPresentationAccepted: true } } },
  { type: 'ACADEMY_MINOR_PLAYER', academyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', details: { minor: { ...person, documentType: 'TI', documentNumber: '1234567890', birthDate: '2014-01-01' }, representative: { ...person, documentNumber: '7654321', phone: '+57 3000000017' }, relationship: 'MOTHER', authorityDeclared: true, consent: { ...consent, representationAccepted: true, minorTreatmentAccepted: true, academyPresentationAccepted: true } } },
];

function harness(draft: RegistrationDraft, uploadResult: 'clean' | 'failed' = 'clean', submitResults?: readonly unknown[]) {
  const uploaded: EvidenceCategory[] = [];
  const snapshot = (status: RegistrationRequestSnapshot['status'], capabilities: readonly string[], evidence = uploaded.map((category, index) => ({ id: `e-${index}`, category, status: 'CLEAN' as const, sizeBytes: 128 }))): RegistrationRequestSnapshot => ({ id: requestId, type: draft.type, status, version: 0, capabilities, createdAt: '2026-09-25T12:00:00.000Z', evidenceComplete: evidence.length > 0, evidence });
  const transitionResults = [...(submitResults ?? [{ kind: 'success', value: snapshot('SUBMITTED', []) }])];
  const api: RegistrationRequestApi = {
    validateIdentity: jest.fn().mockResolvedValue({ kind: 'success', value: { available: true } }),
    create: jest.fn().mockResolvedValue({ kind: 'success', value: snapshot('DRAFT', []) }),
    read: jest.fn().mockImplementation(async () => ({ kind: 'success', value: snapshot('DRAFT', ['registration.request.own.edit-draft', 'registration.request.own.submit']) })),
    update: jest.fn().mockImplementation(async () => ({ kind: 'success', value: snapshot('DRAFT', ['registration.request.own.edit-draft', 'registration.request.own.submit']) })),
    submit: jest.fn().mockImplementation(async () => transitionResults.shift()),
    resubmit: jest.fn(),
    listAcademy: jest.fn(),
    listAdmin: jest.fn(),
    readAdmin: jest.fn(),
  };
  const transport: EvidenceUploadTransport = { upload: jest.fn().mockImplementation(async ({ category }) => {
    if (uploadResult === 'failed') return { kind: 'unavailable-backend' } as const;
    uploaded.push(category);
    return { kind: 'success', evidence: { id: `e-${uploaded.length}`, category, status: 'CLEAN', sizeBytes: 128 } } as const;
  }) };
  const queue = new RegistrationEvidenceUploadQueue({ transport, createIdempotencyKey: () => '33333333-3333-4333-8333-333333333333' });
  for (const category of REQUIRED_EVIDENCE[draft.type]) queue.add({ category, label: category, source: { kind: 'web', file: { name: `${category}.pdf`, type: 'application/pdf', size: 128 } } });
  const machine = new RegistrationRequestStateMachine({ api, evidenceQueue: queue, createIdempotencyKey: () => submitKey });
  const authenticate = jest.fn().mockResolvedValue({ authenticated: true, requestId });
  const refreshCapabilities = jest.fn().mockResolvedValue(undefined);
  const getAccessToken = jest.fn(() => 'synthetic-pending-token');
  return { api, queue, machine, authenticate, refreshCapabilities, getAccessToken, transport, coordinator: new RegistrationSubmissionCoordinator(machine, queue, authenticate, () => '44444444-4444-4444-8444-444444444444', refreshCapabilities, getAccessToken) };
}

describe('real registration submission', () => {
  it.each(drafts)('persists, authenticates, uploads clean evidence and submits $type exactly once', async (draft) => {
    const subject = harness(draft);
    const first = subject.coordinator.submit(draft);
    const second = subject.coordinator.submit(draft);
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(subject.api.create).toHaveBeenCalledTimes(1);
    expect(subject.api.create).toHaveBeenCalledWith(draft, '44444444-4444-4444-8444-444444444444');
    expect(subject.authenticate).toHaveBeenCalledWith({ email: credentials.email, password: credentials.password });
    expect(subject.api.submit).toHaveBeenCalledTimes(1);
    expect(subject.transport.upload).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'synthetic-pending-token' }));
    expect(subject.api.submit).toHaveBeenCalledWith(requestId, 0, submitKey);
    expect(subject.machine.state.snapshot?.status).toBe('SUBMITTED');
    expect(subject.refreshCapabilities).toHaveBeenCalledTimes(1);
    expect(subject.queue.items.every((item) => !subject.queue.hasEphemeralReference(item.id))).toBe(true);
  });

  it('does not create or submit an invalid completed journey', async () => {
    const invalid = { type: 'PERSONAL_ADULT', details: { credentials, actingForSelf: true, consent } } as RegistrationDraft;
    const subject = harness(drafts[0]!);
    expect(validateCompletedRegistrationDraft(invalid)).not.toHaveLength(0);
    await expect(subject.coordinator.submit(invalid)).resolves.toBe(false);
    expect(subject.api.create).not.toHaveBeenCalled();
    expect(subject.api.submit).not.toHaveBeenCalled();
  });

  it('rejects a visibly complete minor consent if its persisted mapping omits minor treatment', async () => {
    const draft = drafts[1]!;
    const invalid = { ...draft, details: { ...draft.details, consent: { ...draft.details.consent, minorTreatmentAccepted: false } } } as RegistrationDraft;
    const subject = harness(draft);
    await expect(subject.coordinator.submit(invalid)).resolves.toBe(false);
    expect(subject.api.create).not.toHaveBeenCalled();
    expect(subject.api.submit).not.toHaveBeenCalled();
  });

  it('keeps incomplete intermediate navigation local without calling public create', async () => {
    const draft = drafts[0]!;
    const subject = harness(draft);
    const operations = createFlowOperations(subject.coordinator, subject.queue, false);
    await operations.onSave(draft);
    expect(subject.machine.state.draft).toBeNull();
    expect(subject.api.create).not.toHaveBeenCalled();
  });

  it('maps an authorized exact-document conflict to the concrete field before advancing', async () => {
    const draft = drafts[0]!;
    const subject = harness(draft);
    (subject.api.validateIdentity as jest.Mock).mockResolvedValueOnce({ kind: 'validation-error', issues: [{ field: 'person.documentNumber', code: 'document_in_use' }] });
    await expect(subject.coordinator.validateStep(draft, ['person.documentNumber'])).resolves.toEqual([
      { field: 'person.documentNumber', code: 'document_in_use', message: 'Ya existe un registro con este documento' },
    ]);
    expect(subject.api.create).not.toHaveBeenCalled();
  });

  it('validates a formal academy NIT independently from the responsible document', async () => {
    const draft = drafts[2]!;
    const subject = harness(draft);
    await expect(subject.coordinator.validateStep(draft, ['nit'])).resolves.toEqual([]);
    expect(subject.api.validateIdentity).toHaveBeenCalledWith(expect.objectContaining({ requestType: 'FORMAL_ACADEMY', checks: [expect.objectContaining({ field: 'nit', nit: '901000' })] }));
  });

  it('identifies an existing academy name before advancing', async () => {
    const draft = drafts[3]!;
    const subject = harness(draft);
    (subject.api.validateIdentity as jest.Mock).mockResolvedValueOnce({ kind: 'validation-error', issues: [{ field: 'academy.academyName', code: 'academy_name_in_use' }] });
    await expect(subject.coordinator.validateStep(draft, ['academy.academyName'])).resolves.toEqual([
      { field: 'academy.academyName', code: 'academy_name_in_use', message: 'Ya existe un registro con este nombre de academia' },
    ]);
    expect(subject.api.validateIdentity).toHaveBeenCalledWith(expect.objectContaining({ checks: [expect.objectContaining({ field: 'academy.academyName', academyName: 'Academia Sintética' })] }));
  });

  it.each([
    [drafts[0]!, ['person.documentNumber']],
    [drafts[1]!, ['representative.documentNumber', 'minor.documentNumber']],
    [drafts[2]!, ['academy.academyName', 'nit', 'academy.responsiblePerson.documentNumber']],
    [drafts[3]!, ['academy.academyName', 'academy.responsiblePerson.documentNumber']],
    [academyDrafts[0]!, ['person.documentNumber']],
    [academyDrafts[1]!, ['player.documentNumber']],
    [academyDrafts[2]!, ['minor.documentNumber', 'representative.documentNumber']],
  ] as const)('sends only the expected exact identifiers for $type', async (draft, fields) => {
    const subject = harness(draft);
    await expect(subject.coordinator.validateStep(draft, fields)).resolves.toEqual([]);
    expect(subject.api.validateIdentity).toHaveBeenCalledWith(expect.objectContaining({ requestType: draft.type, checks: expect.any(Array) }));
    expect((subject.api.validateIdentity as jest.Mock).mock.calls[0][0].checks).toHaveLength(fields.length);
  });

  it('does not submit or clear raw files when evidence upload fails', async () => {
    const draft = drafts[0]!;
    const subject = harness(draft, 'failed');
    const queued = subject.queue.items[0]!;
    await expect(subject.coordinator.submit(draft)).resolves.toBe(false);
    expect(subject.api.submit).not.toHaveBeenCalled();
    expect(subject.queue.hasEphemeralReference(queued.id)).toBe(true);
    expect(subject.coordinator.failure).toMatch(/documentos|servicio/i);
  });

  it('retries a failed minor evidence upload without advancing the consent-bound request version', async () => {
    const draft = drafts[1]!;
    const subject = harness(draft);
    (subject.transport.upload as jest.Mock).mockResolvedValueOnce({ kind: 'unavailable-backend' });
    await expect(subject.coordinator.submit(draft)).resolves.toBe(false);
    await expect(subject.coordinator.submit(draft)).resolves.toBe(true);
    expect(subject.api.create).toHaveBeenCalledTimes(1);
    expect(subject.api.update).not.toHaveBeenCalled();
    expect(subject.api.submit).toHaveBeenCalledTimes(1);
  });

  it('retries an academy draft restore without treating its own persisted identity as a duplicate', async () => {
    const draft = academyDrafts[0]!;
    const subject = harness(draft);
    let successfulReads = 0;
    (subject.api.read as jest.Mock)
      .mockResolvedValueOnce({ kind: 'denied-or-not-found' })
      .mockImplementation(async () => {
        successfulReads += 1;
        return { kind: 'success', value: { id: requestId, type: draft.type, status: 'DRAFT', version: 0, capabilities: ['registration.request.own.edit-draft', 'registration.request.own.submit'], createdAt: '2026-09-25T12:00:00.000Z', evidence: successfulReads > 1 ? REQUIRED_EVIDENCE[draft.type].map((category, index) => ({ id: `retry-e-${index}`, category, status: 'CLEAN', sizeBytes: 128 })) : [] } };
      });
    (subject.api.validateIdentity as jest.Mock)
      .mockResolvedValueOnce({ kind: 'success', value: { available: true } })
      .mockResolvedValue({ kind: 'validation-error', issues: [{ field: 'person.documentNumber', code: 'document_in_use' }] });

    await expect(subject.coordinator.submit(draft)).resolves.toBe(false);
    await expect(subject.coordinator.submit(draft)).resolves.toBe(true);

    expect(subject.api.create).toHaveBeenCalledTimes(1);
    expect(subject.api.validateIdentity).toHaveBeenCalledTimes(1);
    expect(subject.api.submit).toHaveBeenCalledTimes(1);
  });

  it('does not upload without the authenticated pending token', async () => {
    const subject = harness(drafts[0]!);
    subject.getAccessToken.mockReturnValueOnce(null as never);
    await expect(subject.coordinator.submit(drafts[0]!)).resolves.toBe(false);
    expect(subject.transport.upload).not.toHaveBeenCalled();
    expect(subject.api.submit).not.toHaveBeenCalled();
    expect(subject.coordinator.failure).toMatch(/inicia/i);
  });

  it('does not authenticate after a rejected public create and explains the failure', async () => {
    const subject = harness(drafts[0]!);
    (subject.api.create as jest.Mock).mockResolvedValueOnce({ kind: 'validation-error', issues: [{ field: 'person', code: 'invalid' }] });
    await expect(subject.coordinator.submit(drafts[0]!)).resolves.toBe(false);
    expect(subject.authenticate).not.toHaveBeenCalled();
    expect(subject.coordinator.failure).toMatch(/datos|revisa/i);
  });

  it('reports a duplicate public create as a registration conflict, not a stale version', async () => {
    const subject = harness(drafts[1]!);
    (subject.api.create as jest.Mock).mockResolvedValueOnce({ kind: 'registration-conflict' });
    await expect(subject.coordinator.submit(drafts[1]!)).resolves.toBe(false);
    expect(subject.coordinator.failure).toMatch(/registro existente/i);
    expect(subject.coordinator.failure).not.toMatch(/cambi\u00f3 durante/i);
    expect(subject.coordinator.failureStep).toBe('review');
    expect(subject.coordinator.failureField).toBeNull();
    expect(subject.authenticate).not.toHaveBeenCalled();
    expect(subject.api.submit).not.toHaveBeenCalled();
  });

  it('accepts a backend-confirmed SUBMITTED restore without issuing a duplicate submit', async () => {
    const draft = drafts[1]!;
    const subject = harness(draft);
    const draftSnapshot = { id: requestId, type: draft.type, status: 'DRAFT' as const, version: 0, capabilities: ['registration.request.own.edit-draft', 'registration.request.own.submit'], createdAt: '2026-09-25T12:00:00.000Z', evidence: [] };
    const submittedSnapshot = { ...draftSnapshot, status: 'SUBMITTED' as const, version: 1, capabilities: [], evidence: REQUIRED_EVIDENCE[draft.type].map((category, index) => ({ id: `e-${index}`, category, status: 'CLEAN' as const, sizeBytes: 128 })) };
    (subject.api.read as jest.Mock)
      .mockResolvedValueOnce({ kind: 'success', value: draftSnapshot })
      .mockResolvedValueOnce({ kind: 'success', value: submittedSnapshot });

    await expect(subject.coordinator.submit(draft)).resolves.toBe(true);

    expect(subject.api.submit).not.toHaveBeenCalled();
    expect(subject.coordinator.submittedRequestId).toBe(requestId);
    expect(subject.queue.items.every((item) => !subject.queue.hasEphemeralReference(item.id))).toBe(true);
  });

  it('explains a ready minor draft whose HTTP 200 projection still omits submit capability', async () => {
    const draft = drafts[1]!;
    const subject = harness(draft);
    const withoutSubmit = { id: requestId, type: draft.type, status: 'DRAFT' as const, version: 0, capabilities: ['registration.request.own.view', 'registration.request.own.edit-draft'], createdAt: '2026-09-28T17:33:11.944Z', evidence: REQUIRED_EVIDENCE[draft.type].map((category, index) => ({ id: `e-${index}`, category, status: 'CLEAN' as const, sizeBytes: 128 })) };
    (subject.api.read as jest.Mock).mockResolvedValue({ kind: 'success', value: withoutSubmit });

    await expect(subject.coordinator.submit(draft)).resolves.toBe(false);

    expect(subject.api.submit).not.toHaveBeenCalled();
    expect(subject.coordinator.failure).toMatch(/servidor.*envío|envío.*servidor/i);
    expect(subject.coordinator.failure).not.toMatch(/No pudimos completar el envío/i);
    expect(subject.coordinator.failureStep).toBe('consent');
    expect(subject.queue.items.every((item) => subject.queue.hasEphemeralReference(item.id))).toBe(true);
  });

  it('reuses the stable submit key after a retryable failure', async () => {
    const draft = drafts[0]!;
    const submitted = { id: requestId, type: draft.type, status: 'SUBMITTED' as const, version: 1, capabilities: [], createdAt: '2026-09-25T12:00:00.000Z', evidence: [] };
    const subject = harness(draft, 'clean', [{ kind: 'connectivity-failure' }, { kind: 'success', value: submitted }]);
    await expect(subject.coordinator.submit(draft)).resolves.toBe(false);
    await expect(subject.coordinator.submit(draft)).resolves.toBe(true);
    expect(subject.api.submit).toHaveBeenNthCalledWith(1, requestId, 0, submitKey);
    expect(subject.api.submit).toHaveBeenNthCalledWith(2, requestId, 0, submitKey);
  });

  it('recovers a committed create with a lost response through the backend pending-session request id', async () => {
    const draft = drafts[0]!;
    const subject = harness(draft);
    (subject.api.create as jest.Mock).mockResolvedValueOnce({ kind: 'connectivity-failure' });
    await expect(subject.coordinator.submit(draft)).resolves.toBe(true);
    expect(subject.api.create).toHaveBeenCalledTimes(1);
    expect(subject.authenticate).toHaveBeenCalledTimes(1);
    expect(subject.api.read).toHaveBeenCalledWith(requestId);
    expect(subject.api.submit).toHaveBeenCalledTimes(1);
  });

  it('does not synthesize capabilities when pending authentication fails', async () => {
    const draft = drafts[0]!;
    const subject = harness(draft);
    subject.authenticate.mockResolvedValueOnce({ authenticated: false });
    await expect(subject.coordinator.submit(draft)).resolves.toBe(false);
    expect(subject.api.read).not.toHaveBeenCalled();
    expect(subject.api.submit).not.toHaveBeenCalled();
    expect(subject.machine.can('registration.request.own.submit')).toBe(false);
  });

  it('recovers the same created draft after a failed pending login without creating another request', async () => {
    const draft = drafts[0]!;
    const subject = harness(draft);
    subject.authenticate.mockResolvedValueOnce({ authenticated: false });
    await expect(subject.coordinator.submit(draft)).resolves.toBe(false);
    await expect(subject.coordinator.submit(draft)).resolves.toBe(true);
    expect(subject.api.create).toHaveBeenCalledTimes(1);
    expect(subject.authenticate).toHaveBeenCalledTimes(2);
    expect(subject.api.read).toHaveBeenCalledWith(requestId);
    expect(subject.api.submit).toHaveBeenCalledTimes(1);
  });

  it('makes preview operations read-only', async () => {
    const draft = drafts[0]!;
    const subject = harness(draft);
    const operations = createFlowOperations(subject.coordinator, subject.queue, true);
    await operations.onSave(draft);
    await expect(operations.onSubmit(draft)).resolves.toBe(false);
    expect(subject.api.create).not.toHaveBeenCalled();
    expect(subject.api.submit).not.toHaveBeenCalled();
  });
});
