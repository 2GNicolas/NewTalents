import { buildAnalystSummaryFixture, buildLinkedPassportSummaryFixture } from '../testing/feature-007-fixtures';
import { CustodyConfirmationState } from './custody-confirmation-state';
import { PassportCustodyState } from './passport-custody-state';

const analystA = buildAnalystSummaryFixture({ identityId: '70000000-0000-4000-8000-000000000001', displayLabel: 'Analista A' });
const analystB = buildAnalystSummaryFixture({ identityId: '70000000-0000-4000-8000-000000000002', displayLabel: 'Analista B' });
const assignedA = {
  ...buildLinkedPassportSummaryFixture({ custodyVersion: 1 }),
  custody: { state: 'ASSIGNED' as const, version: 1, analyst: analystA, assignedAt: '2026-10-01T09:00:00.000Z' },
  capabilities: ['CHANGE', 'REMOVE'] as const,
};
const assignedB = {
  ...assignedA,
  custody: { state: 'ASSIGNED' as const, version: 2, analyst: analystB, assignedAt: '2026-10-01T10:00:00.000Z' },
};
const transition = {
  action: 'CHANGE' as const,
  passportId: assignedA.passportId,
  analystIdentityId: analystB.identityId,
  expectedVersion: 1,
  idempotencyKey: '90000000-0000-4000-8000-000000000001',
  reason: 'Cambio concurrente seguro',
};

describe('PassportCustodyState conflict recovery', () => {
  it('refreshes authoritative server state before allowing a new intention and never moves a card optimistically', async () => {
    let release: ((value: unknown) => void) | undefined;
    const command = new Promise((resolve) => { release = resolve; });
    let loads = 0;
    const listCustodyPassports = jest.fn(async (filters: { assignment: string }) => {
      const passport = loads >= 2 ? assignedB : assignedA;
      loads += 1;
      return { kind: 'success' as const, value: { items: filters.assignment === 'ASSIGNED' ? [passport] : [] } };
    });
    const state = new PassportCustodyState(api({ listCustodyPassports, changePassportCustody: jest.fn(() => command) }) as never);
    await state.load();
    const before = state.snapshot;
    const pending = state.applyConfirmedTransition(transition);
    expect(state.snapshot).toBe(before);
    expect(state.snapshot.assigned.items[0]?.custody).toMatchObject({ version: 1 });
    release?.({ kind: 'custody-conflict', current: { state: 'ASSIGNED', version: 2, analystIdentityId: analystB.identityId } });
    await expect(pending).resolves.toBe('conflict');
    expect(state.snapshot.selection).toBeUndefined();
    expect(state.snapshot.assigned.items[0]?.custody).toMatchObject({ version: 2, analyst: analystB });
  });

  it('distinguishes idempotency conflict, refreshes, and requires a reviewed new intention', async () => {
    const backend = api({ changePassportCustody: jest.fn().mockResolvedValue({ kind: 'idempotency-conflict', current: { state: 'ASSIGNED', version: 1, analystIdentityId: analystA.identityId } }) });
    const state = new PassportCustodyState(backend as never);
    await state.load();
    state.selectDestination(assignedA.passportId, analystB.identityId);
    await expect(state.applyConfirmedTransition(transition)).resolves.toBe('idempotency-conflict');
    expect(state.snapshot.selection).toBeUndefined();
    expect(backend.listCustodyPassports).toHaveBeenCalledTimes(4);
  });

  it('preserves the same command/key and displayed cards for a connectivity retry', async () => {
    const changePassportCustody = jest.fn()
      .mockResolvedValueOnce({ kind: 'connectivity-failure' })
      .mockResolvedValueOnce({ kind: 'success', value: { data: { passportId: assignedA.passportId, eventId: 'event-2', custody: { state: 'ASSIGNED', version: 2, analystIdentityId: analystB.identityId, assignedAt: '2026-10-01T10:00:00.000Z' } }, idempotent: false } });
    const state = new PassportCustodyState(api({ changePassportCustody }) as never);
    await state.load();
    const confirmation = new CustodyConfirmationState((input) => state.applyConfirmedTransition(input), () => transition.idempotencyKey);
    confirmation.beginChange(assignedA);
    confirmation.selectAnalyst(analystB);
    confirmation.setReason(transition.reason);
    const before = state.snapshot;
    await expect(confirmation.confirm()).resolves.toBe('failed');
    expect(state.snapshot).toBe(before);
    await expect(confirmation.retry()).resolves.toBe('applied');
    expect(changePassportCustody.mock.calls[0]?.[1]).toEqual(changePassportCustody.mock.calls[1]?.[1]);
    expect(changePassportCustody.mock.calls[0]?.[1]).toMatchObject({ idempotencyKey: transition.idempotencyKey });
  });

  it('clears protected rows for denied/not-found responses', async () => {
    for (const kind of ['restricted', 'session-expired'] as const) {
      const state = new PassportCustodyState(api({ changePassportCustody: jest.fn().mockResolvedValue({ kind }) }) as never);
      await state.load();
      await expect(state.applyConfirmedTransition(transition)).resolves.toBe('denied');
      expect(state.snapshot).toMatchObject({ state: 'restricted', unassigned: { items: [] }, assigned: { items: [] }, analysts: [] });
    }
  });
});

function api(overrides: Record<string, unknown> = {}) {
  return {
    listCustodyPassports: jest.fn(async (filters: { assignment: string }) => ({ kind: 'success' as const, value: { items: filters.assignment === 'ASSIGNED' ? [assignedA] : [] } })),
    listCustodyAnalysts: jest.fn().mockResolvedValue({ kind: 'success', value: { items: [analystA, analystB] } }),
    assignPassportCustody: jest.fn(),
    changePassportCustody: jest.fn(),
    removePassportCustody: jest.fn(),
    ...overrides,
  };
}
