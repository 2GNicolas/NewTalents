import { createRegistrationRequestApi, parseRegistrationRequestSnapshot, type RegistrationDraft } from './registration-request-api';

const snapshot = { id: '22222222-2222-4222-8222-222222222222', type: 'PERSONAL_ADULT', status: 'DRAFT', version: 0, capabilities: [], createdAt: '2026-09-25T12:00:00.000Z', evidence: [] };

describe('registration request create DTO routing', () => {
  it.each([
    ['registration_conflict', 'registration-conflict'],
    ['registration_request_version_conflict', 'version-conflict'],
    ['unexpected_conflict', 'invalid-response'],
  ] as const)('classifies backend 409 code %s as %s', async (code, kind) => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code } }), { status: 409, headers: { 'Content-Type': 'application/json' } }));
    const api = createRegistrationRequestApi({ apiBaseUrl: 'https://api.example.test/api/' }, fetcher);
    await expect(api.create({ type: 'PERSONAL_ADULT', details: {} }, '44444444-4444-4444-8444-444444444444')).resolves.toEqual({ kind });
  });
  it('classifies an expired pending session separately from an invalid server response', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'authentication_required' } }), { status: 401 }));
    const api = createRegistrationRequestApi({ apiBaseUrl: 'https://api.example.test/api/' }, fetcher);
    await expect(api.read(snapshot.id)).resolves.toEqual({ kind: 'session-expired' });
  });
  it('maps an authorized exact-document conflict from the bounded validation endpoint', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'registration_validation_failed' }, issues: [{ field: 'person.documentNumber', code: 'document_in_use' }] }), { status: 422, headers: { 'Content-Type': 'application/json' } }));
    const api = createRegistrationRequestApi({ apiBaseUrl: 'https://api.example.test/api/' }, fetcher);
    const input = { requestType: 'PERSONAL_ADULT' as const, checks: [{ field: 'person.documentNumber', documentType: 'CC', documentNumber: '1234567' }] };
    await expect(api.validateIdentity(input)).resolves.toEqual({ kind: 'validation-error', issues: [{ field: 'person.documentNumber', code: 'document_in_use' }] });
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/registration-requests/validate-identity', expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }));
  });
  it.each([
    ['PERSONAL_ADULT', '/registration-requests/personal-adult'],
    ['REPRESENTED_MINOR', '/registration-requests/represented-minor'],
    ['FORMAL_ACADEMY', '/registration-requests/academies/formal'],
    ['NATURAL_PERSON_ACADEMY', '/registration-requests/academies/natural-person'],
  ] as const)('sends the closed %s details to its real endpoint', async (type, path) => {
    const details = { marker: type };
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: { ...snapshot, type } }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    const api = createRegistrationRequestApi({ apiBaseUrl: 'https://api.example.test/api/' }, fetcher);
    await api.create({ type, details } as unknown as RegistrationDraft, '44444444-4444-4444-8444-444444444444');
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(path), expect.objectContaining({ method: 'POST', body: JSON.stringify(details), headers: expect.objectContaining({ 'Idempotency-Key': '44444444-4444-4444-8444-444444444444' }) }));
  });

  it('parses only safe correction and deletion projections', () => {
    expect(parseRegistrationRequestSnapshot({
      ...snapshot,
      status: 'REQUIRES_CORRECTION',
      safeReason: 'Carga el documento solicitado.',
      evidence: [{ id: 'evidence', category: 'IDENTITY_BACK', status: 'CLEAN', sizeBytes: 100, correctionRequired: true }],
      deletion: { status: 'IN_PROGRESS', totalItems: 1, completedItems: 0, lastUpdatedAt: '2026-09-25T12:00:00.000Z' },
      duplicateSignals: ['private'], candidateIdentity: 'private', objectKey: 'private',
    })).toEqual(expect.objectContaining({
      status: 'REQUIRES_CORRECTION', safeReason: 'Carga el documento solicitado.',
      evidence: [expect.objectContaining({ category: 'IDENTITY_BACK', correctionRequired: true })],
      deletion: { status: 'IN_PROGRESS', totalItems: 1, completedItems: 0, lastUpdatedAt: '2026-09-25T12:00:00.000Z' },
    }));
  });

  it('uses the authorized Admin decision, approval and request-level deletion recovery endpoints', async () => {
    const fetcher = jest.fn().mockImplementation(async () => new Response(JSON.stringify({ data: { outcome: 'scheduled', requestId: snapshot.id, requestStatus: 'SUBMITTED' } }), { status: 202, headers: { 'Content-Type': 'application/json' } }));
    const api = createRegistrationRequestApi({ apiBaseUrl: 'https://api.example.test/api/', getAccessToken: () => 'opaque-token' }, fetcher);
    await api.requestAdminCorrection?.(snapshot.id, { expectedVersion: 4, idempotencyKey: '44444444-4444-4444-8444-444444444444', safeReason: 'Corrige el documento.', correctionTargets: ['IDENTITY_FRONT'] });
    await api.rejectAdmin?.(snapshot.id, { expectedVersion: 4, idempotencyKey: '55555555-5555-4555-8555-555555555555', safeReason: 'No cumple los requisitos.' });
    await api.approveAdmin?.(snapshot.id, { expectedVersion: 4, idempotencyKey: '66666666-6666-4666-8666-666666666666', manualDossierConfirmation: { confirmed: true, declarationVersion: 'dossier-v1', categories: ['IDENTITY_FRONT'] } });
    await expect(api.retryAdminDeletion?.(snapshot.id, { expectedVersion: 5, idempotencyKey: '77777777-7777-4777-8777-777777777777' })).resolves.toEqual({ kind: 'success', value: { outcome: 'scheduled', requestId: snapshot.id, requestStatus: 'SUBMITTED' } });
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual(expect.arrayContaining([
      expect.stringContaining('/correction'), expect.stringContaining('/reject'), expect.stringContaining('/approve'), expect.stringContaining('/deletion/retry'),
    ]));
    expect(fetcher).toHaveBeenLastCalledWith(expect.stringContaining('/deletion/retry'), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer opaque-token' }) }));
  });
});
