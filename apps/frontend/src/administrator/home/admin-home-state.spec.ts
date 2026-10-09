import type { AdministratorApi, CustodyPassportSummary, DossierSummary, EligibleAnalystSummary, OperationalGroupView } from '../administrator-api';
import { AdminHomeState } from './admin-home-state';

const groups: readonly OperationalGroupView[] = [
  { group: 'NEW', total: 4, items: [] },
  { group: 'CONTINUE_REVIEW', total: 3, items: [] },
  { group: 'REQUIRES_CORRECTION', total: 2, items: [] },
  { group: 'READY_FOR_DECISION', total: 2, items: [] },
  { group: 'WAITING_EVIDENCE_DELETION', total: 1, items: [] },
];

const analyst = (identityId: string, displayLabel: string, activeCustodyCount: number): EligibleAnalystSummary => ({ identityId, displayLabel, activeCustodyCount });
const passport = (passportId: string, assigned: boolean): CustodyPassportSummary => ({
  passportId, maskedReference: `PAS-••••-${passportId}`, displayLabel: `Jugador ${passportId}`, lifecycleState: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT',
  custody: assigned ? { state: 'ASSIGNED', version: 1, analyst: analyst('analyst-a', 'Laura M.', 8), assignedAt: '2026-09-30T16:00:00.000Z' } : { state: 'UNASSIGNED', version: 0 },
  capabilities: assigned ? ['CHANGE', 'REMOVE'] : ['ASSIGN'],
});
const dossier = (dossierId: string): DossierSummary => ({ dossierId, dossierName: null, maskedReference: `EXP-••••-${dossierId}`, displayLabel: `Expediente ${dossierId}`, status: 'CONFIRMED', confirmedAt: '2026-09-30T16:00:00.000Z', requestType: 'PERSONAL_ADULT', originRequest: { id: `request-${dossierId}`, maskedReference: `SOL-••••-${dossierId}`, status: 'APPROVED', available: true }, linkedPassport: { notApplicable: true } });

function api(overrides: Partial<AdministratorApi> = {}): AdministratorApi {
  return {
    getRequestOperations: jest.fn(async () => ({ kind: 'success', value: { groups } })),
    listDossiers: jest.fn(async (_filters, cursor) => ({ kind: 'success', value: cursor ? { items: [dossier('4')] } : { items: [dossier('1'), dossier('2'), dossier('3')], nextCursor: 'dossiers-2' } })),
    listCustodyPassports: jest.fn(async (filters, cursor) => ({ kind: 'success', value: cursor ? { items: [passport(`${filters.assignment}-2`, filters.assignment === 'ASSIGNED')] } : { items: [passport(`${filters.assignment}-1`, filters.assignment === 'ASSIGNED')], nextCursor: `${filters.assignment}-2` } })),
    listCustodyAnalysts: jest.fn(async () => ({ kind: 'success', value: { items: [analyst('a', 'Laura M.', 8), analyst('b', 'Sebastián R.', 6), analyst('c', 'Natalia C.', 5)] } })),
    ...overrides,
  } as AdministratorApi;
}

describe('AdminHomeState', () => {
  it('derives every metric from complete authorized projections and stable cursor pages', async () => {
    const backend = api(); const state = new AdminHomeState(backend);
    await state.load();
    expect(state.snapshot).toEqual({ state: 'ready', requestsPending: 12, confirmedDossiers: 4, unassignedPassports: 2, assignedPassports: 2, analysts: [analyst('a', 'Laura M.', 8), analyst('b', 'Sebastián R.', 6), analyst('c', 'Natalia C.', 5)] });
    expect(backend.listDossiers).toHaveBeenCalledTimes(2);
    expect(backend.listCustodyPassports).toHaveBeenCalledTimes(4);
  });

  it.each(['restricted', 'unavailable', 'connectivity-failure'] as const)('fails closed without partial metrics for %s', async (kind) => {
    const state = new AdminHomeState(api({ getRequestOperations: jest.fn(async () => ({ kind })) }));
    await state.load();
    expect(state.snapshot).toEqual({ state: kind === 'restricted' ? 'restricted' : kind === 'unavailable' ? 'unavailable' : 'error' });
  });
});
