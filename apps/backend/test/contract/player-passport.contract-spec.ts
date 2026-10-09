import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { PassportController, PassportRepresentationController } from '../../src/player-passport/http/passport.controller.js';
import { parseCreateDraftRequest, parseEditDraftRequest, parseListAcademyId, parseListContext, parseRepresentationConfirmationRequest, parseVersionRequest } from '../../src/player-passport/http/passport.dto.js';

const routes = PassportController.prototype as unknown as Record<string, Function>;

describe('corrective player-passport HTTP contract', () => {
  it('defines the representative-confirmation request contract', () => {
    const confirmationRoutes = PassportRepresentationController.prototype as unknown as Record<string, Function>;
    expect(Reflect.getMetadata(PATH_METADATA, PassportRepresentationController)).toBe('passport-representation-confirmations');
    expect(Reflect.getMetadata(METHOD_METADATA, confirmationRoutes.createRepresentativeConfirmation!)).toBe(RequestMethod.POST);
    expect(parseRepresentationConfirmationRequest({
      playerDocument: { documentType: 'TI', documentNumber: '1000000000' },
      representative: { legalName: 'Representante', documentType: 'CC', documentNumber: '2000000000', relationship: 'MOTHER', authorityConfirmed: true },
    }).ok).toBe(true);
  });

  it.each([
    ['SELF', { managementContext: 'SELF', dateOfBirth: '2000-09-21' }],
    ['LEGAL_REPRESENTATIVE', { managementContext: 'LEGAL_REPRESENTATIVE', dateOfBirth: '2012-09-21', representative: { legalName: 'Representante', documentType: 'CC', documentNumber: '2000000000', relationship: 'MOTHER', authorityConfirmed: true } }],
    ['ACADEMY', { managementContext: 'ACADEMY', dateOfBirth: '2000-09-21', academyId: '22222222-2222-4222-8222-222222222222' }],
  ])('accepts explicit %s creation authority', (_kind, authority) => {
    expect(parseCreateDraftRequest({
      ...authority,
      playerLegalName: 'Jugador Ejemplo',
      playerDocument: { documentType: 'CC', documentNumber: '1000000000' },
      footballProfile: { primaryPosition: 'Defensa', declaredAgeCategory: 'Sub-23', city: 'Bogotá', country: 'Colombia', dominantFoot: 'RIGHT' },
    }).ok).toBe(true);
  });

  it('defines protected private draft detail and birth-date edit', () => {
    expect(routes.privateDraft).toBeTypeOf('function');
    expect(parseEditDraftRequest({ dateOfBirth: '2008-09-21', expectedVersion: 1 }).ok).toBe(true);
    expect(parseEditDraftRequest({ footballProfile: { primaryPosition: 'Portero', declaredAgeCategory: 'Sub-18', city: 'Bogota', country: 'Colombia', dominantFoot: 'RIGHT' }, expectedVersion: 0 }).ok).toBe(false);
  });

  it('requires an explicit PARTICULAR or ACADEMY list context', () => {
    expect(parseListContext('PARTICULAR')).toBe('PARTICULAR');
    expect(parseListContext('ACADEMY')).toBe('ACADEMY');
    expect(parseListContext(undefined)).toBeNull();
    expect(parseListAcademyId('ACADEMY', '22222222-2222-4222-8222-222222222222')).toBe('22222222-2222-4222-8222-222222222222');
    expect(parseListAcademyId('ACADEMY', undefined)).toBeNull();
    expect(parseListAcademyId('PARTICULAR', '22222222-2222-4222-8222-222222222222')).toBeNull();
    expect(parseVersionRequest({ expectedVersion: 1 }).ok).toBe(true);
  });

  it('exposes structurally separate ordinary and internal history endpoints', () => {
    expect(Reflect.getMetadata(PATH_METADATA, routes.history!)).toBe(':passportId/history');
    expect(Reflect.getMetadata(METHOD_METADATA, routes.history!)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, routes.internalHistory!)).toEqual([':passportId/internal-history', ':passportId/history/internal']);
    expect(Reflect.getMetadata(METHOD_METADATA, routes.internalHistory!)).toBe(RequestMethod.GET);
  });

  it('rejects caller-provided isAdult as an authoritative field', () => {
    expect(parseCreateDraftRequest({
      managementContext: 'SELF', playerLegalName: 'Jugador Ejemplo', dateOfBirth: '2008-09-21',
      playerDocument: { documentType: 'TI', documentNumber: '1000000000' },
      footballProfile: { primaryPosition: 'Defensa', declaredAgeCategory: 'Sub-18', city: 'Bogotá', country: 'Colombia', dominantFoot: 'RIGHT' },
      isAdult: true,
    })).toEqual({ ok: false, error: 'invalid_request' });
  });
});
