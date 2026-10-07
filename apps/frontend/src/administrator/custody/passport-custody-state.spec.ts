import { PassportCustodyState, approvedRequestCustodyRoute } from './passport-custody-state';
import { buildAnalystSummaryFixture, buildLinkedPassportSummaryFixture, FEATURE_007_FRONTEND_CANARIES, FEATURE_007_TEST_IDS } from '../testing/feature-007-fixtures';

const analyst = buildAnalystSummaryFixture();
const passport = buildLinkedPassportSummaryFixture();
const assignedPassport = {
  ...buildLinkedPassportSummaryFixture({ custodyVersion: 1 }),
  custody: { state: 'ASSIGNED' as const, version: 1, analyst, assignedAt: '2026-09-30T16:00:00.000Z' },
  capabilities: ['CHANGE', 'REMOVE'] as const,
};

function api() {
  return {
    listCustodyPassports: jest.fn()
      .mockResolvedValueOnce({ kind: 'success', value: { items: [passport], nextCursor: 'unassigned-next' } })
      .mockResolvedValueOnce({ kind: 'success', value: { items: [assignedPassport] } })
      .mockResolvedValue({ kind: 'success', value: { items: [assignedPassport] } }),
    listCustodyAnalysts: jest.fn().mockResolvedValue({ kind: 'success', value: { items: [analyst] } }),
    assignPassportCustody: jest.fn().mockResolvedValue({ kind: 'success', value: { data: { passportId: passport.passportId, eventId: 'event-1', custody: assignedPassport.custody }, idempotent: false } }),
  };
}

describe('PassportCustodyState', () => {
  it('loads server-owned unassigned/assigned pages and live Analyst workloads', async () => {
    const backend = api();
    const state = new PassportCustodyState(backend as never);
    await state.load();
    expect(state.snapshot).toMatchObject({ state: 'ready', unassigned: { items: [passport], nextCursor: 'unassigned-next' }, assigned: { items: [assignedPassport] }, analysts: [analyst] });
    expect(backend.listCustodyPassports).toHaveBeenNthCalledWith(1, { assignment: 'UNASSIGNED', limit: 20 });
    expect(backend.listCustodyPassports).toHaveBeenNthCalledWith(2, { assignment: 'ASSIGNED', limit: 20 });
  });

  it('applies search to both passport pages and Analyst lookup', async () => {
    const backend = api();
    const state = new PassportCustodyState(backend as never);
    state.setSearch('Laura');
    await state.load();
    expect(backend.listCustodyPassports).toHaveBeenNthCalledWith(1, { assignment: 'UNASSIGNED', limit: 20, query: 'Laura' });
    expect(backend.listCustodyAnalysts).toHaveBeenCalledWith({ limit: 20, query: 'Laura' });
  });

  it('selects a destination only in memory and never assigns before an explicit confirmed command', async () => {
    const backend = api();
    const state = new PassportCustodyState(backend as never);
    await state.load();
    state.selectDestination(passport.passportId, analyst.identityId);
    expect(state.snapshot.selection).toEqual({ passportId: passport.passportId, analystIdentityId: analyst.identityId });
    expect(backend.assignPassportCustody).not.toHaveBeenCalled();
  });

  it('refreshes authoritative passports and workloads after a confirmed assignment', async () => {
    const backend = api();
    const state = new PassportCustodyState(backend as never);
    await state.load();
    const result = await state.applyConfirmedAssignment({ passportId: passport.passportId, expectedVersion: 0, idempotencyKey: '80000000-0000-4000-8000-000000000001', analystIdentityId: analyst.identityId });
    expect(result).toBe('applied');
    expect(backend.assignPassportCustody).toHaveBeenCalledTimes(1);
    expect(backend.listCustodyPassports).toHaveBeenCalledTimes(4);
    expect(backend.listCustodyAnalysts).toHaveBeenCalledTimes(2);
    expect(state.snapshot.selection).toBeUndefined();
  });

  it('distinguishes no-Analyst empty, restricted, unavailable, and error states', async () => {
    const outcomes = [
      [{ kind: 'success', value: { items: [] } }, 'empty'],
      [{ kind: 'restricted' }, 'restricted'],
      [{ kind: 'connectivity-failure' }, 'unavailable'],
      [{ kind: 'invalid-response' }, 'error'],
    ] as const;
    for (const [analystResult, expected] of outcomes) {
      const backend = api();
      backend.listCustodyAnalysts.mockReset().mockResolvedValue(analystResult as never);
      const state = new PassportCustodyState(backend as never);
      await state.load();
      expect(state.snapshot.state).toBe(expected);
    }
  });

  it('links an approved request to the same passport and keeps protected canaries out of state', async () => {
    expect(approvedRequestCustodyRoute(FEATURE_007_TEST_IDS.passportId)).toBe(`/admin/custody?passportId=${FEATURE_007_TEST_IDS.passportId}`);
    const state = new PassportCustodyState(api() as never);
    await state.load();
    for (const value of Object.values(FEATURE_007_FRONTEND_CANARIES)) expect(JSON.stringify(state.snapshot)).not.toContain(value);
  });
});
