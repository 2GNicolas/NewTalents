import {
  OPERATIONAL_GROUPS,
  type AdministratorApi,
  type CompleteRequestFilters,
  type OperationalGroup,
  type OperationalGroupView,
  type RequestOperationsFilters,
} from '../administrator-api';
import type { RegistrationRequestSnapshot } from '../../registration-requests/registration-request-api';

type ViewState = 'idle' | 'loading' | 'ready' | 'empty' | 'restricted' | 'unavailable' | 'error';
type CompleteList = Readonly<{ rows: readonly RegistrationRequestSnapshot[]; nextCursor?: string; scrollOffset: number; state: ViewState }>;
export type AdminRequestsView = Readonly<{
  filters: RequestOperationsFilters;
  completeFilters: CompleteRequestFilters;
  selectedGroup: OperationalGroup;
  groups: readonly OperationalGroupView[];
  completeList: CompleteList;
  state: ViewState;
}>;

type RequestsApi = Pick<AdministratorApi, 'getRequestOperations' | 'listCompleteRequests' | 'updateReviewProgress'>;
const emptyGroups = (): readonly OperationalGroupView[] => Object.freeze(OPERATIONAL_GROUPS.map((group) => Object.freeze({ group, total: 0, items: Object.freeze([]) })));

export class AdminRequestsState {
  private current: AdminRequestsView = Object.freeze({
    filters: Object.freeze({}), completeFilters: Object.freeze({}), selectedGroup: 'NEW', groups: emptyGroups(), state: 'idle',
    completeList: Object.freeze({ rows: Object.freeze([]), scrollOffset: 0, state: 'idle' }),
  });

  constructor(private readonly api: RequestsApi) {}
  get snapshot(): AdminRequestsView { return this.current; }

  setFilters(filters: RequestOperationsFilters): void {
    this.current = Object.freeze({ ...this.current, filters: Object.freeze({ ...filters }), groups: emptyGroups(), state: 'idle' });
  }

  setOperationalGroup(group: OperationalGroup): void {
    this.current = Object.freeze({ ...this.current, selectedGroup: group });
  }

  setCompleteFilters(filters: CompleteRequestFilters): void {
    this.current = Object.freeze({ ...this.current, completeFilters: Object.freeze({ ...filters }), completeList: Object.freeze({ rows: Object.freeze([]), scrollOffset: 0, state: 'idle' }) });
  }

  rememberCompleteListScroll(offset: number): void {
    if (!Number.isFinite(offset) || offset < 0) return;
    this.current = Object.freeze({ ...this.current, completeList: Object.freeze({ ...this.current.completeList, scrollOffset: offset }) });
  }

  async loadOperations(): Promise<void> {
    const previous = this.current;
    this.current = Object.freeze({ ...previous, state: 'loading' });
    const result = await this.api.getRequestOperations(previous.filters);
    if (result.kind === 'success') {
      const total = result.value.groups.reduce((sum, group) => sum + group.total, 0);
      this.current = Object.freeze({ ...this.current, groups: result.value.groups, state: total === 0 ? 'empty' : 'ready' });
      return;
    }
    const state: ViewState = result.kind === 'restricted' || result.kind === 'session-expired' ? 'restricted' : result.kind === 'connectivity-failure' || result.kind === 'unavailable' ? 'unavailable' : 'error';
    this.current = Object.freeze({ ...previous, state });
  }

  async loadCompleteList(): Promise<void> { await this.fetchCompleteList(false); }
  async loadNextCompleteListPage(): Promise<void> {
    if (!this.current.completeList.nextCursor || this.current.completeList.state === 'loading') return;
    await this.fetchCompleteList(true);
  }

  invalidate(requestId: string): void {
    const groups = this.current.groups.map((group) => {
      const items = group.items.filter((item) => item.requestId !== requestId);
      return Object.freeze({ ...group, items: Object.freeze(items), total: items.length });
    });
    const rows = this.current.completeList.rows.filter((row) => row.id !== requestId);
    this.current = Object.freeze({ ...this.current, groups: Object.freeze(groups), completeList: Object.freeze({ ...this.current.completeList, rows: Object.freeze(rows) }) });
  }

  async updateProgress(requestId: string, requestVersion: number, stage: 'OPENED' | 'REVIEWED'): Promise<'updated' | 'conflict' | 'failed'> {
    const result = await this.api.updateReviewProgress(requestId, { expectedRequestVersion: requestVersion, stage });
    if (result.kind === 'version-conflict') return 'conflict';
    if (result.kind !== 'success') return 'failed';
    const groups = this.current.groups.map((group) => {
      const retained = group.items.filter((item) => item.requestId !== requestId);
      const items = result.value.operationalGroup === group.group ? [...retained, result.value] : retained;
      return Object.freeze({ ...group, items: Object.freeze(items), total: items.length });
    });
    this.current = Object.freeze({ ...this.current, groups: Object.freeze(groups) });
    return 'updated';
  }

  private async fetchCompleteList(append: boolean): Promise<void> {
    const previous = this.current;
    this.current = Object.freeze({ ...previous, completeList: Object.freeze({ ...previous.completeList, state: 'loading' }) });
    const result = await this.api.listCompleteRequests(previous.completeFilters, append ? previous.completeList.nextCursor : undefined);
    if (result.kind === 'success') {
      const byId = new Map((append ? previous.completeList.rows : []).map((row) => [row.id, row]));
      result.value.items.forEach((row) => byId.set(row.id, row));
      const rows = Object.freeze([...byId.values()]);
      this.current = Object.freeze({ ...this.current, completeList: Object.freeze({ rows, scrollOffset: previous.completeList.scrollOffset, state: rows.length ? 'ready' : 'empty', ...(result.value.nextCursor ? { nextCursor: result.value.nextCursor } : {}) }) });
      return;
    }
    const state: ViewState = result.kind === 'denied-or-not-found' || result.kind === 'session-expired' ? 'restricted' : result.kind === 'connectivity-failure' || result.kind === 'unavailable-backend' ? 'unavailable' : 'error';
    this.current = Object.freeze({ ...previous, completeList: Object.freeze({ ...previous.completeList, state }) });
  }
}
