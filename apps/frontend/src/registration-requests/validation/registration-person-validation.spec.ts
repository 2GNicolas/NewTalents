import type { RegistrationDraft } from '../registration-request-api';
import { validateCompletedRegistrationDraft } from '../flows/registration-submission';
import { formatRegistrationDateInput } from '../components/registration-journey';
import { documentTypesForSubject, isDocumentTypeAllowedForSubject, isMunicipalityCode, municipalityLabel, validateBirthDate, validateDocumentNumber } from './registration-person-validation';

const adult = { legalNames: 'Ana', legalSurnames: 'Pérez', documentType: 'CC', documentNumber: '12345678', birthDate: '1990-02-28', country: 'CO', city: '11001' };
const minor = { ...adult, documentType: 'RC', documentNumber: '1000641', birthDate: '2014-02-28' };
const consent = { privacyVersion: '2026-09', privacyAccepted: true as const, truthfulnessAccepted: true as const };
const credentials = { email: 'persona@example.test', password: 'clave-sintetica-segura', passwordConfirmation: 'clave-sintetica-segura' };

const completeDrafts: readonly RegistrationDraft[] = [
  { type: 'PERSONAL_ADULT', details: { credentials, person: adult, actingForSelf: true, consent } },
  { type: 'REPRESENTED_MINOR', details: { credentials, representative: { ...adult, phone: '3000000000' }, minor, relationship: 'MOTHER', authorityDeclared: true, consent: { ...consent, representationAccepted: true, minorTreatmentAccepted: true } } },
  { type: 'FORMAL_ACADEMY', details: { credentials, academy: { academyName: 'Academia Uno', country: 'CO', city: '11001', responsiblePerson: { ...adult, phone: '3000000000' } }, organizationType: 'SAS', nit: '901000001', authorityDeclared: true, consent } },
  { type: 'NATURAL_PERSON_ACADEMY', details: { credentials, academy: { academyName: 'Academia Dos', country: 'CO', city: '11001', responsiblePerson: { ...adult, phone: '3000000000' } }, operationDeclared: true, proofCategories: ['PLACE_USE_AUTHORIZATION'], consent } },
  { type: 'ADDITIONAL_ACADEMY_ACCOUNT', academyId: 'academy-1', details: { person: adult, function: 'Entrenador', responsibleAuthorization: true, consent } },
  { type: 'ACADEMY_ADULT_PLAYER', academyId: 'academy-1', details: { player: adult, adultAuthorization: true, consent: { ...consent, academyPresentationAccepted: true } } },
  { type: 'ACADEMY_MINOR_PLAYER', academyId: 'academy-1', details: { minor, representative: { ...adult, phone: '3000000000' }, relationship: 'MOTHER', authorityDeclared: true, consent: { ...consent, representationAccepted: true, minorTreatmentAccepted: true, academyPresentationAccepted: true } } },
];

describe('Colombia registration validation', () => {
  it('accepts legacy and current CC values without one arbitrary length', () => {
    expect(validateDocumentNumber('CC', '123')).toBeNull();
    expect(validateDocumentNumber('CC', '12345678')).toBeNull();
    expect(validateDocumentNumber('CC', '1234567890')).toBeNull();
    expect(validateDocumentNumber('CC', '12345678901')).toMatch(/3 y 10/);
    expect(validateDocumentNumber('CE', 'AB-12345')).toBeNull();
    expect(validateDocumentNumber('PASSPORT', 'PA12345')).toBeNull();
  });

  it('separates adult and minor document choices without losing foreign documents', () => {
    expect(documentTypesForSubject('adult')).toEqual(['CC', 'CE', 'PASSPORT']);
    expect(documentTypesForSubject('minor')).toEqual(['TI', 'RC', 'CE', 'PASSPORT']);
    expect(isDocumentTypeAllowedForSubject('RC', 'adult')).toBe(false);
    expect(isDocumentTypeAllowedForSubject('TI', 'adult')).toBe(false);
    expect(isDocumentTypeAllowedForSubject('RC', 'minor')).toBe(true);
    expect(isDocumentTypeAllowedForSubject('CC', 'minor')).toBe(false);
  });

  it('autoformats typed, pasted and edited date digits as YYYY-MM-DD', () => {
    expect(formatRegistrationDateInput('19900228')).toBe('1990-02-28');
    expect(formatRegistrationDateInput('1990/02/28')).toBe('1990-02-28');
    expect(formatRegistrationDateInput('1990-2')).toBe('1990-2');
    expect(formatRegistrationDateInput('1990-02-2')).toBe('1990-02-2');
    expect(formatRegistrationDateInput('199002')).toBe('1990-02');
  });

  it('rejects impossible and future dates while accepting YYYY-MM-DD', () => {
    const today = new Date('2026-09-29T12:00:00-05:00');
    expect(validateBirthDate('2024-02-29', today)).toBeNull();
    expect(validateBirthDate('2025-02-29', today)).toMatch(/no existe/);
    expect(validateBirthDate('2026-09-30', today)).toMatch(/futuro/);
    expect(validateBirthDate('29/09/2000', today)).toMatch(/AAAA-MM-DD/);
  });

  it('uses stable official DIVIPOLA codes and presents labels', () => {
    expect(isMunicipalityCode('11001')).toBe(true);
    expect(isMunicipalityCode('Bogotá')).toBe(false);
    expect(municipalityLabel('11001')).toMatch(/Bogotá.*Bogotá/i);
  });

  it.each(completeDrafts)('accepts a complete $type draft', (draft) => {
    expect(validateCompletedRegistrationDraft(draft)).toEqual([]);
  });

  it.each(completeDrafts)('rejects missing required data for $type', (draft) => {
    const broken = structuredClone(draft);
    const details = broken.details as unknown as Record<string, unknown>;
    if (details.person) (details.person as Record<string, unknown>).legalNames = '';
    else if (details.player) (details.player as Record<string, unknown>).legalNames = '';
    else if (details.minor) (details.minor as Record<string, unknown>).legalNames = '';
    else (details.academy as Record<string, unknown>).academyName = '';
    expect(validateCompletedRegistrationDraft(broken)).not.toHaveLength(0);
  });
});
