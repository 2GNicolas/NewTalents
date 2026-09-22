import { describe, expect, it } from 'vitest';

import {
  normalizeDateOfBirth,
  normalizeDocumentNumber,
  normalizeDocumentType,
  normalizeIdentityText,
  normalizeLegalName,
} from './identity-normalization.js';

describe('identity normalization', () => {
  it('trims, collapses whitespace, uppercases, and canonicalizes NFC', () => {
    expect(normalizeIdentityText('  mateo   gonzález  ')).toBe('MATEO GONZÁLEZ');
    expect(normalizeIdentityText('\tNATALIA\u0301  RUIZ\n')).toBe('NATALIÁ RUIZ');
  });

  it('applies the same exact rules to legal name and document type', () => {
    expect(normalizeLegalName('  mateo   gonzález  ')).toBe('MATEO GONZÁLEZ');
    expect(normalizeDocumentType('  cédula  de  ciudadanía ')).toBe('CÉDULA DE CIUDADANÍA');
  });

  it('normalizes document numbers by trimming, collapsing whitespace, and uppercasing without inventing separator rules', () => {
    expect(normalizeDocumentNumber('  1 234 567-890  ')).toBe('1 234 567-890');
    expect(normalizeDocumentNumber('  abc-12-34  ')).toBe('ABC-12-34');
  });

  it('canonicalizes valid dates as YYYY-MM-DD', () => {
    expect(normalizeDateOfBirth('  2026-09-16  ')).toBe('2026-09-16');
  });

  it.each([
    ['normalizeIdentityText', (value: string) => normalizeIdentityText(value)],
    ['normalizeLegalName', (value: string) => normalizeLegalName(value)],
    ['normalizeDocumentType', (value: string) => normalizeDocumentType(value)],
    ['normalizeDocumentNumber', (value: string) => normalizeDocumentNumber(value)],
  ])('%s rejects empty or whitespace-only values without echoing the value', (_name, normalize) => {
    expect(() => normalize('')).toThrow('Invalid identity input');
    expect(() => normalize('   ')).toThrow('Invalid identity input');
  });

  it.each(['2026-9-16', '16-09-2026', '2026/09/16', '', '  '])('rejects invalid date %s without echoing it', (value) => {
    expect(() => normalizeDateOfBirth(value)).toThrow('Invalid identity input: dateOfBirth');
  });
});
