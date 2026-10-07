export type CustodyHistoryAction = 'ASSIGNED' | 'CHANGED' | 'REMOVED';

type OperationalProfileRelation = Readonly<{ analystOperationalProfile: Readonly<{ displayLabel: string }> | null }> | null;

export type CustodyHistorySourceEvent = Readonly<{
  [key: string]: unknown;
  id: string;
  action: CustodyHistoryAction;
  createdAt: Date;
  safeReason: string | null;
  previousAnalyst: OperationalProfileRelation;
  nextAnalyst: OperationalProfileRelation;
}>;

export type CustodyHistoryEntry = Readonly<{
  eventId: string;
  at: string;
  action: CustodyHistoryAction;
  actorLabel: 'Administrador';
  previousAnalystLabel?: string;
  nextAnalystLabel?: string;
  reason?: string;
}>;

export type CustodyCreationMilestone = Readonly<{
  kind: 'CREATED_UNASSIGNED';
  at: string;
  label: 'Pasaporte creado · Sin asignar';
}>;

export function mapPassportCustodyHistory(input: Readonly<{
  passportId: string;
  passportCreatedAt: Date;
  events: readonly CustodyHistorySourceEvent[];
}>): Readonly<{ milestone: CustodyCreationMilestone; events: readonly CustodyHistoryEntry[] }> {
  const events = [...input.events]
    .sort((left, right) => left.createdAt.valueOf() - right.createdAt.valueOf() || left.id.localeCompare(right.id))
    .map((event) => Object.freeze({
      eventId: event.id,
      at: event.createdAt.toISOString(),
      action: event.action,
      actorLabel: 'Administrador' as const,
      ...label('previousAnalystLabel', event.previousAnalyst),
      ...label('nextAnalystLabel', event.nextAnalyst),
      ...(event.action !== 'ASSIGNED' && event.safeReason?.trim() ? { reason: event.safeReason.trim().slice(0, 500) } : {}),
    }));
  return Object.freeze({
    milestone: Object.freeze({ kind: 'CREATED_UNASSIGNED', at: input.passportCreatedAt.toISOString(), label: 'Pasaporte creado · Sin asignar' }),
    events: Object.freeze(events),
  });
}

function label(key: 'previousAnalystLabel' | 'nextAnalystLabel', relation: OperationalProfileRelation): Partial<Record<typeof key, string>> {
  const displayLabel = relation?.analystOperationalProfile?.displayLabel.trim();
  return displayLabel ? { [key]: displayLabel.slice(0, 120) } : {};
}
