export const OBSERVED_EVENT_CATALOG_VERSION = 1;

export const EVENT_RESULT_CATALOG = {
  PASS: ['SUCCESS', 'FAILURE'],
  CROSS: ['SUCCESS', 'FAILURE'],
  ASSIST: ['NONE'],
  RECEPTION: ['SUCCESS', 'POOR_CONTROL', 'FAILURE'],
  ORIENTED_CONTROL: ['SUCCESS', 'FAILURE'],
  DRIBBLE: ['SUCCESS', 'FAILURE'],
  SHOT: ['SAVED', 'BLOCKED', 'WIDE', 'WOODWORK'],
  GOAL: ['NONE'],
  INTERCEPTION: ['SUCCESS', 'FAILURE'],
  TACKLE: ['SUCCESS', 'FAILURE'],
  CLEARANCE: ['SUCCESS', 'FAILURE'],
  SHOT_BLOCK: ['SUCCESS', 'FAILURE'],
  FOUL_RECEIVED: ['NONE'],
  FOUL_COMMITTED: ['NONE'],
  TACTICAL_FOUL: ['NONE'],
  BALL_LOSS: ['NONE'],
  OFFSIDE: ['YES', 'NO'],
  SAVE: ['SUCCESS', 'DANGEROUS_REBOUND', 'FAILURE'],
  GOALKEEPER_EXIT: ['SUCCESS', 'FAILURE'],
  GOALKEEPER_DISTRIBUTION: ['SUCCESS', 'FAILURE'],
  GOALKEEPER_DIRECTED_DISTRIBUTION: ['SUCCESS', 'FAILURE'],
  CLOSE_DOWN: ['SUCCESS', 'FAILURE'],
} as const;

const contextKeys = ['spatial', 'temporal', 'competitive', 'pressure', 'positional'] as const;
const complexityKeys = ['technicalDifficulty', 'distance', 'precision', 'executionSpeed', 'opponents',
  'nonDominantLimb', 'risk'] as const;
const graduatedValues = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'] as const;

export type ObservedEvent = Readonly<{
  sequence: number;
  eventType: keyof typeof EVENT_RESULT_CATALOG;
  variant?: 'NORMAL' | 'THROUGH';
  result: string;
  videoMinute: string;
  period?: string;
  addedTime?: number;
  context: Readonly<Partial<Record<(typeof contextKeys)[number], Readonly<Record<string, string>>>>>;
  complexity: Readonly<Partial<Record<(typeof complexityKeys)[number], Readonly<Record<string, string>>>>>;
  goalkeeperDetail?: Readonly<Record<'handUsed' | 'handChanged', Readonly<Record<string, string>>>>;
  observation?: string;
}>;

export class ObservedEventValidationError extends Error {
  constructor() { super('Invalid observed event'); }
}

function invalid(): never { throw new ObservedEventValidationError(); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  if (required.some((key) => !(key in value))
    || Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))) invalid();
}
function observedString(value: unknown, maxLength: number): boolean {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}
function oneOf(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === 'string' && allowed.includes(value);
}

function validateContext(value: unknown): void {
  const groups = record(value);
  exactKeys(groups, contextKeys);
  for (const key of contextKeys) {
    const observation = record(groups[key]);
    if (observation.status === 'NOT_OBSERVABLE') exactKeys(observation, ['status']);
    else if (observation.status === 'OBSERVED') {
      exactKeys(observation, ['status', 'value']);
      if (!observedString(observation.value, 80)) invalid();
    } else invalid();
  }
}

function validateComplexity(value: unknown): void {
  const groups = record(value);
  exactKeys(groups, complexityKeys);
  for (const key of complexityKeys) {
    const observation = record(groups[key]);
    if (oneOf(observation.status, ['NOT_OBSERVABLE', 'NOT_APPLICABLE'])) {
      exactKeys(observation, ['status']);
    } else if (observation.status === 'OBSERVED') {
      exactKeys(observation, ['status', 'value']);
      const allowed = key === 'nonDominantLimb' ? ['YES', 'NO'] : graduatedValues;
      if (!oneOf(observation.value, allowed)) invalid();
    } else invalid();
  }
}

function validateGoalkeeperDetail(value: unknown): void {
  const detail = record(value);
  exactKeys(detail, ['handUsed', 'handChanged']);
  for (const key of ['handUsed', 'handChanged'] as const) {
    const observation = record(detail[key]);
    if (oneOf(observation.status, ['NOT_OBSERVABLE', 'NOT_APPLICABLE'])) {
      exactKeys(observation, ['status']);
    } else if (observation.status === 'OBSERVED') {
      exactKeys(observation, ['status', 'value']);
      const allowed = key === 'handUsed' ? ['DOMINANT', 'NON_DOMINANT', 'BOTH', 'NO_HANDS'] : ['YES', 'NO'];
      if (!oneOf(observation.value, allowed)) invalid();
    } else invalid();
  }
}

/** Validates capture facts only. No FEM weights, matrix or event chaining. */
export function validateObservedEvent(input: unknown): ObservedEvent {
  const event = record(input);
  exactKeys(event, ['sequence', 'eventType', 'result', 'videoMinute', 'context', 'complexity'],
    ['variant', 'period', 'addedTime', 'goalkeeperDetail', 'observation']);
  if (!Number.isSafeInteger(event.sequence) || (event.sequence as number) < 1) invalid();
  if (typeof event.eventType !== 'string' || !(event.eventType in EVENT_RESULT_CATALOG)) invalid();
  const eventType = event.eventType as keyof typeof EVENT_RESULT_CATALOG;
  if (!oneOf(event.result, EVENT_RESULT_CATALOG[eventType])) invalid();
  if (eventType === 'PASS') {
    if (!oneOf(event.variant, ['NORMAL', 'THROUGH'])) invalid();
  } else if (event.variant !== undefined) invalid();
  if (!observedString(event.videoMinute, 20) || !/^\d+(?:\+\d+)?$/.test(event.videoMinute as string)) invalid();
  if (event.period !== undefined && !observedString(event.period, 24)) invalid();
  if (event.addedTime !== undefined && (!Number.isSafeInteger(event.addedTime) || (event.addedTime as number) < 0)) invalid();
  if (eventType === 'GOAL' || eventType === 'ASSIST' || event.result === 'FAILURE') {
    exactKeys(record(event.context), []);
    exactKeys(record(event.complexity), []);
  } else {
    validateContext(event.context);
    validateComplexity(event.complexity);
  }
  if (eventType === 'SAVE' && event.result !== 'FAILURE') validateGoalkeeperDetail(event.goalkeeperDetail);
  else if (event.goalkeeperDetail !== undefined) invalid();
  if (event.observation !== undefined && typeof event.observation !== 'string') invalid();
  return event as ObservedEvent;
}
