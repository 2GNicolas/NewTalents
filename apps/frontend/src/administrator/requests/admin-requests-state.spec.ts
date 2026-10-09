import { OPERATIONAL_GROUPS, type OperationalGroupView, type OperationalRequest } from '../administrator-api';
import { AdminRequestsState } from './admin-requests-state';
import type { RegistrationRequestSnapshot } from '../../registration-requests/registration-request-api';

const card = (id: string, group: OperationalRequest['operationalGroup'] = 'NEW'): OperationalRequest => ({
  requestId: id, requestVersion: 3, maskedReference: `SOL-••••-${id}`, displayLabel: `Solicitud ${id}`, requestType: 'PERSONAL_ADULT', operationalGroup: group,
  relevantAt: '2026-09-30T15:00:00.000Z', nextAction: group === 'NEW' ? 'REVIEW' : group === 'CONTINUE_REVIEW' ? 'CONTINUE' : group === 'REQUIRES_CORRECTION' ? 'VIEW_CORRECTION' : group === 'READY_FOR_DECISION' ? 'DECIDE' : 'VIEW_DELETION',
});
const groups = (...items: OperationalRequest[]): readonly OperationalGroupView[] => OPERATIONAL_GROUPS.map((group) => ({ group, items: items.filter((item) => item.operationalGroup === group), total: items.filter((item) => item.operationalGroup === group).length }));
const row = (id: string): RegistrationRequestSnapshot => ({ id, type: 'PERSONAL_ADULT', status: 'SUBMITTED', version: 1, capabilities: [], createdAt: '2026-09-30T15:00:00.000Z', evidence: [] });

describe('AdminRequestsState', () => {
  it('loads all five groups and applies search/type filters', async () => {
    const getRequestOperations = jest.fn().mockResolvedValue({ kind: 'success', value: { groups: groups(card('1'), card('2', 'CONTINUE_REVIEW')) } });
    const state = new AdminRequestsState({ getRequestOperations, listCompleteRequests: jest.fn(), updateReviewProgress: jest.fn() });
    state.setFilters({ query: 'Camila', requestType: 'PERSONAL_ADULT' });
    const promise = state.loadOperations();
    expect(state.snapshot.state).toBe('loading');
    await promise;
    expect(getRequestOperations).toHaveBeenCalledWith({ query: 'Camila', requestType: 'PERSONAL_ADULT' });
    expect(state.snapshot.groups.map(({ group }) => group)).toEqual(OPERATIONAL_GROUPS);
    expect(state.snapshot.state).toBe('ready');
  });

  it('keeps the selected workflow while type-filtered backend totals replace the visible projection', async () => {
    const formalCorrection = { ...card('formal', 'REQUIRES_CORRECTION'), requestType: 'FORMAL_ACADEMY' as const };
    const getRequestOperations = jest.fn()
      .mockResolvedValueOnce({ kind: 'success', value: { groups: groups(card('new'), formalCorrection) } })
      .mockResolvedValueOnce({ kind: 'success', value: { groups: groups(formalCorrection) } });
    const state = new AdminRequestsState({ getRequestOperations, listCompleteRequests: jest.fn(), updateReviewProgress: jest.fn() } as never);
    state.setOperationalGroup('REQUIRES_CORRECTION');
    await state.loadOperations();
    state.setFilters({ requestType: 'FORMAL_ACADEMY' });
    await state.loadOperations();
    expect(state.snapshot.selectedGroup).toBe('REQUIRES_CORRECTION');
    expect(state.snapshot.groups.find(({ group }) => group === 'NEW')?.total).toBe(0);
    expect(state.snapshot.groups.find(({ group }) => group === 'REQUIRES_CORRECTION')?.items).toEqual([formalCorrection]);
    expect(getRequestOperations).toHaveBeenLastCalledWith({ requestType: 'FORMAL_ACADEMY' });
  });

  it('retains cursor pages and scroll position in the complete list', async () => {
    const listCompleteRequests = jest.fn()
      .mockResolvedValueOnce({ kind: 'success', value: { items: [row('one')], nextCursor: 'page-2' } })
      .mockResolvedValueOnce({ kind: 'success', value: { items: [row('two')] } });
    const state = new AdminRequestsState({ getRequestOperations: jest.fn(), listCompleteRequests, updateReviewProgress: jest.fn() });
    await state.loadCompleteList();
    state.rememberCompleteListScroll(420);
    await state.loadNextCompleteListPage();
    expect(listCompleteRequests).toHaveBeenLastCalledWith({}, 'page-2');
    expect(state.snapshot.completeList.rows.map(({ id }) => id)).toEqual(['one', 'two']);
    expect(state.snapshot.completeList.scrollOffset).toBe(420);
  });

  it('invalidates a decided row from groups and the complete list', async () => {
    const state = new AdminRequestsState({
      getRequestOperations: jest.fn().mockResolvedValue({ kind: 'success', value: { groups: groups(card('one')) } }),
      listCompleteRequests: jest.fn().mockResolvedValue({ kind: 'success', value: { items: [row('one'), row('two')] } }),
      updateReviewProgress: jest.fn(),
    });
    await state.loadOperations(); await state.loadCompleteList();
    state.invalidate('one');
    expect(state.snapshot.groups.flatMap(({ items }) => items)).toHaveLength(0);
    expect(state.snapshot.completeList.rows.map(({ id }) => id)).toEqual(['two']);
  });

  it.each([
    [{ kind: 'success', value: { groups: groups() } }, 'empty'],
    [{ kind: 'restricted' }, 'restricted'],
    [{ kind: 'unavailable' }, 'unavailable'],
    [{ kind: 'connectivity-failure' }, 'unavailable'],
    [{ kind: 'invalid-response' }, 'error'],
  ] as const)('maps operational results to %s', async (result, expected) => {
    const state = new AdminRequestsState({ getRequestOperations: jest.fn().mockResolvedValue(result), listCompleteRequests: jest.fn(), updateReviewProgress: jest.fn() });
    await state.loadOperations();
    expect(state.snapshot.state).toBe(expected);
  });
});
