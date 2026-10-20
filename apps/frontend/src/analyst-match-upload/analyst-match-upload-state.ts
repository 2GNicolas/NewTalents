import type { CaptureApi, CaptureContext } from './analyst-match-upload-api';

export const eventTypes = ['PASS', 'CROSS', 'ASSIST', 'RECEPTION', 'ORIENTED_CONTROL', 'DRIBBLE', 'SHOT', 'GOAL',
  'INTERCEPTION', 'TACKLE', 'CLEARANCE', 'SHOT_BLOCK', 'FOUL_RECEIVED', 'FOUL_COMMITTED', 'TACTICAL_FOUL',
  'BALL_LOSS', 'OFFSIDE', 'SAVE', 'GOALKEEPER_EXIT', 'GOALKEEPER_DISTRIBUTION',
  'GOALKEEPER_DIRECTED_DISTRIBUTION', 'CLOSE_DOWN'] as const;
export const contextKeys = ['spatial', 'temporal', 'competitive', 'pressure', 'positional'] as const;
export const complexityKeys = ['technicalDifficulty', 'distance', 'precision', 'executionSpeed', 'opponents', 'nonDominantLimb', 'risk'] as const;
export const contextLabels: Record<(typeof contextKeys)[number], string> = { spatial: 'Espacial', temporal: 'Temporal', competitive: 'Competitivo', pressure: 'Presión', positional: 'Posicional' };
export const complexityLabels: Record<(typeof complexityKeys)[number], string> = { technicalDifficulty: 'Dificultad técnica', distance: 'Distancia', precision: 'Precisión requerida', executionSpeed: 'Velocidad de ejecución', opponents: 'Rivales involucrados', nonDominantLimb: 'Extremidad no dominante', risk: 'Riesgo asumido' };
export const eventLabels: Record<(typeof eventTypes)[number], string> = { PASS: 'Pase', CROSS: 'Centro', ASSIST: 'Asistencia', RECEPTION: 'Recepción', ORIENTED_CONTROL: 'Control orientado', DRIBBLE: 'Regate', SHOT: 'Remate', GOAL: 'Gol', INTERCEPTION: 'Intercepción', TACKLE: 'Entrada', CLEARANCE: 'Despeje', SHOT_BLOCK: 'Bloqueo de remate', FOUL_RECEIVED: 'Falta recibida', FOUL_COMMITTED: 'Falta cometida', TACTICAL_FOUL: 'Falta táctica', BALL_LOSS: 'Pérdida del balón', OFFSIDE: 'Fuera de lugar', SAVE: 'Atajada', GOALKEEPER_EXIT: 'Salida del arquero', GOALKEEPER_DISTRIBUTION: 'Saque del arquero', GOALKEEPER_DIRECTED_DISTRIBUTION: 'Saque dirigido', CLOSE_DOWN: 'Achique' };
export const resultsByType: Record<(typeof eventTypes)[number], readonly string[]> = {
  PASS: ['SUCCESS', 'FAILURE'], CROSS: ['SUCCESS', 'FAILURE'], ASSIST: ['NONE'], RECEPTION: ['SUCCESS', 'POOR_CONTROL', 'FAILURE'],
  ORIENTED_CONTROL: ['SUCCESS', 'FAILURE'], DRIBBLE: ['SUCCESS', 'FAILURE'], SHOT: ['SAVED', 'BLOCKED', 'WIDE', 'WOODWORK'],
  GOAL: ['NONE'], INTERCEPTION: ['SUCCESS', 'FAILURE'], TACKLE: ['SUCCESS', 'FAILURE'], CLEARANCE: ['SUCCESS', 'FAILURE'],
  SHOT_BLOCK: ['SUCCESS', 'FAILURE'], FOUL_RECEIVED: ['NONE'], FOUL_COMMITTED: ['NONE'], TACTICAL_FOUL: ['NONE'],
  BALL_LOSS: ['NONE'], OFFSIDE: ['YES', 'NO'], SAVE: ['SUCCESS', 'DANGEROUS_REBOUND', 'FAILURE'],
  GOALKEEPER_EXIT: ['SUCCESS', 'FAILURE'], GOALKEEPER_DISTRIBUTION: ['SUCCESS', 'FAILURE'],
  GOALKEEPER_DIRECTED_DISTRIBUTION: ['SUCCESS', 'FAILURE'], CLOSE_DOWN: ['SUCCESS', 'FAILURE'],
};
export type EventType = (typeof eventTypes)[number];
export type ContextKey = (typeof contextKeys)[number];
export type ComplexityKey = (typeof complexityKeys)[number];
export type Observation = Readonly<{ status: 'OBSERVED'; value: string } | { status: 'NOT_OBSERVABLE' } | { status: 'NOT_APPLICABLE' } | { status: 'UNSET' }>;
export type EventDraft = Readonly<{ eventType: EventType | null; variant?: 'NORMAL' | 'THROUGH' | null; result: string | null;
  videoMinute: string; period: string; addedTime: string; context: Record<ContextKey, Observation>;
  complexity: Record<ComplexityKey, Observation>; goalkeeperDetail: { handUsed: Observation; handChanged: Observation };
  observation: string }>;
export type Participation = 'PARTICIPATED' | 'DID_NOT_PARTICIPATE';
export type CaptureIssue = Readonly<{ field: 'eventType' | 'variant' | 'result' | 'videoMinute' | 'period' | 'addedTime'
  | ContextKey | ComplexityKey | 'handUsed' | 'handChanged'; message: string; group?: number }>;
export type CaptureState = Readonly<{ kind: 'idle' | 'loading' | 'ready' | 'restricted' | 'error'; step: 'capture' | 'review' | 'final';
  context: CaptureContext | null; participation: Participation; events: readonly EventDraft[]; draft: EventDraft | null;
  editingIndex: number | null; activeGroup: number; wheelOpen: boolean; capturedExpanded: boolean;
  captureIssue?: CaptureIssue;
  final: Readonly<{ totalMinutesPlayed: string; youtubeUrl: string }>;
  confirming?: boolean; finalError?: 'validation' | 'conflict' | 'unavailable'; confirmation?: 'APPLIED' | 'IDEMPOTENT' }>;
const emptyFinal = () => ({ totalMinutesPlayed: '', youtubeUrl: '' });
const unset = (): Observation => ({ status: 'UNSET' });
const emptyDraft = (): EventDraft => ({ eventType: null, result: null, videoMinute: '', period: '', addedTime: '', observation: '',
  context: Object.fromEntries(contextKeys.map((key) => [key, unset()])) as Record<ContextKey, Observation>,
  complexity: Object.fromEntries(complexityKeys.map((key) => [key, unset()])) as Record<ComplexityKey, Observation>,
  goalkeeperDetail: { handUsed: unset(), handChanged: unset() } });
const initial = (): CaptureState => ({ kind: 'idle', step: 'capture', context: null, participation: 'PARTICIPATED',
  events: [], draft: null, editingIndex: null, activeGroup: 0, wheelOpen: false, capturedExpanded: false, final: emptyFinal() });
const answered = (item: Observation) => item.status === 'NOT_OBSERVABLE' || item.status === 'NOT_APPLICABLE'
  || (item.status === 'OBSERVED' && item.value.trim().length > 0);
export function firstCaptureIssue(event: EventDraft): CaptureIssue | null {
  if (!event.eventType) return { field: 'eventType', message: 'Elige un tipo de evento.' };
  if (event.eventType === 'PASS' && !event.variant)
    return { field: 'variant', message: 'Elige Pase normal o Pase filtrado.' };
  if (!event.result || !resultsByType[event.eventType].includes(event.result))
    return { field: 'result', message: 'Selecciona el resultado del evento.' };
  if (!event.videoMinute.trim())
    return { field: 'videoMinute', message: 'Indica el minuto del video para guardar este evento.' };
  if (event.videoMinute.length > 20 || !/^\d+(?:\+\d+)?$/.test(event.videoMinute))
    return { field: 'videoMinute', message: 'Usa un minuto del video como 23 o 90+2.' };
  if (event.period.trim().length > 24) return { field: 'period', message: 'El periodo debe tener 24 caracteres o menos.' };
  if (event.addedTime.trim() && (!/^\d+$/.test(event.addedTime.trim())
    || !Number.isSafeInteger(Number(event.addedTime.trim()))))
    return { field: 'addedTime', message: 'El tiempo añadido debe ser un entero no negativo.' };
  if (event.eventType === 'GOAL' || event.eventType === 'ASSIST' || event.result === 'FAILURE') return null;
  for (const [index, key] of contextKeys.entries())
    if (!answered(event.context[key]) || event.context[key].status === 'NOT_APPLICABLE')
      return { field: key, group: index, message: `Selecciona el contexto ${contextLabels[key]} o «no observable».` };
  for (const [index, key] of complexityKeys.entries())
    if (!answered(event.complexity[key]))
      return { field: key, group: index + contextKeys.length,
        message: `Selecciona ${complexityLabels[key]}, «no observable» o «no aplica».` };
  if (event.eventType === 'SAVE') {
    if (!answered(event.goalkeeperDetail.handUsed))
      return { field: 'handUsed', message: 'Selecciona la mano usada en la atajada o su ausencia explícita.' };
    if (!answered(event.goalkeeperDetail.handChanged))
      return { field: 'handChanged', message: 'Indica si cambió de mano o su ausencia explícita.' };
  }
  return null;
}
export const completeEvent = (event: EventDraft): boolean => firstCaptureIssue(event) === null;

export class AnalystMatchCaptureState {
  private current: CaptureState = initial();
  private generation = 0;
  private disposed = false;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe?: () => void;
  private intentKey: string | null = null;
  private inFlight = false;
  constructor(private readonly api: CaptureApi, readonly matchId: string) { this.unsubscribe = api.onAccessLost?.(() => this.clear()); }
  get state() { return this.current; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(value: CaptureState) { if (this.disposed) return; this.current = value; this.listeners.forEach((listener) => listener()); }
  async load() {
    const generation = ++this.generation;
    this.publish({ ...this.current, kind: 'loading', context: null });
    const result = await this.api.capture(this.matchId);
    if (this.disposed || generation !== this.generation) return;
    if (result.kind === 'restricted') return this.clear();
    this.publish({ ...this.current, kind: result.kind === 'success' ? 'ready' : 'error', context: result.kind === 'success' ? result.value : null });
  }
  startEvent() { if (this.current.participation === 'DID_NOT_PARTICIPATE') return false;
    if (this.current.draft && !this.saveEvent()) return false;
    this.publish({ ...this.current, draft: emptyDraft(), editingIndex: null, activeGroup: 0, wheelOpen: false,
      captureIssue: undefined });
    return true; }
  openWheel() { if (this.current.participation === 'DID_NOT_PARTICIPATE') return;
    this.publish({ ...this.current, draft: this.current.draft ?? emptyDraft(), wheelOpen: true }); }
  closeWheel() { this.publish({ ...this.current, wheelOpen: false }); }
  selectType(eventType: EventType, variant?: 'NORMAL' | 'THROUGH') {
    const draft = this.current.draft ?? emptyDraft();
    const keepResult = eventType === 'GOAL' || eventType === 'ASSIST' ? 'NONE'
      : draft.result && resultsByType[eventType].includes(draft.result) ? draft.result : null;
    this.publish({ ...this.current, wheelOpen: false, captureIssue: undefined, draft: { ...draft, eventType,
      variant: eventType === 'PASS' ? variant ?? null : undefined, result: keepResult,
      goalkeeperDetail: eventType === 'SAVE' ? draft.goalkeeperDetail : { handUsed: unset(), handChanged: unset() } } });
  }
  selectResult(result: string) { const draft = this.current.draft; if (!draft?.eventType || !resultsByType[draft.eventType].includes(result)) return;
    this.publish({ ...this.current, captureIssue: undefined, draft: { ...draft, result } }); }
  updateDraft(patch: Partial<EventDraft>) { if (!this.current.draft) return;
    this.publish({ ...this.current, captureIssue: undefined, draft: { ...this.current.draft, ...patch } }); }
  canNavigateToGroup(index: number) {
    const draft = this.current.draft;
    if (!draft || index < 0 || index >= contextKeys.length + complexityKeys.length) return false;
    if (index <= this.current.activeGroup) return true;
    for (let preceding = 0; preceding < index; preceding++) {
      const observation = preceding < contextKeys.length
        ? draft.context[contextKeys[preceding]!]
        : draft.complexity[complexityKeys[preceding - contextKeys.length]!];
      if (!answered(observation)) return false;
    }
    return true;
  }
  setGroup(index: number) { if (!this.canNavigateToGroup(index)) return;
    this.publish({ ...this.current, activeGroup: index }); }
  updateContext(key: ContextKey, observation: Observation) { const draft = this.current.draft;
    if (!draft || observation.status === 'NOT_APPLICABLE') return;
    const activeGroup = answered(observation) ? Math.min(this.current.activeGroup + 1, 11) : this.current.activeGroup;
    this.publish({ ...this.current, activeGroup, captureIssue: undefined,
      draft: { ...draft, context: { ...draft.context, [key]: observation } } }); }
  updateComplexity(key: ComplexityKey, observation: Observation) { const draft = this.current.draft; if (!draft) return;
    const activeGroup = answered(observation) ? Math.min(this.current.activeGroup + 1, 11) : this.current.activeGroup;
    this.publish({ ...this.current, activeGroup, captureIssue: undefined,
      draft: { ...draft, complexity: { ...draft.complexity, [key]: observation } } }); }
  updateGoalkeeper(key: 'handUsed' | 'handChanged', observation: Observation) { const draft = this.current.draft; if (!draft) return;
    this.publish({ ...this.current, captureIssue: undefined,
      draft: { ...draft, goalkeeperDetail: { ...draft.goalkeeperDetail, [key]: observation } } }); }
  saveEvent() { const { draft, editingIndex, events } = this.current;
    if (!draft) return false;
    const issue = firstCaptureIssue(draft);
    if (issue) {
      this.publish({ ...this.current, captureIssue: issue, activeGroup: issue.group ?? this.current.activeGroup }); return false;
    }
    const next = editingIndex === null ? [...events, draft] : events.map((event, index) => index === editingIndex ? draft : event);
    this.publish({ ...this.current, events: next, draft: null, editingIndex: null, activeGroup: 0, wheelOpen: false,
      capturedExpanded: true, captureIssue: undefined });
    return true; }
  editSaved(index: number) { const event = this.current.events[index]; if (!event) return;
    this.publish({ ...this.current, step: 'capture', draft: { ...event }, editingIndex: index, activeGroup: 0,
      captureIssue: undefined }); }
  removeSaved(index: number) { this.publish({ ...this.current, events: this.current.events.filter((_, i) => i !== index),
    draft: this.current.editingIndex === index ? null : this.current.draft, editingIndex: null }); }
  toggleCaptured() { this.publish({ ...this.current, capturedExpanded: !this.current.capturedExpanded }); }
  setParticipation(value: Participation) {
    if (value === 'DID_NOT_PARTICIPATE' && (this.current.events.length > 0 || this.current.draft?.eventType)) return false;
    this.publish({ ...this.current, participation: value,
      ...(value === 'DID_NOT_PARTICIPATE' ? { draft: null, editingIndex: null, wheelOpen: false } : {}) });
    return true;
  }
  setFinal(patch: Partial<CaptureState['final']>) { this.publish({ ...this.current, final: { ...this.current.final, ...patch },
    finalError: this.current.finalError === 'conflict' ? 'conflict' : undefined }); }
  review() { this.publish({ ...this.current, step: 'review' }); }
  backToCapture() { this.publish({ ...this.current, step: 'capture' }); }
  toFinal() { if (this.current.step === 'review') this.publish({ ...this.current, step: 'final' }); }
  backToReview() { this.publish({ ...this.current, step: 'review', finalError: undefined }); }
  async confirm() {
    if (this.inFlight || this.current.confirmation || this.current.finalError === 'conflict'
      || this.current.kind !== 'ready' || this.current.step !== 'final'
      || this.current.context?.availability !== 'AVAILABLE' || !this.current.context.expectedVersion) return;
    const snapshot = this.current;
    const minutesText = snapshot.final.totalMinutesPlayed.trim();
    if (!/^\d+$/.test(minutesText) || !Number.isSafeInteger(Number(minutesText))
      || (snapshot.participation === 'PARTICIPATED' && (Number(minutesText) === 0 || snapshot.events.length === 0))
      || (snapshot.participation === 'DID_NOT_PARTICIPATE' && (Number(minutesText) !== 0 || snapshot.events.length !== 0))
      || !snapshot.final.youtubeUrl.trim() || snapshot.events.some((event) => !completeEvent(event))) {
      this.publish({ ...this.current, finalError: 'validation' }); return;
    }
    if (!this.api.confirm) { this.publish({ ...this.current, finalError: 'unavailable' }); return; }
    this.intentKey ??= globalThis.crypto?.randomUUID?.()
      ?? `00000000-0000-4000-8000-${Date.now().toString().padStart(12, '0').slice(-12)}`;
    this.inFlight = true;
    this.publish({ ...this.current, confirming: true, finalError: undefined });
    const generation = this.generation;
    const events = snapshot.events.map((event, index) => ({
      sequence: index + 1, eventType: event.eventType, ...(event.variant ? { variant: event.variant } : {}),
      result: event.result, videoMinute: event.videoMinute,
      ...(event.period.trim() ? { period: event.period.trim() } : {}),
      ...(event.addedTime.trim() ? { addedTime: Number(event.addedTime) } : {}),
      context: event.eventType === 'GOAL' || event.eventType === 'ASSIST' || event.result === 'FAILURE' ? {} : event.context,
      complexity: event.eventType === 'GOAL' || event.eventType === 'ASSIST' || event.result === 'FAILURE' ? {} : event.complexity,
      ...(event.eventType === 'SAVE' && event.result !== 'FAILURE' ? { goalkeeperDetail: event.goalkeeperDetail } : {}),
      ...(event.observation ? { observation: event.observation } : {}),
    }));
    const result = await this.api.confirm(this.matchId, { expectedVersion: snapshot.context!.expectedVersion!,
      participation: snapshot.participation, totalMinutesPlayed: Number(minutesText),
      youtubeUrl: snapshot.final.youtubeUrl.trim(), events }, this.intentKey);
    this.inFlight = false;
    if (this.disposed || generation !== this.generation) return;
    if (result.kind === 'restricted') return this.clear();
    if (result.kind === 'success') {
      this.publish({ ...this.current, confirming: false, confirmation: result.value.outcome }); return;
    }
    if (result.kind === 'conflict') {
      const current = await this.api.capture(this.matchId);
      if (this.disposed || generation !== this.generation) return;
      if (current.kind === 'restricted') return this.clear();
      this.publish({ ...this.current, confirming: false, finalError: 'conflict',
        context: current.kind === 'success' ? current.value : null });
      return;
    }
    this.publish({ ...this.current, confirming: false, finalError: result.kind });
  }
  clear() { this.generation++; this.intentKey = null; this.inFlight = false; this.publish({ ...initial(), kind: 'restricted' }); }
  dispose() { this.unsubscribe?.(); this.disposed = true; this.generation++; this.listeners.clear(); this.current = initial(); }
}
