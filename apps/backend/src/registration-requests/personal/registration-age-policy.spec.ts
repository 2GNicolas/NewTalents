import { describe, expect, it } from 'vitest';

import { RegistrationAgePolicy } from './registration-age-policy.js';

describe('RegistrationAgePolicy', () => {
  const policy = new RegistrationAgePolicy();

  it('uses the Colombia calendar and the exact eighteenth birthday', () => {
    expect(policy.evaluate({ dateOfBirth: '2008-09-24', operationInstant: new Date('2026-09-24T05:00:00Z') })).toMatchObject({ classification: 'ADULT', age: 18 });
    expect(policy.evaluate({ dateOfBirth: '2008-09-25', operationInstant: new Date('2026-09-24T18:00:00Z') })).toMatchObject({ classification: 'MINOR', age: 17 });
    expect(policy.evaluate({ dateOfBirth: '2008-09-23', operationInstant: new Date('2026-09-24T04:59:59Z') })).toMatchObject({ classification: 'ADULT', age: 18 });
  });

  it('treats 1 March as the anniversary of 29 February in a non-leap year', () => {
    expect(policy.evaluate({ dateOfBirth: '2008-02-29', operationInstant: new Date('2026-03-01T05:00:00Z') }).classification).toBe('ADULT');
    expect(policy.evaluate({ dateOfBirth: '2008-02-29', operationInstant: new Date('2026-03-01T04:59:59Z') }).classification).toBe('MINOR');
  });

  it('re-evaluates at submit and approval instead of persisting a client classification', () => {
    expect(policy.routeCompatibility('PERSONAL_ADULT', '2008-09-24', new Date('2026-09-23T18:00:00Z'))).toEqual({ compatible: false, classification: 'MINOR' });
    expect(policy.routeCompatibility('PERSONAL_ADULT', '2008-09-24', new Date('2026-09-24T18:00:00Z'))).toEqual({ compatible: true, classification: 'ADULT' });
    expect(policy.routeCompatibility('REPRESENTED_MINOR', '2008-09-24', new Date('2026-09-24T18:00:00Z'))).toEqual({ compatible: false, classification: 'ADULT' });
  });

  it('rejects client isAdult authority, invalid dates and future births', () => {
    expect(() => policy.evaluate({ dateOfBirth: '2008-09-24', operationInstant: new Date('2026-09-24T18:00:00Z'), clientIsAdult: true })).toThrow('CLIENT_AGE_AUTHORITY_FORBIDDEN');
    expect(() => policy.evaluate({ dateOfBirth: '2008-02-30', operationInstant: new Date('2026-09-24T18:00:00Z') })).toThrow('INVALID_DATE_OF_BIRTH');
    expect(() => policy.evaluate({ dateOfBirth: '2027-01-01', operationInstant: new Date('2026-09-24T18:00:00Z') })).toThrow('INVALID_DATE_OF_BIRTH');
  });
});
