import {
  type DominantFoot,
  type PassportLifecycleAction,
  type PassportLifecycleOutcome,
  type PassportLifecycleState,
  type PassportOrigin,
} from '../../generated/prisma/client.js';

export const PASSPORT_ACTIONS = ['EDIT', 'SUBMIT', 'RETURN', 'RESOLVE_DUPLICATE', 'APPROVE', 'ACTIVATE', 'VIEW_HISTORY'] as const;
export type PassportAction = (typeof PASSPORT_ACTIONS)[number];

export const PASSPORT_COLLECTION_ACTIONS = ['create'] as const;
export type PassportCollectionAction = (typeof PASSPORT_COLLECTION_ACTIONS)[number];

export type PassportCapabilityContext = Readonly<{
  manage: boolean;
  review: boolean;
  activate: boolean;
  history: boolean;
  state: PassportLifecycleState;
  hasUnresolvedDuplicateSignal: boolean;
  hasConfirmedExistingPlayerResolution: boolean;
}>;

export type PassportStatusProjection = {
  id: string;
  state: PassportLifecycleState;
  originKind: PassportOrigin;
  position: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  correctionReason?: string;
  displayName?: string | null;
  academyOriginName?: string | null;
};

export type PassportStatusResponseDto = {
  passportId: string;
  displayName: string;
  lifecycleState: PassportLifecycleState;
  origin: 'PARTICULAR' | 'ACADEMY' | 'HISTORICAL_TUTOR';
  academyOriginName: string | null;
  availableActions: readonly PassportAction[];
  version: number;
  correctionReason: string | null;
  ageSensitiveMutationAvailability: 'AVAILABLE' | 'NOT_AVAILABLE';
};

export type PossibleDuplicateSignalProjection = Readonly<{
  id: string;
  status: 'UNRESOLVED' | 'RESOLVED';
  resolution: string;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedByIdentityId: string | null;
}>;

export type PassportPresentationProjection = Readonly<{
  id: string;
  state: PassportLifecycleState;
  originKind: PassportOrigin;
  position: string;
  ageCategory: string;
  city: string;
  country: string;
  dominantFoot: DominantFoot;
  createdAt: Date;
  updatedAt: Date;
  displayName: string | null;
  academyOriginName?: string | null;
}>;

export type LifecycleEventProjection = Readonly<{
  id: string;
  action: PassportLifecycleAction;
  outcome: PassportLifecycleOutcome;
  actorIdentityId: string;
  priorState: PassportLifecycleState | null;
  resultingState: PassportLifecycleState | null;
  details: unknown;
  createdAt: Date;
}>;

export function mapPassportState(state: PassportLifecycleState): string {
  switch (state) {
    case 'DRAFT': return 'Borrador';
    case 'IN_REVIEW': return 'En revisión';
    case 'RETURNED_FOR_CORRECTION': return 'Devuelto para corrección';
    case 'APPROVED': return 'Aprobado';
    case 'ACTIVE': return 'Activo';
  }
}

export function mapPassportDominantFoot(foot: DominantFoot): string {
  switch (foot) {
    case 'LEFT': return 'Izquierda';
    case 'RIGHT': return 'Derecha';
    case 'BOTH': return 'Ambos';
    case 'UNDECLARED': return 'No declarado';
  }
}

export function mapPassportOrigin(origin: PassportOrigin): 'PARTICULAR' | 'ACADEMY' | 'HISTORICAL_TUTOR' {
  return origin === 'TUTOR' ? 'HISTORICAL_TUTOR' : origin;
}

function mapLifecycleAction(action: PassportLifecycleAction): string {
  switch (action) {
    case 'INITIAL_TUTOR_RESPONSIBILITY_ESTABLISHED': return 'INITIAL_RESPONSIBILITY_ESTABLISHED';
    case 'RETURNED_FOR_CORRECTION': return 'RETURNED';
    default: return action;
  }
}

function safeDetails(details: unknown): Record<string, unknown> {
  if (typeof details !== 'object' || details === null) return {};
  const source = details as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  if (typeof source.reason === 'string' && source.reason.trim().length > 0) result.reason = source.reason;
  if (typeof source.resolution === 'string' && ['DIFFERENT_PLAYERS', 'CORRECTABLE', 'CONFIRMED_EXISTING_PLAYER', 'PENDING_REVIEW'].includes(source.resolution)) {
    result.resolution = source.resolution;
  }
  return result;
}

export function derivePassportCapabilities(context: PassportCapabilityContext): PassportAction[] {
  const capabilities: PassportAction[] = [];
  const editable = context.state === 'DRAFT' || context.state === 'RETURNED_FOR_CORRECTION';
  if (context.manage && editable) capabilities.push('EDIT', 'SUBMIT');
  if (context.review && context.state === 'IN_REVIEW') {
    capabilities.push('RETURN');
    if (context.hasUnresolvedDuplicateSignal) {
      capabilities.push('RESOLVE_DUPLICATE');
    } else if (!context.hasConfirmedExistingPlayerResolution) {
      capabilities.push('APPROVE');
    }
  }
  if (context.activate && context.state === 'APPROVED') capabilities.push('ACTIVATE');
  if (context.history) capabilities.push('VIEW_HISTORY');
  return capabilities;
}

export function toPassportStatusResponse(record: PassportStatusProjection, capabilities: readonly PassportAction[]): PassportStatusResponseDto {
  const response: PassportStatusResponseDto = {
    passportId: record.id,
    displayName: record.displayName ?? '',
    lifecycleState: record.state,
    origin: mapPassportOrigin(record.originKind),
    academyOriginName: record.academyOriginName ?? null,
    availableActions: capabilities,
    version: Math.max(1, record.version),
    correctionReason: record.correctionReason ?? null,
    ageSensitiveMutationAvailability: capabilities.includes('EDIT') || capabilities.includes('SUBMIT') ? 'AVAILABLE' : 'NOT_AVAILABLE',
  };
  return response;
}

export type PossibleDuplicateSignalResponseDto = {
  signalId: string;
  status: 'UNRESOLVED' | 'RESOLVED';
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByIdentityId?: string;
};

export type PassportInternalStatusResponseDto = PassportStatusResponseDto & {
  possibleDuplicate: 'NONE' | 'UNRESOLVED' | 'RESOLVED_DIFFERENT' | 'RETURNED_FOR_CORRECTION' | 'CONFIRMED_EXISTING';
};

export function toPassportInternalStatusResponse(
  record: PassportStatusProjection,
  capabilities: readonly PassportAction[],
  signals: readonly PossibleDuplicateSignalProjection[],
): PassportInternalStatusResponseDto {
  const base = toPassportStatusResponse(record, capabilities);
  const response: PassportInternalStatusResponseDto = {
    ...base,
    possibleDuplicate: mapPossibleDuplicate(signals),
  };
  return response;
}

function mapPossibleDuplicate(signals: readonly PossibleDuplicateSignalProjection[]): PassportInternalStatusResponseDto['possibleDuplicate'] {
  if (signals.some((signal) => signal.status === 'UNRESOLVED')) return 'UNRESOLVED';
  const resolution = [...signals].reverse().find((signal) => signal.resolution)?.resolution;
  if (resolution === 'DIFFERENT_PLAYERS') return 'RESOLVED_DIFFERENT';
  if (resolution === 'CORRECTABLE') return 'RETURNED_FOR_CORRECTION';
  if (resolution === 'CONFIRMED_EXISTING_PLAYER') return 'CONFIRMED_EXISTING';
  return 'NONE';
}

export function toPassportSummaryResponse(record: PassportStatusProjection, capabilities: readonly PassportAction[]): Readonly<{
  passportId: string;
  displayName: string;
  lifecycleState: PassportLifecycleState;
  origin: 'PARTICULAR' | 'ACADEMY' | 'HISTORICAL_TUTOR';
  academyOriginName: string | null;
  availableActions: readonly PassportAction[];
}> {
  return {
    passportId: record.id,
    displayName: record.displayName ?? '',
    lifecycleState: record.state,
    origin: mapPassportOrigin(record.originKind),
    academyOriginName: record.academyOriginName ?? null,
    availableActions: capabilities,
  };
}

export function toPassportListResponse(
  summaries: readonly ReturnType<typeof toPassportSummaryResponse>[],
  capabilities: readonly PassportCollectionAction[],
  context: 'PARTICULAR' | 'ACADEMY',
): Readonly<{
  context: 'PARTICULAR' | 'ACADEMY';
  passports: readonly ReturnType<typeof toPassportSummaryResponse>[];
  collectionActions: readonly string[];
}> {
  return {
    context,
    passports: summaries,
    collectionActions: [context === 'PARTICULAR' ? 'VIEW_PARTICULAR_SELECTOR' : 'VIEW_ACADEMY_PORTFOLIO', ...(capabilities.includes('create') ? context === 'PARTICULAR' ? ['CREATE_SELF', 'CREATE_REPRESENTED_MINOR'] : ['CREATE_ACADEMY'] : [])],
  };
}

export function toPassportPresentationResponse(record: PassportPresentationProjection, _capabilities: readonly PassportAction[]): Readonly<{
  passportId: string;
  lifecycleState: PassportLifecycleState;
  identity: Readonly<{
    displayName: string;
    primaryPosition: Readonly<{ availability: 'AVAILABLE'; value: string }>;
    declaredAgeCategory: Readonly<{ availability: 'AVAILABLE'; value: string }>;
    city: Readonly<{ availability: 'AVAILABLE'; value: string }>;
    country: Readonly<{ availability: 'AVAILABLE'; value: string }>;
    dominantFoot: Readonly<{ availability: 'AVAILABLE'; value: string }>;
    academyOrigin: Readonly<{ availability: 'AVAILABLE' | 'UNAVAILABLE'; value: string | null }>;
    photograph: Readonly<{ state: 'NEUTRAL_LOCAL_PLACEHOLDER' }>;
  }>;
  sections: readonly Readonly<{ section: 'SUMMARY' | 'STATISTICS' | 'MATCHES' | 'VIDEOS'; availability: 'AVAILABLE' | 'FUTURE_DEPENDENCY'; dependency: 'STATISTICS_FEM' | 'MATCHES' | 'AUDIOVISUAL' | null }>[];
}> {
  return {
    passportId: record.id,
    lifecycleState: record.state,
    identity: {
      displayName: record.displayName ?? '',
      primaryPosition: { availability: 'AVAILABLE', value: record.position },
      declaredAgeCategory: { availability: 'AVAILABLE', value: record.ageCategory },
      city: { availability: 'AVAILABLE', value: record.city },
      country: { availability: 'AVAILABLE', value: record.country },
      dominantFoot: { availability: 'AVAILABLE', value: mapPassportDominantFoot(record.dominantFoot) },
      academyOrigin: { availability: record.academyOriginName ? 'AVAILABLE' : 'UNAVAILABLE', value: record.academyOriginName ?? null },
      photograph: { state: 'NEUTRAL_LOCAL_PLACEHOLDER' },
    },
    sections: [
      { section: 'SUMMARY', availability: 'AVAILABLE', dependency: null },
      { section: 'STATISTICS', availability: 'FUTURE_DEPENDENCY', dependency: 'STATISTICS_FEM' },
      { section: 'MATCHES', availability: 'FUTURE_DEPENDENCY', dependency: 'MATCHES' },
      { section: 'VIDEOS', availability: 'FUTURE_DEPENDENCY', dependency: 'AUDIOVISUAL' },
    ],
  };
}

export function toPassportHistoryResponse(history: Readonly<{ passportId: string; events: readonly LifecycleEventProjection[] }>): Readonly<{
  passportId: string;
  events: ReadonlyArray<Readonly<{
    eventId: string;
    action: string;
    outcome: string;
    priorState: string | null;
    resultingState: string | null;
    actorIdentityId: string;
    details: Record<string, unknown>;
    createdAt: string;
  }>>;
}> {
  return {
    passportId: history.passportId,
    events: history.events.map((event) => ({
      eventId: event.id,
      action: mapLifecycleAction(event.action),
      outcome: event.outcome,
      priorState: event.priorState ? mapPassportState(event.priorState) : null,
      resultingState: event.resultingState ? mapPassportState(event.resultingState) : null,
      actorIdentityId: event.actorIdentityId,
      details: safeDetails(event.details),
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
