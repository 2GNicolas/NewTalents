import type { AdministratorApi, DossierDetail, DossierFilters, DossierSummary } from '../administrator-api';

export type DossierViewState = 'idle' | 'loading' | 'ready' | 'empty' | 'no-results' | 'restricted' | 'unavailable' | 'error' | 'missing';
type DossierApi = Pick<AdministratorApi, 'listDossiers' | 'getDossierDetail'>;
export type AdminDossiersView = Readonly<{
  filters: DossierFilters;
  list: Readonly<{ state: DossierViewState; items: readonly DossierSummary[]; page: number; canGoPrevious: boolean; nextCursor?: string; scrollOffset: number }>;
  detail: Readonly<{ state: DossierViewState; value?: DossierDetail }>;
}>;

export class AdminDossiersState {
  private cursors: (string | undefined)[] = [undefined]; private scroll = new Map<number, number>();
  private current: AdminDossiersView = Object.freeze({ filters: Object.freeze({ limit: 20 }), list: Object.freeze({ state: 'idle', items: Object.freeze([]), page: 0, canGoPrevious: false, scrollOffset: 0 }), detail: Object.freeze({ state: 'idle' }) });
  constructor(private readonly api: DossierApi) {}
  get snapshot() { return this.current; }

  setFilters(filters: DossierFilters): void { this.cursors = [undefined]; this.scroll.clear(); this.current = Object.freeze({ ...this.current, filters: Object.freeze({ ...filters }), list: Object.freeze({ state: 'idle', items: Object.freeze([]), page: 0, canGoPrevious: false, scrollOffset: 0 }) }); }
  rememberScroll(offset: number): void { if (!Number.isFinite(offset) || offset < 0) return; this.scroll.set(this.current.list.page, offset); this.current = Object.freeze({ ...this.current, list: Object.freeze({ ...this.current.list, scrollOffset: offset }) }); }
  async load(): Promise<void> { await this.loadPage(this.current.list.page); }
  async nextPage(): Promise<void> { if (!this.current.list.nextCursor) return; const page = this.current.list.page + 1; this.cursors[page] = this.current.list.nextCursor; await this.loadPage(page); }
  async previousPage(): Promise<void> { if (!this.current.list.canGoPrevious) return; await this.loadPage(this.current.list.page - 1); }
  async openDetail(id: string): Promise<void> {
    this.current = Object.freeze({ ...this.current, detail: Object.freeze({ state: 'loading' }) }); const result = await this.api.getDossierDetail(id);
    if (result.kind === 'success') this.current = Object.freeze({ ...this.current, detail: Object.freeze({ state: 'ready', value: result.value }) });
    else this.current = Object.freeze({ ...this.current, detail: Object.freeze({ state: mapFailure(result.kind, true) }) });
  }
  closeDetail(): void { this.current = Object.freeze({ ...this.current, detail: Object.freeze({ state: 'idle' }) }); }

  private async loadPage(page: number): Promise<void> {
    const previous = this.current; this.current = Object.freeze({ ...previous, list: Object.freeze({ ...previous.list, state: 'loading' }) });
    const result = await this.api.listDossiers(previous.filters, this.cursors[page]);
    if (result.kind === 'success') {
      const state = result.value.items.length ? 'ready' : hasFilters(previous.filters) ? 'no-results' : 'empty';
      this.current = Object.freeze({ ...this.current, list: Object.freeze({ state, items: result.value.items, page, canGoPrevious: page > 0, ...(result.value.nextCursor ? { nextCursor: result.value.nextCursor } : {}), scrollOffset: this.scroll.get(page) ?? 0 }) }); return;
    }
    this.current = Object.freeze({ ...previous, list: Object.freeze({ ...previous.list, state: mapFailure(result.kind, false) }) });
  }
}
const hasFilters = (filters: DossierFilters) => Boolean(filters.query || filters.status || filters.requestType || filters.confirmedFrom || filters.confirmedTo);
const mapFailure = (kind: string, detail: boolean): DossierViewState => kind === 'restricted' || kind === 'session-expired' ? 'restricted' : kind === 'connectivity-failure' || kind === 'unavailable' ? 'unavailable' : detail && kind === 'version-conflict' ? 'missing' : kind === 'invalid-response' ? 'error' : detail ? 'missing' : 'error';
