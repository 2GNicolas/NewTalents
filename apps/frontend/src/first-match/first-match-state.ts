import type { FirstMatchApi, FirstMatchAvailability, FirstMatchFlow, FirstMatchSummary,
  ScheduleCommand, ScheduleFields } from './first-match-api';

export type FirstMatchNotice = 'conflict' | 'invalid' | 'no-allowance' | 'allowance-full' | 'ineligible' | 'restricted' | 'unavailable';
export type FirstMatchState = Readonly<{
  phase: 'idle' | 'loading' | 'ready' | 'submitting';
  flow: FirstMatchFlow | null; availability: FirstMatchAvailability | null;
  notice?: FirstMatchNotice;
}>;
export const FIRST_MATCH_NOTICES: Readonly<Record<FirstMatchNotice, string>> = {
  conflict: 'El estado del partido cambió. Consulta la información actual antes de volver a intentar.',
  invalid: 'Revisa la fecha, hora y los datos del partido.',
  'no-allowance': 'No hay un cupo configurado para la fecha seleccionada.',
  'allowance-full': 'No quedan cupos en el período de esa fecha.',
  ineligible: 'Este pasaporte no está activo para agendar.',
  restricted: 'El primer partido no está disponible para esta cuenta.',
  unavailable: 'El servicio no está disponible. Conservamos los datos ingresados; puedes reintentar.',
};

let fallbackSequence = 0;
export function firstMatchIntentKey(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `00000000-0000-4000-8000-${((Date.now() + fallbackSequence++) % 1_000_000_000_000).toString().padStart(12, '0')}`;
}

export class FirstMatchStateMachine {
  private stateValue: FirstMatchState = { phase: 'idle', flow: null, availability: null };
  private readonly listeners = new Set<() => void>();
  private pending: { fingerprint: string; idempotencyKey: string } | null = null;
  private pendingCorrection: { fingerprint: string; idempotencyKey: string } | null = null;
  private previewGeneration = 0;
  private loadGeneration = 0;
  private disposed = false;
  private submitting = false;

  constructor(private readonly api: FirstMatchApi, readonly passportId: string) {}
  get state(): FirstMatchState { return this.stateValue; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<FirstMatchState>) {
    if (this.disposed) return;
    this.stateValue = { ...this.stateValue, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private restricted() { this.pending = null; this.pendingCorrection = null; this.previewGeneration++; this.publish({ phase: 'ready', flow: null, availability: null, notice: 'restricted' }); }

  async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.previewGeneration++;
    this.publish({ phase: 'loading', flow: null, availability: null, notice: undefined });
    const result = await this.api.flow(this.passportId);
    if (this.disposed || generation !== this.loadGeneration) return;
    if (result.kind === 'success') {
      if (result.value.state === 'LOADED') { this.pending = null; this.pendingCorrection = null; }
      this.publish({ phase: 'ready', flow: result.value, availability: null, notice: undefined });
    }
    else if (result.kind === 'restricted') this.restricted();
    else this.publish({ phase: 'ready', flow: null, notice: 'unavailable' });
  }

  async preview(matchDate: string): Promise<void> {
    const generation = ++this.previewGeneration;
    this.publish({ availability: null, notice: undefined });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) return;
    const result = await this.api.preview(this.passportId, matchDate);
    if (this.disposed || generation !== this.previewGeneration) return;
    if (result.kind === 'success') this.publish({ availability: result.value });
    else if (result.kind === 'restricted') this.restricted();
    else this.publish({ availability: null, notice: result.kind === 'invalid' ? 'invalid' : 'unavailable' });
  }

  async schedule(fields: ScheduleFields): Promise<void> {
    if (this.submitting || this.stateValue.flow?.state !== 'INVITATION') return;
    const fingerprint = JSON.stringify(fields);
    if (this.pending?.fingerprint !== fingerprint) this.pending = { fingerprint, idempotencyKey: firstMatchIntentKey() };
    const command: ScheduleCommand = { ...fields, expectedVersion: 0, idempotencyKey: this.pending.idempotencyKey };
    this.submitting = true;
    this.publish({ phase: 'submitting', notice: undefined });
    try {
      const result = await this.api.schedule(this.passportId, command);
      if (this.disposed) return;
      if (result.kind === 'restricted') { this.restricted(); return; }
      if (result.kind === 'success') {
        this.pending = null;
        await this.load(); // The durable server flow, not the POST response, owns the waiting screen.
        return;
      }
      if (result.kind === 'conflict') {
        const current = await this.api.flow(this.passportId);
        if (this.disposed) return;
        if (current.kind === 'restricted') { this.restricted(); return; }
        if (current.kind === 'success') this.publish({ flow: current.value, availability: null });
        this.pending = null; // A different attempt after a conflict gets a new key.
      }
      if ((result.kind === 'conflict' && this.stateValue.flow?.state === 'INVITATION')
        || result.kind === 'allowance-full' || result.kind === 'no-allowance') {
        await this.preview(fields.matchDate);
        if (this.disposed || this.stateValue.notice === 'restricted') return;
      }
      this.publish({ phase: 'ready', notice: result.kind });
    } finally { this.submitting = false; }
  }

  private async refreshAfterCorrectionError(): Promise<void> {
    const generation = ++this.loadGeneration;
    const current = await this.api.flow(this.passportId);
    if (this.disposed || generation !== this.loadGeneration) return;
    if (current.kind === 'restricted') this.restricted();
    else if (current.kind === 'success') this.publish({ flow: current.value, availability: null });
    // On an unavailable refresh, keep the last authorized booking on screen with an error.
  }

  async reschedule(match: FirstMatchSummary, fields: ScheduleFields): Promise<void> {
    await this.correct('RESCHEDULE', match, fields);
  }

  async cancel(match: FirstMatchSummary): Promise<void> {
    await this.correct('CANCEL', match);
  }

  private async correct(action: 'RESCHEDULE' | 'CANCEL', match: FirstMatchSummary, fields?: ScheduleFields): Promise<void> {
    if (this.submitting) return;
    const current = this.stateValue.flow;
    if (current?.state !== 'WAITING' || current.match?.id !== match.id || current.match.version !== match.version
      || !current.allowedActions.includes(action)) {
      await this.refreshAfterCorrectionError();
      if (this.stateValue.notice !== 'restricted') this.publish({ phase: 'ready', notice: 'conflict' });
      return;
    }
    if (action === 'RESCHEDULE' && !fields) return;
    const fingerprint = JSON.stringify({ action, matchId: match.id, expectedVersion: match.version, fields });
    if (this.pendingCorrection?.fingerprint !== fingerprint)
      this.pendingCorrection = { fingerprint, idempotencyKey: firstMatchIntentKey() };
    const command = { expectedVersion: match.version, idempotencyKey: this.pendingCorrection.idempotencyKey };
    this.submitting = true;
    this.publish({ phase: 'submitting', notice: undefined });
    try {
      const result = action === 'RESCHEDULE' && fields
        ? await this.api.reschedule(this.passportId, match.id, { ...fields, ...command })
        : await this.api.cancel(this.passportId, match.id, command);
      if (this.disposed) return;
      if (result.kind === 'restricted') { this.restricted(); return; }
      if (result.kind === 'success') {
        this.pendingCorrection = null;
        await this.load();
        return;
      }
      if (result.kind === 'conflict' || result.kind === 'invalid' || result.kind === 'no-allowance'
        || result.kind === 'allowance-full' || result.kind === 'ineligible') {
        await this.refreshAfterCorrectionError();
        if (action === 'RESCHEDULE' && fields && this.stateValue.flow?.state === 'WAITING')
          await this.preview(fields.matchDate);
        this.pendingCorrection = null;
      }
      if (this.disposed || this.stateValue.notice === 'restricted') return;
      this.publish({ phase: 'ready', notice: result.kind });
    } finally { this.submitting = false; }
  }

  pause() { this.loadGeneration++; this.previewGeneration++; }
  dispose() { this.pause(); this.disposed = true; this.pending = null; this.pendingCorrection = null; this.listeners.clear(); this.stateValue = { phase: 'idle', flow: null, availability: null }; }
}
