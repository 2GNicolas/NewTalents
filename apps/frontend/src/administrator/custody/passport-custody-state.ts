import type {
  AdministratorApi,
  AssignCustodyCommand,
  ChangeCustodyCommand,
  CustodyPassportSummary,
  EligibleAnalystSummary,
  RemoveCustodyCommand,
} from '../administrator-api';

type CustodyViewState = 'idle' | 'loading' | 'ready' | 'empty' | 'restricted' | 'unavailable' | 'error';
type PassportPage = Readonly<{ items: readonly CustodyPassportSummary[]; nextCursor?: string }>;
export type PassportCustodyView = Readonly<{
  query: string;
  state: CustodyViewState;
  unassigned: PassportPage;
  assigned: PassportPage;
  analysts: readonly EligibleAnalystSummary[];
  selection?: Readonly<{ passportId: string; analystIdentityId: string }>;
}>;

type CustodyApi = Pick<AdministratorApi, 'listCustodyPassports' | 'listCustodyAnalysts' | 'assignPassportCustody'>
  & Partial<Pick<AdministratorApi, 'changePassportCustody' | 'removePassportCustody'>>;
export type ConfirmedCustodyTransition =
  | (AssignCustodyCommand & Readonly<{ action: 'ASSIGN'; passportId: string }>)
  | (ChangeCustodyCommand & Readonly<{ action: 'CHANGE'; passportId: string }>)
  | (RemoveCustodyCommand & Readonly<{ action: 'REMOVE'; passportId: string }>);
const emptyPage = (): PassportPage => Object.freeze({ items: Object.freeze([]) });
export type CustodyTransitionResult = 'applied' | 'conflict' | 'idempotency-conflict' | 'denied' | 'failed';

export class PassportCustodyState {
  private current: PassportCustodyView = Object.freeze({ query: '', state: 'idle', unassigned: emptyPage(), assigned: emptyPage(), analysts: Object.freeze([]) });
  constructor(private readonly api: CustodyApi) {}
  get snapshot(): PassportCustodyView { return this.current; }

  setSearch(query: string): void {
    this.current = Object.freeze({ ...this.current, query: query.trim(), state: 'idle', unassigned: emptyPage(), assigned: emptyPage() });
  }

  selectDestination(passportId: string, analystIdentityId: string): void {
    this.current = Object.freeze({ ...this.current, selection: Object.freeze({ passportId, analystIdentityId }) });
  }

  clearSelection(): void {
    const { selection: _selection, ...rest } = this.current;
    this.current = Object.freeze(rest);
  }

  async load(): Promise<void> {
    const previous = this.current;
    this.current = Object.freeze({ ...previous, state: 'loading' });
    const query = previous.query || undefined;
    const [unassigned, assigned, analysts] = await Promise.all([
      this.api.listCustodyPassports({ assignment: 'UNASSIGNED', limit: 20, ...(query ? { query } : {}) }),
      this.api.listCustodyPassports({ assignment: 'ASSIGNED', limit: 20, ...(query ? { query } : {}) }),
      this.api.listCustodyAnalysts({ limit: 20, ...(query ? { query } : {}) }),
    ]);
    const failures = [unassigned, assigned, analysts].filter((result) => result.kind !== 'success');
    if (failures.length) {
      const state: CustodyViewState = failures.some((result) => result.kind === 'restricted' || result.kind === 'session-expired') ? 'restricted'
        : failures.some((result) => result.kind === 'connectivity-failure' || result.kind === 'unavailable') ? 'unavailable' : 'error';
      this.current = Object.freeze({ ...previous, state });
      return;
    }
    if (unassigned.kind !== 'success' || assigned.kind !== 'success' || analysts.kind !== 'success') return;
    const empty = unassigned.value.items.length === 0 && assigned.value.items.length === 0 || analysts.value.items.length === 0;
    this.current = Object.freeze({
      ...previous,
      state: empty ? 'empty' : 'ready',
      unassigned: unassigned.value,
      assigned: assigned.value,
      analysts: analysts.value.items,
    });
  }

  async applyConfirmedAssignment(input: AssignCustodyCommand & Readonly<{ passportId: string }>): Promise<CustodyTransitionResult> {
    return this.applyConfirmedTransition({ action: 'ASSIGN', ...input });
  }

  async applyConfirmedTransition(input: ConfirmedCustodyTransition): Promise<CustodyTransitionResult> {
    const { action, passportId, ...command } = input;
    if ((action === 'CHANGE' && !this.api.changePassportCustody) || (action === 'REMOVE' && !this.api.removePassportCustody)) return 'failed';
    const result = action === 'ASSIGN'
      ? await this.api.assignPassportCustody(passportId, command as AssignCustodyCommand)
      : action === 'CHANGE'
        ? await this.api.changePassportCustody!(passportId, command as ChangeCustodyCommand)
        : await this.api.removePassportCustody!(passportId, command as RemoveCustodyCommand);
    if (result.kind === 'version-conflict' || result.kind === 'custody-conflict' || result.kind === 'idempotency-conflict') {
      this.clearSelection();
      await this.load();
      return result.kind === 'idempotency-conflict' ? 'idempotency-conflict' : 'conflict';
    }
    if (result.kind === 'restricted' || result.kind === 'session-expired') {
      this.current = Object.freeze({ query: this.current.query, state: 'restricted', unassigned: emptyPage(), assigned: emptyPage(), analysts: Object.freeze([]) });
      return 'denied';
    }
    if (result.kind !== 'success') return 'failed';
    this.clearSelection();
    await this.load();
    return 'applied';
  }
}

export function approvedRequestCustodyRoute(passportId: string): string {
  return `/admin/custody?passportId=${encodeURIComponent(passportId)}`;
}
