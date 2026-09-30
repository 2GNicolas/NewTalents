import type { RegistrationApiResult, RegistrationRequestSnapshot, RegistrationRequestStatus, RegistrationRequestType } from '../registration-request-api';

export type AdminInboxFilters = Readonly<{ type?: RegistrationRequestType; status?: RegistrationRequestStatus }>;
export type AdminInboxView = Readonly<{
  filters: AdminInboxFilters;
  rows: readonly RegistrationRequestSnapshot[];
  nextCursor?: string;
  scrollOffset: number;
  state: 'idle' | 'loading' | 'ready' | 'empty' | 'unavailable' | 'error';
}>;

type Page = Readonly<{ items: readonly RegistrationRequestSnapshot[]; nextCursor?: string }>;
type AdminInboxApi = Readonly<{ listAdmin: (filters: AdminInboxFilters, cursor?: string) => Promise<RegistrationApiResult<Page>> }>;

export class AdminInboxState {
  private current: AdminInboxView = Object.freeze({ filters: Object.freeze({}), rows: Object.freeze([]), scrollOffset: 0, state: 'idle' });

  constructor(private readonly api: AdminInboxApi) {}

  get snapshot(): AdminInboxView { return this.current; }

  setFilters(filters: AdminInboxFilters): void {
    this.current = Object.freeze({ filters: Object.freeze({ ...filters }), rows: Object.freeze([]), scrollOffset: 0, state: 'idle' });
  }

  rememberScroll(offset: number): void {
    if (Number.isFinite(offset) && offset >= 0) this.current = Object.freeze({ ...this.current, scrollOffset: offset });
  }

  async load(): Promise<void> { await this.fetchPage(false); }

  async loadNext(): Promise<void> {
    if (!this.current.nextCursor || this.current.state === 'loading') return;
    await this.fetchPage(true);
  }

  invalidate(requestId: string): void {
    const rows = this.current.rows.filter((row) => row.id !== requestId);
    this.current = Object.freeze({ ...this.current, rows: Object.freeze(rows), state: rows.length === 0 ? 'empty' : this.current.state });
  }

  private async fetchPage(append: boolean): Promise<void> {
    const previous = this.current;
    this.current = Object.freeze({ ...previous, state: 'loading' });
    const result = await this.api.listAdmin(previous.filters, append ? previous.nextCursor : undefined);
    if (result.kind === 'success') {
      const byId = new Map((append ? previous.rows : []).map((row) => [row.id, row]));
      result.value.items.forEach((row) => byId.set(row.id, row));
      const rows = Object.freeze([...byId.values()]);
      this.current = Object.freeze({ filters: previous.filters, rows, scrollOffset: previous.scrollOffset, state: rows.length === 0 ? 'empty' : 'ready', ...(result.value.nextCursor ? { nextCursor: result.value.nextCursor } : {}) });
      return;
    }
    const unavailable = result.kind === 'connectivity-failure' || result.kind === 'unavailable-backend';
    this.current = Object.freeze({ ...previous, state: unavailable ? 'unavailable' : 'error' });
  }
}
