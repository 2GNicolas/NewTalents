import { AllowanceUpdateState } from './allowance-update-state';

const passportId = '10000000-0000-4000-8000-000000000001';
const current = { colombiaToday: '2026-10-09', configuration: { version: 1, activatedOn: '2026-10-09', currentRule: { cadence: 'MONTHLY', matchLimit: 4, effectiveOn: '2026-10-09' }, currentPeriod: { start: '2026-10-09', endExclusive: '2026-11-09' }, pendingRule: null, lastModifiedAt: '2026-10-09T15:00:00Z' } };
function setup() {
  const api = { confirmMatchAllowance: jest.fn().mockResolvedValue({ kind: 'success', value: current }), getMatchAllowance: jest.fn().mockResolvedValue({ kind: 'success', value: current }), listMatchAllowanceHistory: jest.fn().mockResolvedValue({ kind: 'success', value: { items: [], nextCursor: null } }) };
  return { api, state: new AllowanceUpdateState(api as never, passportId, current as never) };
}

describe('allowance update confirmation state', () => {
  it('keeps changes local until explicit confirmation and preserves current rule during pending change', async () => {
    const { api, state } = setup();
    expect(state.begin('QUARTERLY', '6')).toBe(true);
    expect(api.confirmMatchAllowance).not.toHaveBeenCalled();
    expect(state.snapshot.proposal).toMatchObject({ previous: { cadence: 'MONTHLY', matchLimit: 4 }, next: { cadence: 'QUARTERLY', matchLimit: 6 }, effectiveOn: '2026-11-09' });
    await state.confirm();
    expect(api.confirmMatchAllowance).toHaveBeenCalledWith(passportId, expect.objectContaining({ expectedVersion: 1, cadence: 'QUARTERLY', matchLimit: 6 }));
    expect(state.snapshot.current.configuration?.currentRule.matchLimit).toBe(4);
  });

  it('discards without mutation and retries connectivity with the same key', async () => {
    const { api, state } = setup();
    state.begin('MONTHLY', '5'); state.discard();
    expect(api.confirmMatchAllowance).not.toHaveBeenCalled();
    state.begin('MONTHLY', '5');
    api.confirmMatchAllowance.mockResolvedValueOnce({ kind: 'connectivity-failure' });
    await state.confirm();
    expect(state.snapshot.stage).toBe('recoverable');
    const key = api.confirmMatchAllowance.mock.calls[0]?.[1].idempotencyKey;
    await state.retry();
    expect(api.confirmMatchAllowance.mock.calls[1]?.[1].idempotencyKey).toBe(key);
  });

  it('refreshes after stale conflict and requires a new intention and explicit confirmation', async () => {
    const { api, state } = setup();
    const latest = { ...current, configuration: { ...current.configuration, version: 2, pendingRule: { cadence: 'MONTHLY', matchLimit: 5, effectiveOn: '2026-11-09' } } };
    api.confirmMatchAllowance.mockResolvedValueOnce({ kind: 'allowance-conflict', current: latest });
    api.getMatchAllowance.mockResolvedValueOnce({ kind: 'success', value: latest });
    state.begin('QUARTERLY', '6'); await state.confirm();
    expect(state.snapshot.stage).toBe('conflict');
    expect(state.snapshot.proposal).toBeNull();
    expect(state.snapshot.current.configuration?.version).toBe(2);
    await state.confirm(); expect(api.confirmMatchAllowance).toHaveBeenCalledTimes(1);
    state.begin('QUARTERLY', '6'); await state.confirm();
    expect(api.confirmMatchAllowance.mock.calls[1]?.[1].expectedVersion).toBe(2);
    expect(api.confirmMatchAllowance.mock.calls[1]?.[1].idempotencyKey).not.toBe(api.confirmMatchAllowance.mock.calls[0]?.[1].idempotencyKey);
  });

  it('does not allow a new confirmation when the conflict refresh fails', async () => {
    const { api, state } = setup();
    api.confirmMatchAllowance.mockResolvedValueOnce({ kind: 'allowance-conflict' });
    api.getMatchAllowance.mockResolvedValueOnce({ kind: 'connectivity-failure' });
    state.begin('MONTHLY', '5'); await state.confirm();
    expect(state.begin('MONTHLY', '6')).toBe(false);
    await state.confirm();
    expect(api.confirmMatchAllowance).toHaveBeenCalledTimes(1);
  });

  it('loads only safe paginated history and clears it on disposal', async () => {
    const { api, state } = setup();
    await state.loadHistory(); expect(api.listMatchAllowanceHistory).toHaveBeenCalledWith(passportId, 20);
    state.dispose(); expect(state.snapshot.history).toEqual([]);
  });
});
