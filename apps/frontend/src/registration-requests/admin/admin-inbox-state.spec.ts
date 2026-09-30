import { createRegistrationRequestApi, REGISTRATION_REQUEST_TYPES, type RegistrationRequestSnapshot } from '../registration-request-api';
import { AdminInboxState } from './admin-inbox-state';

const row = (id: string, type: RegistrationRequestSnapshot['type'] = 'PERSONAL_ADULT'): RegistrationRequestSnapshot => ({ id, type, status: 'SUBMITTED', version: 1, capabilities: ['registration.review.view'], createdAt: '2026-09-28T12:00:00.000Z', evidence: [], evidenceComplete: true });

describe('AdminInboxState', () => {
  it('loads all seven types with exact type/status filters and no bulk-decision API', async () => {
    const listAdmin = jest.fn().mockResolvedValue({ kind: 'success', value: { items: REGISTRATION_REQUEST_TYPES.map((type, index) => row(String(index), type)), nextCursor: 'next' } });
    const state = new AdminInboxState({ listAdmin });
    state.setFilters({ type: 'PERSONAL_ADULT', status: 'SUBMITTED' });
    await state.load();
    expect(listAdmin).toHaveBeenCalledWith({ type: 'PERSONAL_ADULT', status: 'SUBMITTED' }, undefined);
    expect(state.snapshot.rows.map(({ type }) => type)).toEqual(REGISTRATION_REQUEST_TYPES);
    expect(state).not.toHaveProperty('approveSelected');
  });

  it('merges cursor pages without clearing existing rows and invalidates a decided row', async () => {
    const listAdmin = jest.fn()
      .mockResolvedValueOnce({ kind: 'success', value: { items: [row('one')], nextCursor: 'page-2' } })
      .mockResolvedValueOnce({ kind: 'success', value: { items: [row('two', 'REPRESENTED_MINOR')] } });
    const state = new AdminInboxState({ listAdmin });
    await state.load();
    state.rememberScroll(420);
    await state.loadNext();
    expect(listAdmin).toHaveBeenLastCalledWith({}, 'page-2');
    expect(state.snapshot.rows.map(({ id }) => id)).toEqual(['one', 'two']);
    expect(state.snapshot.scrollOffset).toBe(420);
    state.invalidate('one');
    expect(state.snapshot.rows.map(({ id }) => id)).toEqual(['two']);
  });

  it.each([
    [{ kind: 'success', value: { items: [] } }, 'empty'],
    [{ kind: 'unavailable-backend' }, 'unavailable'],
    [{ kind: 'connectivity-failure' }, 'unavailable'],
    [{ kind: 'invalid-response' }, 'error'],
    [{ kind: 'denied-or-not-found' }, 'error'],
  ] as const)('projects the page result as %s', async (result, expected) => {
    const state = new AdminInboxState({ listAdmin: jest.fn().mockResolvedValue(result) });
    const promise = state.load();
    expect(state.snapshot.state).toBe('loading');
    await promise;
    expect(state.snapshot.state).toBe(expected);
  });

  it('calls the authenticated Admin endpoint with stable filters and cursor', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: [row('one')], pagination: { hasMore: false } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const api = createRegistrationRequestApi({ apiBaseUrl: 'https://api.example.test/api/', getAccessToken: () => 'token' }, fetcher);
    await api.listAdmin({ type: 'ACADEMY_MINOR_PLAYER', status: 'SUBMITTED' }, 'cursor');
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/admin/registration-requests?limit=20&type=ACADEMY_MINOR_PLAYER&status=SUBMITTED&cursor=cursor'), { headers: { Accept: 'application/json', Authorization: 'Bearer token' } });
  });
});
