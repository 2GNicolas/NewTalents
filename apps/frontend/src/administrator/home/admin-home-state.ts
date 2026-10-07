import type { AdministratorApi, AdministratorApiResult, CustodyPassportSummary, DossierSummary, EligibleAnalystSummary } from '../administrator-api';

export type AdminHomeView =
  | Readonly<{ state: 'loading' | 'restricted' | 'unavailable' | 'error' }>
  | Readonly<{ state: 'ready'; requestsPending: number; confirmedDossiers: number; unassignedPassports: number; assignedPassports: number; analysts: readonly EligibleAnalystSummary[] }>;

type Page<T> = Readonly<{ items: readonly T[]; nextCursor?: string }>;
type PagedResult<T> = AdministratorApiResult<Page<T>>;

export class AdminHomeState {
  public snapshot: AdminHomeView = Object.freeze({ state: 'loading' });

  constructor(private readonly api: Pick<AdministratorApi, 'getRequestOperations' | 'listDossiers' | 'listCustodyPassports' | 'listCustodyAnalysts'>) {}

  public async load() {
    this.snapshot = Object.freeze({ state: 'loading' });
    const [requests, dossiers, unassigned, assigned, analysts] = await Promise.all([
      this.api.getRequestOperations({}),
      collectPages<DossierSummary>((cursor) => this.api.listDossiers({ limit: 50 }, cursor)),
      collectPages<CustodyPassportSummary>((cursor) => this.api.listCustodyPassports({ assignment: 'UNASSIGNED', limit: 50 }, cursor)),
      collectPages<CustodyPassportSummary>((cursor) => this.api.listCustodyPassports({ assignment: 'ASSIGNED', limit: 50 }, cursor)),
      collectPages<EligibleAnalystSummary>((cursor) => this.api.listCustodyAnalysts({ limit: 50 }, cursor)),
    ]);
    const failures = [requests, dossiers, unassigned, assigned, analysts].filter((result) => result.kind !== 'success');
    if (failures.length) {
      this.snapshot = Object.freeze({ state: failureState(failures) });
      return;
    }
    if (requests.kind !== 'success' || dossiers.kind !== 'success' || unassigned.kind !== 'success' || assigned.kind !== 'success' || analysts.kind !== 'success') return;
    this.snapshot = Object.freeze({
      state: 'ready',
      requestsPending: requests.value.groups.reduce((total, group) => total + group.total, 0),
      confirmedDossiers: dossiers.value.length,
      unassignedPassports: unassigned.value.length,
      assignedPassports: assigned.value.length,
      analysts: Object.freeze([...analysts.value].sort((left, right) => right.activeCustodyCount - left.activeCustodyCount || left.displayLabel.localeCompare(right.displayLabel))),
    });
  }
}

async function collectPages<T>(load: (cursor?: string) => Promise<PagedResult<T>>): Promise<AdministratorApiResult<readonly T[]>> {
  const items: T[] = []; let cursor: string | undefined;
  do {
    const result = await load(cursor);
    if (result.kind !== 'success') return result;
    items.push(...result.value.items); cursor = result.value.nextCursor;
  } while (cursor);
  return Object.freeze({ kind: 'success', value: Object.freeze(items) });
}

function failureState(results: readonly Exclude<AdministratorApiResult<unknown>, { kind: 'success' }>[]): 'restricted' | 'unavailable' | 'error' {
  if (results.some((result) => result.kind === 'restricted' || result.kind === 'session-expired')) return 'restricted';
  if (results.some((result) => result.kind === 'unavailable')) return 'unavailable';
  return 'error';
}
