import { createRegistrationRequestApi, parseRegistrationRequestSnapshot } from './registration-request-api';
import { RegistrationRequestStateMachine, type RegistrationRequestApi } from './registration-request-state';
import { RegistrationEvidenceUploadQueue } from './evidence/upload-queue';

const requestId = '22222222-2222-4222-8222-222222222222';
const snapshot = {
  id: requestId,
  type: 'PERSONAL_ADULT' as const,
  status: 'DRAFT' as const,
  version: 3,
  capabilities: ['registration.request.own.view', 'registration.request.own.edit-draft', 'registration.request.own.submit'],
  createdAt: '2026-09-24T12:00:00.000Z',
  evidence: [],
};

function api(overrides: Partial<RegistrationRequestApi> = {}): RegistrationRequestApi {
  return {
    validateIdentity: jest.fn().mockResolvedValue({ kind: 'success', value: { available: true } }),
    create: jest.fn().mockResolvedValue({ kind: 'success', value: snapshot }),
    read: jest.fn().mockResolvedValue({ kind: 'success', value: snapshot }),
    update: jest.fn().mockResolvedValue({ kind: 'success', value: { ...snapshot, version: 4 } }),
    submit: jest.fn().mockResolvedValue({ kind: 'success', value: { ...snapshot, status: 'SUBMITTED', version: 4 } }),
    resubmit: jest.fn().mockResolvedValue({ kind: 'success', value: { ...snapshot, status: 'SUBMITTED', version: 5 } }),
    listAcademy: jest.fn().mockResolvedValue({ kind: 'success', value: { items: [] } }),
    listAdmin: jest.fn().mockResolvedValue({ kind: 'success', value: { items: [] } }),
    readAdmin: jest.fn().mockResolvedValue({ kind: 'denied-or-not-found' }),
    ...overrides,
  };
}

describe('RegistrationRequestStateMachine', () => {
  it('lists an academy through the authenticated scoped endpoint without trusting a client role', async () => {
    const academyId = '33333333-3333-4333-8333-333333333333';
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], pagination: { hasMore: false } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const client = createRegistrationRequestApi({ apiBaseUrl: 'https://api.example.test/api/', getAccessToken: () => 'opaque-test-token' }, fetcher);
    await expect(client.listAcademy(academyId)).resolves.toEqual({ kind: 'success', value: { items: [] } });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(`/academies/${academyId}/registration-requests?limit=20`), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer opaque-test-token' }) }));
  });

  it('sends optimistic updates through the typed API and retains only the safe response projection', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: { ...snapshot, birthDate: '2000-01-01', documentNumber: 'synthetic-private' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const client = createRegistrationRequestApi({ apiBaseUrl: 'https://api.example.test/api/', getAccessToken: () => 'test-token-not-usable' }, fetcher);

    const result = await client.update(requestId, 3, { type: 'PERSONAL_ADULT', details: { actingForSelf: true } });

    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(`/registration-requests/${requestId}`), expect.objectContaining({
      method: 'PATCH',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token-not-usable' }),
      body: JSON.stringify({ expectedVersion: 3, details: { actingForSelf: true } }),
    }));
    expect(result).toEqual({ kind: 'success', value: snapshot });
    expect(parseRegistrationRequestSnapshot({ ...snapshot, roles: ['ADMINISTRATOR'], jwt: 'not-a-token' })).toEqual(snapshot);
  });

  it('restores a typed server snapshot and uses only backend-projected capabilities', async () => {
    const client = api();
    const machine = new RegistrationRequestStateMachine({ api: client });

    await machine.restore(requestId);

    expect(machine.state.phase).toBe('ready');
    expect(machine.state.snapshot).toEqual(snapshot);
    expect(machine.can('registration.request.own.submit')).toBe(true);
    expect(machine.can('ADMINISTRATOR')).toBe(false);
    expect(JSON.stringify(machine.state)).not.toMatch(/jwt|roles?/i);
  });

  it('creates a typed request without retaining credential secrets in route state', async () => {
    const client = api();
    const machine = new RegistrationRequestStateMachine({ api: client });
    const draft = { type: 'PERSONAL_ADULT' as const, details: { credentials: { email: 'pending@example.test', password: 'synthetic-secret', passwordConfirmation: 'synthetic-secret' }, actingForSelf: true } };

    await machine.create(draft);

    expect(client.create).toHaveBeenCalledWith(draft, undefined);
    expect(JSON.stringify(machine.state)).not.toContain('synthetic-secret');
    expect(machine.state.snapshot).toEqual(snapshot);
  });

  it('restores the latest snapshot on a version conflict and exposes a safe stale-action notice', async () => {
    const latest = { ...snapshot, status: 'REQUIRES_CORRECTION' as const, version: 5, safeReason: 'Actualiza la evidencia solicitada.' };
    const client = api({
      update: jest.fn().mockResolvedValue({ kind: 'version-conflict' }),
      read: jest.fn().mockResolvedValue({ kind: 'success', value: latest }),
    });
    const machine = new RegistrationRequestStateMachine({ api: client });
    machine.hydrate(snapshot);
    machine.setDraft({ type: 'PERSONAL_ADULT', details: { actingForSelf: true } });

    await machine.save();

    expect(client.update).toHaveBeenCalledWith(requestId, 3, { type: 'PERSONAL_ADULT', details: { actingForSelf: true } });
    expect(machine.state.snapshot).toEqual(latest);
    expect(machine.state.notice).toBe('version-conflict');
  });

  it('reuses one idempotency key for a retry and rotates it after a successful transition', async () => {
    const submit = jest.fn()
      .mockResolvedValueOnce({ kind: 'connectivity-failure' })
      .mockResolvedValueOnce({ kind: 'success', value: { ...snapshot, status: 'SUBMITTED', version: 4 } });
    const keys = ['11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333'];
    const machine = new RegistrationRequestStateMachine({ api: api({ submit }), createIdempotencyKey: () => keys.shift()! });
    machine.hydrate(snapshot);

    await machine.submit();
    await machine.retry();

    expect(submit).toHaveBeenNthCalledWith(1, requestId, 3, '11111111-1111-4111-8111-111111111111');
    expect(submit).toHaveBeenNthCalledWith(2, requestId, 3, '11111111-1111-4111-8111-111111111111');
    expect(machine.state.phase).toBe('ready');
    expect(machine.state.snapshot?.status).toBe('SUBMITTED');
  });

  it('adopts a backend-confirmed SUBMITTED snapshot after a stale submit response without submitting twice', async () => {
    const queue = new RegistrationEvidenceUploadQueue({ transport: { upload: jest.fn() } });
    const queued = queue.add({ category: 'IDENTITY_FRONT', label: 'Documento', source: { kind: 'web', file: { name: 'synthetic.pdf', type: 'application/pdf', size: 128 } } });
    const submitted = { ...snapshot, status: 'SUBMITTED' as const, version: 4, capabilities: [] };
    const submit = jest.fn().mockResolvedValue({ kind: 'version-conflict' });
    const read = jest.fn().mockResolvedValue({ kind: 'success', value: submitted });
    const machine = new RegistrationRequestStateMachine({ api: api({ submit, read }), evidenceQueue: queue, createIdempotencyKey: () => '11111111-1111-4111-8111-111111111111' });
    machine.hydrate(snapshot);

    await expect(machine.submit()).resolves.toBe(true);

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(requestId, 3, '11111111-1111-4111-8111-111111111111');
    expect(machine.state.snapshot).toEqual(submitted);
    expect(machine.state.notice).toBeUndefined();
    expect(queue.hasEphemeralReference(queued.id)).toBe(false);
  });

  it('retries a genuinely stale draft using the refreshed backend version and the same key', async () => {
    const submit = jest.fn().mockResolvedValueOnce({ kind: 'version-conflict' }).mockResolvedValueOnce({ kind: 'success', value: { ...snapshot, status: 'SUBMITTED', version: 5 } });
    const read = jest.fn().mockResolvedValue({ kind: 'success', value: { ...snapshot, version: 4 } });
    const machine = new RegistrationRequestStateMachine({ api: api({ submit, read }), createIdempotencyKey: () => '11111111-1111-4111-8111-111111111111' });
    machine.hydrate(snapshot);

    await expect(machine.submit()).resolves.toBe(true);

    expect(submit).toHaveBeenNthCalledWith(1, requestId, 3, '11111111-1111-4111-8111-111111111111');
    expect(submit).toHaveBeenNthCalledWith(2, requestId, 4, '11111111-1111-4111-8111-111111111111');
  });

  it('owns the upload queue and clears ephemeral file references after submit', async () => {
    const queue = new RegistrationEvidenceUploadQueue({ transport: { upload: jest.fn() } });
    const queued = queue.add({ category: 'IDENTITY_FRONT', label: 'Documento frontal', source: { kind: 'web', file: { name: 'identidad.pdf', type: 'application/pdf', size: 128 } } });
    const machine = new RegistrationRequestStateMachine({ api: api(), evidenceQueue: queue });
    machine.hydrate(snapshot);

    await machine.submit();

    expect(machine.evidenceQueue).toBe(queue);
    expect(queue.hasEphemeralReference(queued.id)).toBe(false);
  });

  it('retains correction files until resubmit is confirmed as SUBMITTED', async () => {
    const queue = new RegistrationEvidenceUploadQueue({ transport: { upload: jest.fn() } });
    const queued = queue.addReplacement({ category: 'IDENTITY_BACK', label: 'Documento corregido', source: { kind: 'web', file: { name: 'replacement.pdf', type: 'application/pdf', size: 128 } } }, 'REQUIRES_CORRECTION');
    const correction = { ...snapshot, status: 'REQUIRES_CORRECTION' as const, capabilities: ['registration.request.own.view', 'registration.request.own.resubmit'] };
    const resubmit = jest.fn()
      .mockResolvedValueOnce({ kind: 'success', value: correction })
      .mockResolvedValueOnce({ kind: 'success', value: { ...correction, status: 'SUBMITTED', version: 4 } });
    const machine = new RegistrationRequestStateMachine({ api: api({ resubmit }), evidenceQueue: queue, createIdempotencyKey: () => '11111111-1111-4111-8111-111111111111' });
    machine.hydrate(correction);

    await expect(machine.resubmit()).resolves.toBe(false);
    expect(queue.hasEphemeralReference(queued.id)).toBe(true);
    await expect(machine.resubmit()).resolves.toBe(true);
    expect(queue.hasEphemeralReference(queued.id)).toBe(false);
    expect(resubmit).toHaveBeenNthCalledWith(1, requestId, 3, '11111111-1111-4111-8111-111111111111');
    expect(resubmit).toHaveBeenNthCalledWith(2, requestId, 3, '11111111-1111-4111-8111-111111111111');
  });

  it('refreshes authentication capabilities only after an approved backend snapshot', async () => {
    const refreshCapabilities = jest.fn().mockResolvedValue(undefined);
    const approved = { ...snapshot, status: 'APPROVED' as const, version: 4, capabilities: [] };
    const machine = new RegistrationRequestStateMachine({ api: api({ read: jest.fn().mockResolvedValue({ kind: 'success', value: approved }) }), refreshCapabilities });

    await machine.restore(requestId);

    expect(refreshCapabilities).toHaveBeenCalledTimes(1);
  });

  it('clears type-specific draft data when the request type changes or the owner is disposed', () => {
    const machine = new RegistrationRequestStateMachine({ api: api() });
    machine.setDraft({ type: 'PERSONAL_ADULT', details: { person: { legalNames: 'synthetic-canary' } } });
    machine.setDraft({ type: 'FORMAL_ACADEMY', details: { academy: { academyName: 'Academia sintética' } } });
    expect(JSON.stringify(machine.state.draft)).not.toContain('synthetic-canary');

    machine.dispose();
    expect(machine.state.draft).toBeNull();
    expect(machine.state.snapshot).toBeNull();
  });
});
