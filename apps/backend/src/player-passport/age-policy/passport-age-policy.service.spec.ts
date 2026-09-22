import { describe, expect, it } from 'vitest';
import { PassportAgePolicyService } from './passport-age-policy.service.js';

describe('PassportAgePolicyService', () => {
  const service = new PassportAgePolicyService();
  it('uses Colombia calendar dates and the exact 18th birthday', () => {
    expect(service.classify('2008-09-21', new Date('2026-09-21T05:00:00Z'))).toBe('ADULT');
    expect(service.classify('2008-09-22', new Date('2026-09-21T18:00:00Z'))).toBe('MINOR');
  });
  it('ignores client clock time and applies the 29-February rule', () => {
    expect(service.classify('2008-02-29', new Date('2026-03-01T06:00:00Z'))).toBe('ADULT');
    expect(service.classify('2008-02-29', new Date('2026-02-28T23:00:00Z'))).toBe('MINOR');
  });
  it('rejects future and invalid dates', () => {
    expect(() => service.classify('2027-01-01', new Date('2026-01-01T12:00:00Z'))).toThrow('INVALID_DATE_OF_BIRTH');
    expect(() => service.classify('not-a-date', new Date('2026-01-01T12:00:00Z'))).toThrow('INVALID_DATE_OF_BIRTH');
  });
});
