import { AdminPassportsState } from './admin-passports-state';

const card = { id: '10000000-0000-4000-8000-000000000001', playerLabel: 'Jugador de prueba', maskedReference: 'PAS-••••-0001', state: 'ACTIVE', canConfigure: true };
const envelope = { colombiaToday: '2026-10-09', configuration: null };
const detail = { passport: card, allowance: envelope };

function setup() {
  const api = {
    listAdminPassports: jest.fn().mockResolvedValueOnce({ kind: 'success', value: { items: [card], nextCursor: 'next' } }).mockResolvedValue({ kind: 'success', value: { items: [], nextCursor: null } }),
    getAdminPassportDetail: jest.fn().mockResolvedValue({ kind: 'success', value: detail }),
    confirmMatchAllowance: jest.fn().mockResolvedValue({ kind: 'success', value: { colombiaToday: '2026-10-09', configuration: { version: 1 } } }),
  };
  return { api, state: new AdminPassportsState(api as never) };
}

describe('Administrator passport state', () => {
  it('pages the one all-passport collection and loads only ephemeral detail', async () => {
    const { api, state } = setup();
    await state.load();
    expect(state.snapshot.list.items).toEqual([card]);
    await state.nextPage();
    expect(api.listAdminPassports).toHaveBeenLastCalledWith({ limit: 20 }, 'next');
    await state.previousPage();
    await state.openDetail(card.id);
    expect(state.snapshot.detail.value).toEqual(detail);
    state.dispose();
    expect(state.snapshot.detail.value).toBeUndefined();
  });

  it('keeps a proposal local until confirmation, uses the server day, and refreshes after creation', async () => {
    const { api, state } = setup();
    await state.openDetail(card.id);
    expect(state.proposeCreation('MONTHLY', '4')).toBe(true);
    expect(api.confirmMatchAllowance).not.toHaveBeenCalled();
    state.discard();
    expect(api.confirmMatchAllowance).not.toHaveBeenCalled();
    expect(state.proposeCreation('MONTHLY', '0')).toBe(false);
    expect(state.proposeCreation('MONTHLY', '4')).toBe(true);
    await state.confirmCreation();
    expect(api.confirmMatchAllowance).toHaveBeenCalledWith(card.id, expect.objectContaining({ expectedVersion: 0, expectedActivationDate: '2026-10-09', cadence: 'MONTHLY', matchLimit: 4 }));
    expect(api.getAdminPassportDetail).toHaveBeenCalledTimes(2);
  });

  it('clears protected detail on restriction and failure', async () => {
    const { api, state } = setup();
    await state.openDetail(card.id);
    api.getAdminPassportDetail.mockResolvedValue({ kind: 'restricted' });
    await state.openDetail(card.id);
    expect(state.snapshot.detail).toEqual({ state: 'restricted' });
  });
});
