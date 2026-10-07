import { createAdministratorApi, OPERATIONAL_GROUPS, type OperationalRequest } from './administrator-api';
import { buildAnalystSummaryFixture, buildLinkedPassportSummaryFixture, FEATURE_007_TEST_IDS } from './testing/feature-007-fixtures';
import type { RegistrationRequestApi, RegistrationRequestSnapshot } from '../registration-requests/registration-request-api';

const request = (overrides: Partial<OperationalRequest> = {}): OperationalRequest => ({
  requestId: '70000000-0000-4000-8000-000000000003',
  requestVersion: 3,
  maskedReference: 'SOL-••••-0003',
  displayLabel: 'Camila R.',
  requestType: 'PERSONAL_ADULT',
  operationalGroup: 'NEW',
  relevantAt: '2026-09-30T15:00:00.000Z',
  nextAction: 'REVIEW',
  ...overrides,
});

const snapshot: RegistrationRequestSnapshot = {
  id: request().requestId,
  type: 'PERSONAL_ADULT',
  status: 'SUBMITTED',
  version: 3,
  capabilities: ['registration.review.view'],
  createdAt: '2026-09-30T14:00:00.000Z',
  evidence: [],
};

const registrationApi = (): jest.Mocked<RegistrationRequestApi> => ({
  validateIdentity: jest.fn(), create: jest.fn(), read: jest.fn(), update: jest.fn(), submit: jest.fn(), resubmit: jest.fn(), listAcademy: jest.fn(),
  listAdmin: jest.fn().mockResolvedValue({ kind: 'success', value: { items: [snapshot], nextCursor: 'next-page' } }),
  readAdmin: jest.fn(), requestAdminCorrection: jest.fn(), rejectAdmin: jest.fn(), approveAdmin: jest.fn(), retryAdminDeletion: jest.fn(), openAdminEvidence: jest.fn(),
});

describe('AdministratorApi', () => {
  it('parses exactly five operational groups and sends authorized stable filters', async () => {
    const groups = OPERATIONAL_GROUPS.map((group, index) => ({ group, total: 1, items: [request({ operationalGroup: group, nextAction: ['REVIEW', 'CONTINUE', 'VIEW_CORRECTION', 'DECIDE', 'VIEW_DELETION'][index] as OperationalRequest['nextAction'] })] }));
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: { groups } }), { status: 200 }));
    const feature006 = registrationApi();
    const api = createAdministratorApi({ apiBaseUrl: 'https://api.example.test/api/', getAccessToken: () => 'opaque-token' }, fetcher, feature006);

    await expect(api.getRequestOperations({ query: 'Camila', requestType: 'PERSONAL_ADULT' })).resolves.toEqual({ kind: 'success', value: { groups } });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/api/admin/registration-requests/operations?query=Camila&requestType=PERSONAL_ADULT',
      { headers: { Accept: 'application/json', Authorization: 'Bearer opaque-token' } },
    );

    await expect(api.listCompleteRequests({ type: 'PERSONAL_ADULT', status: 'SUBMITTED' }, 'cursor')).resolves.toMatchObject({ kind: 'success' });
    expect(feature006.listAdmin).toHaveBeenCalledWith({ type: 'PERSONAL_ADULT', status: 'SUBMITTED' }, 'cursor');
  });

  it('updates only presentation progress with a closed current-version command', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: request({ operationalGroup: 'CONTINUE_REVIEW', nextAction: 'CONTINUE' }) }), { status: 200 }));
    const api = createAdministratorApi({ apiBaseUrl: 'https://api.example.test/api/' }, fetcher, registrationApi());

    await expect(api.updateReviewProgress(request().requestId, { expectedRequestVersion: 3, stage: 'OPENED' })).resolves.toMatchObject({ kind: 'success', value: { operationalGroup: 'CONTINUE_REVIEW' } });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(`/admin/registration-requests/${request().requestId}/review-progress`), expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ expectedRequestVersion: 3, stage: 'OPENED' }),
    }));
  });

  it.each([
    [401, 'session-expired'], [403, 'restricted'], [404, 'restricted'], [409, 'version-conflict'], [503, 'unavailable'],
  ] as const)('classifies %s without retaining response details', async (status, kind) => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ email: 'private@example.test' }), { status }));
    const api = createAdministratorApi({ apiBaseUrl: 'https://api.example.test/api/' }, fetcher, registrationApi());
    await expect(api.getRequestOperations({})).resolves.toEqual({ kind });
  });

  it('delegates every existing decision operation to Feature 006', () => {
    const feature006 = registrationApi();
    const api = createAdministratorApi({ apiBaseUrl: 'https://api.example.test/api/' }, jest.fn(), feature006);
    expect(api.decisions.requestCorrection).toBe(feature006.requestAdminCorrection);
    expect(api.decisions.reject).toBe(feature006.rejectAdmin);
    expect(api.decisions.approve).toBe(feature006.approveAdmin);
    expect(api.decisions.retryDeletion).toBe(feature006.retryAdminDeletion);
  });

  it('parses custody passport and eligible Analyst pages without retaining protected response fields', async () => {
    const passport = buildLinkedPassportSummaryFixture();
    const analyst = buildAnalystSummaryFixture({ displayLabel: 'Analista de revisi?n 1' });
    const displayedAnalyst = { ...analyst, displayLabel: 'Analista de revisión 1' };
    const fetcher = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [passport], pagination: { hasMore: true, nextCursor: 'passport-next' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [analyst], pagination: { hasMore: true, nextCursor: 'analyst-next' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [passport], pagination: { hasMore: false }, email: 'private@example.test' }), { status: 200 }));
    const api = createAdministratorApi({ apiBaseUrl: 'https://api.example.test/api/', getAccessToken: () => 'token' }, fetcher, registrationApi());

    await expect(api.listCustodyPassports({ assignment: 'UNASSIGNED', query: 'Jugador', limit: 20 })).resolves.toEqual({ kind: 'success', value: { items: [passport], nextCursor: 'passport-next' } });
    await expect(api.listCustodyAnalysts({ query: 'Analista', limit: 20 })).resolves.toEqual({ kind: 'success', value: { items: [displayedAnalyst], nextCursor: 'analyst-next' } });
    expect(fetcher.mock.calls[0]?.[0]).toContain('/admin/passport-custody/passports?assignment=UNASSIGNED&query=Jugador&limit=20');
    expect(fetcher.mock.calls[1]?.[0]).toContain('/admin/passport-custody/analysts?query=Analista&limit=20');
    await expect(api.listCustodyPassports({ assignment: 'ALL', limit: 20 })).resolves.toEqual({ kind: 'invalid-response' });
  });

  it('sends a current-version assignment command and accepts an idempotent current custody response', async () => {
    const body = { expectedVersion: 0, idempotencyKey: '80000000-0000-4000-8000-000000000001', analystIdentityId: FEATURE_007_TEST_IDS.analystIdentityId };
    const response = { data: { passportId: FEATURE_007_TEST_IDS.passportId, eventId: '80000000-0000-4000-8000-000000000002', custody: { state: 'ASSIGNED', version: 1, analystIdentityId: FEATURE_007_TEST_IDS.analystIdentityId, assignedAt: '2026-09-30T16:00:00.000Z' } }, idempotent: true };
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    const api = createAdministratorApi({ apiBaseUrl: 'https://api.example.test/api/' }, fetcher, registrationApi());

    await expect(api.assignPassportCustody(FEATURE_007_TEST_IDS.passportId, body)).resolves.toEqual({ kind: 'success', value: response });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(`/admin/passport-custody/passports/${FEATURE_007_TEST_IDS.passportId}/assign`), expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }));
  });

  it('parses safe custody and idempotency conflicts without retaining response extras', async () => {
    const current = { state: 'ASSIGNED', version: 2, analystIdentityId: FEATURE_007_TEST_IDS.analystIdentityId };
    const fetcher = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'CUSTODY_CONFLICT', message: 'changed', current }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'IDEMPOTENCY_CONFLICT', message: 'different intent', current }), { status: 409 }));
    const api = createAdministratorApi({ apiBaseUrl: 'https://api.example.test/api/' }, fetcher, registrationApi());
    const base = { expectedVersion: 1, idempotencyKey: '80000000-0000-4000-8000-000000000003', reason: 'Cambio seguro' };

    await expect(api.changePassportCustody(FEATURE_007_TEST_IDS.passportId, { ...base, analystIdentityId: FEATURE_007_TEST_IDS.analystIdentityId })).resolves.toEqual({ kind: 'custody-conflict', current });
    await expect(api.removePassportCustody(FEATURE_007_TEST_IDS.passportId, base)).resolves.toEqual({ kind: 'idempotency-conflict', current });
  });

  it('parses privacy-minimal dossier pages/detail and sends stable filters', async () => {
    const summary = { dossierId: '20000000-0000-4000-8000-000000000001', dossierName: 'exp-prueba-001', maskedReference: 'EXP-••••-0001', displayLabel: 'Expediente Valentina P.', status: 'APPROVED', confirmedAt: '2026-09-29T16:42:00.000Z', requestType: 'PERSONAL_ADULT', originRequest: { id: '30000000-0000-4000-8000-000000000001', maskedReference: 'SOL-••••-0001', displayLabel: 'Valentina Pérez', status: 'APPROVED', available: true }, linkedPassport: { notApplicable: true } };
    const detail = { ...summary, confirmationHistory: [{ at: '2026-09-29T16:42:00.000Z', action: 'DOSSIER_CONFIRMED', actorLabel: 'ADMINISTRATOR' }] };
    const fetcher = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [summary], pagination: { hasMore: true, nextCursor: 'next' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: detail }), { status: 200 }));
    const api = createAdministratorApi({ apiBaseUrl: 'https://api.example.test/api/' }, fetcher, registrationApi());
    await expect(api.listDossiers({ query: 'Valentina', status: 'APPROVED', requestType: 'PERSONAL_ADULT', confirmedFrom: '2026-09-01', confirmedTo: '2026-09-30', limit: 20 }, 'cursor')).resolves.toEqual({ kind: 'success', value: { items: [summary], nextCursor: 'next' } });
    await expect(api.getDossierDetail(summary.dossierId)).resolves.toEqual({ kind: 'success', value: detail });
    expect(fetcher.mock.calls[0]?.[0]).toContain('/admin/dossiers?query=Valentina&status=APPROVED&requestType=PERSONAL_ADULT&confirmedFrom=2026-09-01&confirmedTo=2026-09-30&limit=20&cursor=cursor');
  });

  it('parses authorized readable labels on custody detail links', async () => {
    const passport = buildLinkedPassportSummaryFixture();
    const detail = {
      ...passport,
      originRequest: { id: '30000000-0000-4000-8000-000000000001', maskedReference: 'SOL-••••-0001', displayLabel: 'Valentina Pérez', status: 'APPROVED', available: true },
      linkedDossier: { id: '20000000-0000-4000-8000-000000000001', maskedReference: 'EXP-••••-0001', displayLabel: 'Expediente Valentina Pérez', status: 'APPROVED', available: true },
      history: [],
    };
    const api = createAdministratorApi({ apiBaseUrl: 'https://api.example.test/api/' }, jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: detail }), { status: 200 })), registrationApi());

    await expect(api.getCustodyPassportDetail(passport.passportId)).resolves.toEqual({ kind: 'success', value: detail });
  });
});
