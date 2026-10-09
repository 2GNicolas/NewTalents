import type { DossierDetail, DossierSummary } from '../administrator-api';
import { AdminDossiersState } from './admin-dossiers-state';

const item = (id: string): DossierSummary => ({ dossierId: id, dossierName: null, maskedReference: `EXP-••••-${id}`, displayLabel: `Expediente ${id}`, status: 'APPROVED', confirmedAt: '2026-09-29T16:42:00.000Z', requestType: 'PERSONAL_ADULT', originRequest: { id: `request-${id}`, maskedReference: `SOL-••••-${id}`, status: 'APPROVED', available: true }, linkedPassport: { id: `passport-${id}`, maskedReference: `PAS-••••-${id}`, status: 'ACTIVE:AWAITING_ANALYST_ENRICHMENT', available: true } });
const detail = (id: string): DossierDetail => ({ ...item(id), confirmationHistory: [{ at: '2026-09-29T16:42:00.000Z', action: 'DOSSIER_CONFIRMED', actorLabel: 'ADMINISTRATOR' }] });

describe('AdminDossiersState', () => {
  it('preserves filters, next/previous cursor stack and per-page scroll context', async () => {
    const listDossiers = jest.fn()
      .mockResolvedValueOnce({ kind: 'success', value: { items: [item('1')], nextCursor: 'page-2' } })
      .mockResolvedValueOnce({ kind: 'success', value: { items: [item('2')], nextCursor: 'page-3' } })
      .mockResolvedValueOnce({ kind: 'success', value: { items: [item('1')], nextCursor: 'page-2' } });
    const state = new AdminDossiersState({ listDossiers, getDossierDetail: jest.fn() });
    state.setFilters({ query: 'Valentina', status: 'APPROVED', requestType: 'PERSONAL_ADULT', limit: 20 });
    await state.load(); state.rememberScroll(360); await state.nextPage(); state.rememberScroll(120); await state.previousPage();
    expect(listDossiers.mock.calls).toEqual([[expect.objectContaining({ query: 'Valentina' }), undefined], [expect.anything(), 'page-2'], [expect.anything(), undefined]]);
    expect(state.snapshot.list.scrollOffset).toBe(360);
    expect(state.snapshot.list.items).toEqual([item('1')]);
  });

  it('loads ephemeral detail, supports notApplicable and clears protected detail on close/denial', async () => {
    const getDossierDetail = jest.fn()
      .mockResolvedValueOnce({ kind: 'success', value: { ...detail('1'), linkedPassport: { notApplicable: true } } })
      .mockResolvedValueOnce({ kind: 'restricted' });
    const state = new AdminDossiersState({ listDossiers: jest.fn(), getDossierDetail });
    await state.openDetail('1');
    expect(state.snapshot.detail).toMatchObject({ state: 'ready', value: { linkedPassport: { notApplicable: true } } });
    state.closeDetail(); expect(state.snapshot.detail).toEqual({ state: 'idle' });
    await state.openDetail('1'); expect(state.snapshot.detail).toEqual({ state: 'restricted' });
  });

  it.each([
    [{ kind: 'success', value: { items: [] } }, 'empty'],
    [{ kind: 'success', value: { items: [] } }, 'no-results'],
    [{ kind: 'restricted' }, 'restricted'], [{ kind: 'session-expired' }, 'restricted'],
    [{ kind: 'unavailable' }, 'unavailable'], [{ kind: 'connectivity-failure' }, 'unavailable'],
    [{ kind: 'invalid-response' }, 'error'],
  ] as const)('maps list response to explicit %s state', async (result, expected) => {
    const state = new AdminDossiersState({ listDossiers: jest.fn().mockResolvedValue(result), getDossierDetail: jest.fn() });
    if (expected === 'no-results') state.setFilters({ query: 'none', limit: 20 });
    await state.load(); expect(state.snapshot.list.state).toBe(expected);
  });
});
