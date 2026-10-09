import type { AdministratorApi, AdminPassportCard, AdminPassportDetail, AllowanceCadence } from '../administrator-api';
import { createAllowanceIdempotencyKey } from './allowance-update-state';

type Api = Pick<AdministratorApi, 'listAdminPassports' | 'getAdminPassportDetail' | 'confirmMatchAllowance'>;
export type PassportViewState = 'idle' | 'loading' | 'ready' | 'empty' | 'restricted' | 'unavailable' | 'error';
type Proposal = Readonly<{ cadence: AllowanceCadence; matchLimit: number; expectedActivationDate: string }>;

export class AdminPassportsState {
  private cursors: (string | undefined)[] = [undefined];
  private page = 0;
  private proposal: Proposal | null = null;
  private current = { list: { state: 'idle' as PassportViewState, items: [] as readonly AdminPassportCard[], page: 0, nextCursor: null as string | null },
    detail: { state: 'idle' as PassportViewState, value: undefined as AdminPassportDetail | undefined }, error: null as string | null };
  constructor(private readonly api: Api) {}
  get snapshot() { return this.current; }

  async load() { await this.loadPage(this.page); }
  async nextPage() { if (!this.current.list.nextCursor) return; this.page++; this.cursors[this.page] = this.current.list.nextCursor; await this.load(); }
  async previousPage() { if (!this.page) return; this.page--; await this.load(); }
  async openDetail(id: string) {
    this.proposal = null; this.current = { ...this.current, detail: { state: 'loading', value: undefined }, error: null };
    const result = await this.api.getAdminPassportDetail(id);
    this.current = { ...this.current, detail: result.kind === 'success' ? { state: 'ready', value: result.value }
      : { state: failure(result.kind), value: undefined } };
  }
  proposeCreation(cadence: AllowanceCadence, text: string): boolean {
    const detail = this.current.detail.value; const limit = Number(text);
    if (!detail?.passport.canConfigure || detail.allowance.configuration || !/^\d+$/.test(text) || !Number.isSafeInteger(limit) || limit <= 0) {
      this.proposal = null; this.current = { ...this.current, error: 'Ingresa un número entero positivo de partidos.' }; return false;
    }
    this.proposal = { cadence, matchLimit: limit, expectedActivationDate: detail.allowance.colombiaToday };
    this.current = { ...this.current, error: null }; return true;
  }
  discard() { this.proposal = null; this.current = { ...this.current, error: null }; }
  async confirmCreation() {
    const detail = this.current.detail.value; const proposal = this.proposal;
    if (!detail || !proposal) return;
    this.proposal = null;
    const result = await this.api.confirmMatchAllowance(detail.passport.id, { expectedVersion: 0, idempotencyKey: createAllowanceIdempotencyKey(), ...proposal });
    if (result.kind === 'success') await this.openDetail(detail.passport.id);
    else this.current = { ...this.current, error: result.kind === 'activation-date-changed' || result.kind === 'allowance-conflict' ? 'La configuración cambió. Revisa el estado actual antes de confirmar de nuevo.' : 'No se pudo guardar la configuración.' };
  }
  dispose() { this.proposal = null; this.current = { ...this.current, detail: { state: 'idle', value: undefined }, error: null }; }

  private async loadPage(page: number) {
    this.current = { ...this.current, list: { state: 'loading', items: [], page, nextCursor: null } };
    const result = await this.api.listAdminPassports({ limit: 20 }, this.cursors[page]);
    this.current = { ...this.current, list: result.kind === 'success'
      ? { state: result.value.items.length ? 'ready' : 'empty', items: result.value.items, page, nextCursor: result.value.nextCursor }
      : { state: failure(result.kind), items: [], page, nextCursor: null } };
  }
}

function failure(kind: string): PassportViewState {
  return kind === 'restricted' || kind === 'session-expired' ? 'restricted' : kind === 'unavailable' || kind === 'connectivity-failure' ? 'unavailable' : 'error';
}
