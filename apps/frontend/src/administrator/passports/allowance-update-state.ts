import type { AdministratorApi, AllowanceCadence, MatchAllowanceCommand, MatchAllowanceEnvelope, MatchAllowanceRevision, MatchAllowanceRule } from '../administrator-api';

type Api = Pick<AdministratorApi, 'confirmMatchAllowance' | 'getMatchAllowance' | 'listMatchAllowanceHistory'>;
type Proposal = Readonly<{ previous: MatchAllowanceRule | null; next: Readonly<{ cadence: AllowanceCadence; matchLimit: number }>; effectiveOn: string; command: MatchAllowanceCommand }>;
export type UpdateStage = 'idle' | 'review' | 'submitting' | 'recoverable' | 'conflict' | 'error';
let fallbackCounter = 0;
export const createAllowanceIdempotencyKey = () => globalThis.crypto?.randomUUID?.() ?? `00000000-0000-4000-8000-${((Date.now() + fallbackCounter++) % 1_000_000_000_000).toString().padStart(12, '0')}`;

export class AllowanceUpdateState {
  private current: MatchAllowanceEnvelope;
  private proposal: Proposal | null = null;
  private stage: UpdateStage = 'idle';
  private message: string | null = null;
  private history: readonly MatchAllowanceRevision[] = [];
  private nextCursor: string | null = null;
  private freshAfterConflict = true;
  constructor(private readonly api: Api, private readonly passportId: string, initial: MatchAllowanceEnvelope) { this.current = initial; }
  get snapshot() { return { current: this.current, proposal: this.proposal, stage: this.stage, message: this.message, history: this.history, nextCursor: this.nextCursor }; }

  begin(cadence: AllowanceCadence, text: string): boolean {
    if (!this.freshAfterConflict) { this.message = 'Actualiza la configuración vigente antes de confirmar otra propuesta.'; return false; }
    const limit = Number(text);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(limit) || limit <= 0) { this.message = 'Ingresa un número entero positivo de partidos.'; return false; }
    const configuration = this.current.configuration;
    const command: MatchAllowanceCommand = { expectedVersion: configuration?.version ?? 0, idempotencyKey: createAllowanceIdempotencyKey(), cadence, matchLimit: limit,
      ...(!configuration ? { expectedActivationDate: this.current.colombiaToday } : {}) };
    this.proposal = { previous: configuration?.currentRule ?? null, next: { cadence, matchLimit: limit }, effectiveOn: configuration?.currentPeriod.endExclusive ?? this.current.colombiaToday, command };
    this.message = null; this.stage = 'review'; return true;
  }
  discard() { this.proposal = null; this.message = null; this.stage = 'idle'; }
  async confirm(): Promise<void> {
    if (!this.proposal || this.stage !== 'review' && this.stage !== 'recoverable') return;
    const proposal = this.proposal; this.stage = 'submitting';
    const result = await this.api.confirmMatchAllowance(this.passportId, proposal.command);
    if (result.kind === 'success') {
      this.proposal = null; this.stage = 'idle'; this.message = null;
      const refreshed = await this.api.getMatchAllowance(this.passportId);
      this.current = refreshed.kind === 'success' ? refreshed.value : result.value;
      await this.loadHistory(); return;
    }
    if (result.kind === 'connectivity-failure' || result.kind === 'unavailable') { this.stage = 'recoverable'; this.message = 'No se confirmó la respuesta. Reintenta la misma operación.'; return; }
    if (result.kind === 'allowance-conflict' || result.kind === 'activation-date-changed' || result.kind === 'version-conflict') {
      this.proposal = null; this.stage = 'conflict'; this.message = 'La configuración cambió. Revisa la versión actual y confirma una nueva propuesta.';
      this.freshAfterConflict = false;
      const refreshed = await this.api.getMatchAllowance(this.passportId);
      if (refreshed.kind === 'success') { this.current = refreshed.value; this.freshAfterConflict = true; }
      return;
    }
    this.proposal = null; this.stage = 'error'; this.message = result.kind === 'restricted' || result.kind === 'session-expired' ? 'Acceso restringido.' : 'No se pudo guardar la configuración.';
  }
  async retry() { if (this.stage === 'recoverable') await this.confirm(); }
  async loadHistory() {
    const result = await this.api.listMatchAllowanceHistory(this.passportId, 20);
    if (result.kind === 'success') { this.history = result.value.items; this.nextCursor = result.value.nextCursor; }
  }
  async nextHistoryPage() {
    if (!this.nextCursor) return;
    const result = await this.api.listMatchAllowanceHistory(this.passportId, 20, this.nextCursor);
    if (result.kind === 'success') { this.history = [...this.history, ...result.value.items]; this.nextCursor = result.value.nextCursor; }
  }
  dispose() { this.proposal = null; this.history = []; this.nextCursor = null; this.message = null; this.stage = 'idle'; }
}
