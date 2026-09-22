import { describe, expect, it } from 'vitest';

import {
  derivePassportCapabilities,
  mapPassportDominantFoot,
  mapPassportState,
  toPassportHistoryResponse,
  toPassportListResponse,
  toPassportPresentationResponse,
  toPassportSummaryResponse,
} from './passport-presentation-mapper.js';

const basePresentation = {
  id: '44444444-4444-4444-8444-444444444444',
  playerId: '33333333-3333-4333-8333-333333333333',
  state: 'DRAFT' as const,
  originKind: 'TUTOR' as const,
  position: 'Delantero',
  ageCategory: 'Sub-15',
  city: 'Medellín',
  country: 'Colombia',
  dominantFoot: 'LEFT' as const,
  originAcademyId: null,
  version: 1,
  createdAt: new Date('2026-09-16T10:00:00.000Z'),
  updatedAt: new Date('2026-09-16T10:05:00.000Z'),
  displayName: 'Nombre Autorizado',
};

describe('PassportPresentationMapper', () => {
  it('maps persisted enum values to the approved product-language values', () => {
    expect(mapPassportState('DRAFT')).toBe('Borrador');
    expect(mapPassportState('IN_REVIEW')).toBe('En revisión');
    expect(mapPassportState('RETURNED_FOR_CORRECTION')).toBe('Devuelto para corrección');
    expect(mapPassportState('APPROVED')).toBe('Aprobado');
    expect(mapPassportState('ACTIVE')).toBe('Activo');
    expect(mapPassportDominantFoot('LEFT')).toBe('Izquierda');
    expect(mapPassportDominantFoot('RIGHT')).toBe('Derecha');
    expect(mapPassportDominantFoot('BOTH')).toBe('Ambos');
    expect(mapPassportDominantFoot('UNDECLARED')).toBe('No declarado');
  });

  it('derives creator capabilities only while the passport is editable', () => {
    expect(derivePassportCapabilities({
      manage: true,
      review: false,
      activate: false,
      history: true,
      state: 'DRAFT',
      hasUnresolvedDuplicateSignal: false,
      hasConfirmedExistingPlayerResolution: false,
    })).toEqual(['EDIT', 'SUBMIT', 'VIEW_HISTORY']);

    expect(derivePassportCapabilities({
      manage: true,
      review: false,
      activate: false,
      history: true,
      state: 'RETURNED_FOR_CORRECTION',
      hasUnresolvedDuplicateSignal: false,
      hasConfirmedExistingPlayerResolution: false,
    })).toEqual(['EDIT', 'SUBMIT', 'VIEW_HISTORY']);
  });

  it('derives Analyst review capabilities based on duplicate-signal status', () => {
    expect(derivePassportCapabilities({
      manage: false,
      review: true,
      activate: false,
      history: true,
      state: 'IN_REVIEW',
      hasUnresolvedDuplicateSignal: true,
      hasConfirmedExistingPlayerResolution: false,
    })).toEqual(['RETURN', 'RESOLVE_DUPLICATE', 'VIEW_HISTORY']);

    expect(derivePassportCapabilities({
      manage: false,
      review: true,
      activate: false,
      history: true,
      state: 'IN_REVIEW',
      hasUnresolvedDuplicateSignal: false,
      hasConfirmedExistingPlayerResolution: false,
    })).toEqual(['RETURN', 'APPROVE', 'VIEW_HISTORY']);

    expect(derivePassportCapabilities({
      manage: false,
      review: true,
      activate: false,
      history: true,
      state: 'IN_REVIEW',
      hasUnresolvedDuplicateSignal: false,
      hasConfirmedExistingPlayerResolution: true,
    })).toEqual(['RETURN', 'VIEW_HISTORY']);
  });

  it('derives the separate Administrator activation capability only from the approved state', () => {
    expect(derivePassportCapabilities({
      manage: false,
      review: false,
      activate: true,
      history: true,
      state: 'APPROVED',
      hasUnresolvedDuplicateSignal: false,
      hasConfirmedExistingPlayerResolution: false,
    })).toEqual(['ACTIVATE', 'VIEW_HISTORY']);
  });

  it('builds a presentation projection with the approved identity fields and neutral placeholder only', () => {
    const result = toPassportPresentationResponse(basePresentation, ['VIEW_HISTORY']);

    expect(result).toEqual({
      passportId: basePresentation.id,
      lifecycleState: 'DRAFT',
      identity: {
        displayName: 'Nombre Autorizado',
        primaryPosition: { availability: 'AVAILABLE', value: 'Delantero' },
        declaredAgeCategory: { availability: 'AVAILABLE', value: 'Sub-15' },
        city: { availability: 'AVAILABLE', value: 'Medellín' },
        country: { availability: 'AVAILABLE', value: 'Colombia' },
        dominantFoot: { availability: 'AVAILABLE', value: 'Izquierda' },
        academyOrigin: { availability: 'UNAVAILABLE', value: null },
        photograph: { state: 'NEUTRAL_LOCAL_PLACEHOLDER' },
      },
      sections: [
        { section: 'SUMMARY', availability: 'AVAILABLE', dependency: null },
        { section: 'STATISTICS', availability: 'FUTURE_DEPENDENCY', dependency: 'STATISTICS_FEM' },
        { section: 'MATCHES', availability: 'FUTURE_DEPENDENCY', dependency: 'MATCHES' },
        { section: 'VIDEOS', availability: 'FUTURE_DEPENDENCY', dependency: 'AUDIOVISUAL' },
      ],
    });

    expect(JSON.stringify(result)).not.toContain('dateOfBirth');
    expect(JSON.stringify(result)).not.toContain('documentNumber');
    expect(JSON.stringify(result)).not.toContain('documentFingerprint');
    expect(JSON.stringify(result)).not.toContain('nameDobFingerprint');
    expect(JSON.stringify(result)).not.toContain('originAcademyId');
  });

  it('projects the authorized academy-of-origin display name without contact data', () => {
    const result = toPassportPresentationResponse({ ...basePresentation, originKind: 'ACADEMY', academyOriginName: 'Academia Prueba' }, []);
    expect(result.identity.academyOrigin).toEqual({ availability: 'AVAILABLE', value: 'Academia Prueba' });
    expect(JSON.stringify(result)).not.toMatch(/email|phone|address|contact/i);
  });

  it('builds a list projection with collection creation capability when authorized', () => {
    const summary = toPassportSummaryResponse(basePresentation, ['VIEW_HISTORY']);
    expect(toPassportListResponse([summary], ['create'], 'PARTICULAR')).toEqual({
      context: 'PARTICULAR',
      passports: [summary],
      collectionActions: ['VIEW_PARTICULAR_SELECTOR', 'CREATE_SELF', 'CREATE_REPRESENTED_MINOR'],
    });
  });

  it('maps a redacted lifecycle history without copying event details outside the approved safe keys', () => {
    const result = toPassportHistoryResponse({
      passportId: '44444444-4444-4444-8444-444444444444',
      events: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          action: 'CREATED',
          outcome: 'APPLIED',
          actorIdentityId: '11111111-1111-4111-8111-111111111111',
          priorState: null,
          resultingState: 'DRAFT',
          details: {},
          createdAt: new Date('2026-09-16T10:00:00.000Z'),
        },
        {
          id: '77777777-7777-4777-8777-777777777777',
          action: 'RETURNED_FOR_CORRECTION',
          outcome: 'APPLIED',
          actorIdentityId: '55555555-5555-4555-8555-555555555555',
          priorState: 'IN_REVIEW',
          resultingState: 'RETURNED_FOR_CORRECTION',
          details: { reason: 'Corrige la categoría declarada' },
          createdAt: new Date('2026-09-16T10:10:00.000Z'),
        },
      ],
    });

    expect(result).toEqual({
      passportId: '44444444-4444-4444-8444-444444444444',
      events: [
        {
          eventId: '66666666-6666-4666-8666-666666666666',
          action: 'CREATED',
          outcome: 'APPLIED',
          priorState: null,
          resultingState: 'Borrador',
          actorIdentityId: '11111111-1111-4111-8111-111111111111',
          details: {},
          createdAt: '2026-09-16T10:00:00.000Z',
        },
        {
          eventId: '77777777-7777-4777-8777-777777777777',
          action: 'RETURNED',
          outcome: 'APPLIED',
          priorState: 'En revisión',
          resultingState: 'Devuelto para corrección',
          actorIdentityId: '55555555-5555-4555-8555-555555555555',
          details: { reason: 'Corrige la categoría declarada' },
          createdAt: '2026-09-16T10:10:00.000Z',
        },
      ],
    });
  });
});
