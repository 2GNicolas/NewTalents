export type PassportHistoryEvent = Readonly<{
  id?: string;
  action: string;
  outcome: string;
  actorIdentityId?: string;
  priorState?: string | null;
  resultingState?: string | null;
  details?: unknown;
  createdAt: Date;
}>;

const INTERNAL_ACTIONS = new Set(['POSSIBLE_DUPLICATE_DETECTED', 'POSSIBLE_DUPLICATE_RESOLVED']);

function commonProjection(event: PassportHistoryEvent) {
  return {
    ...(event.id === undefined ? {} : { eventId: event.id }),
    action: event.action,
    outcome: event.outcome,
    ...(event.actorIdentityId === undefined ? {} : { actorIdentityId: event.actorIdentityId }),
    ...(event.priorState === undefined ? {} : { priorState: event.priorState }),
    ...(event.resultingState === undefined ? {} : { resultingState: event.resultingState }),
    createdAt: event.createdAt.toISOString(),
  };
}

export function mapOrdinaryPassportHistory(events: readonly PassportHistoryEvent[]) {
  return events.filter((event) => !INTERNAL_ACTIONS.has(event.action)).map(commonProjection);
}

export function mapInternalPassportHistory(events: readonly PassportHistoryEvent[]) {
  return events.map((event) => ({
    ...commonProjection(event),
    ...(INTERNAL_ACTIONS.has(event.action) ? { resolution: typeof event.details === 'object' && event.details !== null && 'resolution' in event.details ? (event.details as { resolution?: string }).resolution : undefined } : {}),
  }));
}
