import { COLOMBIA_MUNICIPALITY_CODES } from './colombia-municipality-codes.js';

export const COLOMBIA_DOCUMENT_TYPES = ['CC', 'TI', 'RC', 'CE', 'PASSPORT'] as const;
export type ColombiaDocumentType = typeof COLOMBIA_DOCUMENT_TYPES[number];
export type RegistrationPersonSubject = 'adult' | 'minor';
export const ADULT_DOCUMENT_TYPES: readonly ColombiaDocumentType[] = ['CC', 'CE', 'PASSPORT'];
export const MINOR_DOCUMENT_TYPES: readonly ColombiaDocumentType[] = ['TI', 'RC', 'CE', 'PASSPORT'];

const documentPatterns: Readonly<Record<ColombiaDocumentType, RegExp>> = {
  CC: /^\d{3,10}$/,
  TI: /^\d{5,11}$/,
  RC: /^[A-Z0-9-]{5,20}$/,
  CE: /^[A-Z0-9-]{3,15}$/,
  PASSPORT: /^[A-Z0-9-]{5,16}$/,
};

export function isValidColombiaDocument(type: unknown, number: unknown): boolean {
  if (typeof type !== 'string' || !COLOMBIA_DOCUMENT_TYPES.includes(type as ColombiaDocumentType) || typeof number !== 'string') return false;
  return documentPatterns[type as ColombiaDocumentType].test(number.trim().toUpperCase().replace(/\s+/g, ''));
}

export function isDocumentTypeAllowedForSubject(type: unknown, subject: RegistrationPersonSubject): boolean {
  if (typeof type !== 'string') return false;
  return (subject === 'adult' ? ADULT_DOCUMENT_TYPES : MINOR_DOCUMENT_TYPES).includes(type as ColombiaDocumentType);
}

export function isValidBirthDate(value: unknown, operationInstant = new Date()): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month! - 1 || parsed.getUTCDate() !== day) return false;
  const today = new Date(Date.UTC(operationInstant.getUTCFullYear(), operationInstant.getUTCMonth(), operationInstant.getUTCDate()));
  return parsed <= today;
}

export function isValidColombiaLocation(country: unknown, municipalityCode: unknown): boolean {
  return country === 'CO' && typeof municipalityCode === 'string' && COLOMBIA_MUNICIPALITY_CODES.has(municipalityCode);
}

export function isValidRegistrationPerson(value: Record<string, unknown>, subject: RegistrationPersonSubject, operationInstant = new Date()): boolean {
  return isDocumentTypeAllowedForSubject(value.documentType, subject)
    && isValidColombiaDocument(value.documentType, value.documentNumber)
    && isValidBirthDate(value.birthDate, operationInstant)
    && isValidColombiaLocation(value.country, value.city);
}
