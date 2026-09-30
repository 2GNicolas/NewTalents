import { describe, expect, it } from 'vitest';

import { parsePersonalAdultCreate } from '../http/registration-request.dto.js';
import { isDocumentTypeAllowedForSubject, isValidBirthDate, isValidColombiaDocument, isValidColombiaLocation, isValidRegistrationPerson } from './registration-person.validation.js';

const valid = {
  credentials: { email: 'persona@example.test', password: 'clave-sintetica-segura', passwordConfirmation: 'clave-sintetica-segura' },
  person: { legalNames: 'Ana', legalSurnames: 'Pérez', documentType: 'CC', documentNumber: '12345678', birthDate: '1990-02-28', country: 'CO', city: '11001' },
  actingForSelf: true,
  consent: { privacyVersion: '2026-09', privacyAccepted: true, truthfulnessAccepted: true },
};

describe('registration person validation', () => {
  it('supports approved document types and legacy citizenship numbers', () => {
    expect(isValidColombiaDocument('CC', '123')).toBe(true);
    expect(isValidColombiaDocument('CC', '1234567890')).toBe(true);
    expect(isValidColombiaDocument('CC', '12345678901')).toBe(false);
    expect(isValidColombiaDocument('RC', 'ABC-12345')).toBe(true);
    expect(isValidColombiaDocument('PASSPORT', 'PA12345')).toBe(true);
    expect(isValidColombiaDocument('UNSUPPORTED', '12345')).toBe(false);
  });

  it('enforces adult/minor document types at the shared backend boundary', () => {
    expect(isDocumentTypeAllowedForSubject('CC', 'adult')).toBe(true);
    expect(isDocumentTypeAllowedForSubject('TI', 'adult')).toBe(false);
    expect(isDocumentTypeAllowedForSubject('RC', 'adult')).toBe(false);
    expect(isDocumentTypeAllowedForSubject('RC', 'minor')).toBe(true);
    expect(isDocumentTypeAllowedForSubject('CC', 'minor')).toBe(false);
    expect(isValidRegistrationPerson(valid.person, 'adult', new Date('2026-09-29T17:00:00Z'))).toBe(true);
    expect(isValidRegistrationPerson({ ...valid.person, documentType: 'RC', documentNumber: 'ABC-12345' }, 'adult', new Date('2026-09-29T17:00:00Z'))).toBe(false);
  });

  it('rejects impossible/future dates and non-DIVIPOLA locations', () => {
    const now = new Date('2026-09-29T17:00:00Z');
    expect(isValidBirthDate('2024-02-29', now)).toBe(true);
    expect(isValidBirthDate('2025-02-29', now)).toBe(false);
    expect(isValidBirthDate('2026-09-30', now)).toBe(false);
    expect(isValidColombiaLocation('CO', '11001')).toBe(true);
    expect(isValidColombiaLocation('Colombia', 'Bogotá')).toBe(false);
  });

  it('applies the same constraints at the HTTP boundary', () => {
    expect(parsePersonalAdultCreate(valid).ok).toBe(true);
    const invalid = structuredClone(valid);
    invalid.person.birthDate = '2025-02-29';
    invalid.person.city = 'Bogotá';
    const result = parsePersonalAdultCreate(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((issue) => issue.field)).toEqual(expect.arrayContaining(['person.birthDate', 'person.city']));
  });
});
