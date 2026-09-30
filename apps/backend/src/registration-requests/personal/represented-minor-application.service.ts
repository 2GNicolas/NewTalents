import { Injectable } from '@nestjs/common';

import { RegistrationAgePolicy } from './registration-age-policy.js';
import { isValidRegistrationPerson } from '../validation/registration-person.validation.js';

const RELATIONSHIPS = new Set(['MOTHER', 'FATHER', 'LEGAL_GUARDIAN']);
const REQUIRED_EVIDENCE = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'MINOR_CIVIL_IDENTITY', 'REPRESENTATION_AUTHORITY'] as const;
const MINOR_FORBIDDEN = new Set(['email', 'phone', 'password', 'passwordConfirmation', 'account', 'credentials', 'isAdult']);

export type RepresentedMinorValidation = Readonly<{ complete: boolean; code?: 'INVALID_REPRESENTED_MINOR_DRAFT' }>;

@Injectable()
export class RepresentedMinorApplicationService {
  constructor(private readonly agePolicy: RegistrationAgePolicy = new RegistrationAgePolicy()) {}

  async validate(value: unknown): Promise<RepresentedMinorValidation> {
    return this.validateInternal(value, true);
  }

  async validateDraft(value: unknown): Promise<RepresentedMinorValidation> {
    return this.validateInternal(value, false);
  }

  private async validateInternal(value: unknown, requireEvidence: boolean): Promise<RepresentedMinorValidation> {
    try {
      const input = this.record(value);
      if ('isAdult' in input) return this.invalid();
      const representative = this.record(input.representative);
      const minor = this.record(input.minor);
      const consent = this.record(input.consent);
      const operationInstant = input.operationInstant instanceof Date ? input.operationInstant : new Date();
      const identity = ['legalNames', 'legalSurnames', 'documentType', 'documentNumber', 'birthDate', 'country', 'city'];
      if (!identity.every((field) => this.text(representative[field])) || !this.text(representative.phone)) return this.invalid();
      if (!identity.every((field) => this.text(minor[field])) || [...MINOR_FORBIDDEN].some((field) => field in minor)) return this.invalid();
      if (!isValidRegistrationPerson(representative, 'adult', operationInstant) || !isValidRegistrationPerson(minor, 'minor', operationInstant)) return this.invalid();
      if (this.agePolicy.evaluate({ dateOfBirth: String(representative.birthDate), operationInstant }).classification !== 'ADULT') return this.invalid();
      if (!this.agePolicy.routeCompatibility('REPRESENTED_MINOR', String(minor.birthDate), operationInstant).compatible) return this.invalid();
      if (!RELATIONSHIPS.has(String(input.relationship)) || input.authorityDeclared !== true) return this.invalid();
      if (!this.text(consent.privacyVersion, 40) || consent.privacyAccepted !== true || consent.truthfulnessAccepted !== true || consent.representationAccepted !== true || consent.minorTreatmentAccepted !== true) return this.invalid();
      if (requireEvidence && !this.exactEvidence(input.evidence, REQUIRED_EVIDENCE)) return this.invalid();
      return Object.freeze({ complete: true });
    } catch {
      return this.invalid();
    }
  }

  private invalid(): RepresentedMinorValidation { return Object.freeze({ complete: false, code: 'INVALID_REPRESENTED_MINOR_DRAFT' }); }
  private record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid'); return value as Record<string, unknown>; }
  private text(value: unknown, max = 180): boolean { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max; }
  private exactEvidence(value: unknown, required: readonly string[]): boolean {
    return Array.isArray(value) && value.length === required.length && new Set(value).size === value.length && required.every((item) => value.includes(item));
  }
}
