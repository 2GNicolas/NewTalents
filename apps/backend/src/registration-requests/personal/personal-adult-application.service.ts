import { Injectable } from '@nestjs/common';

import { RegistrationAgePolicy } from './registration-age-policy.js';
import { isValidRegistrationPerson } from '../validation/registration-person.validation.js';

const REQUIRED_EVIDENCE = ['IDENTITY_BACK', 'IDENTITY_FRONT'] as const;
const RESERVED_FIELDS = new Set(['isAdult', 'position', 'ageCategory', 'dominantFoot', 'sportsData']);

export type PersonalAdultValidation = Readonly<{
  complete: boolean;
  applicantIsPlayer?: true;
  code?: 'INVALID_PERSONAL_ADULT_DRAFT';
}>;

@Injectable()
export class PersonalAdultApplicationService {
  constructor(private readonly agePolicy: RegistrationAgePolicy = new RegistrationAgePolicy()) {}

  async validate(value: unknown): Promise<PersonalAdultValidation> {
    return this.validateInternal(value, true);
  }

  async validateDraft(value: unknown): Promise<PersonalAdultValidation> {
    return this.validateInternal(value, false);
  }

  private async validateInternal(value: unknown, requireEvidence: boolean): Promise<PersonalAdultValidation> {
    try {
      const input = this.record(value);
      if ([...RESERVED_FIELDS].some((field) => field in input)) return this.invalid();
      const person = this.record(input.person);
      const consent = this.record(input.consent);
      const operationInstant = input.operationInstant instanceof Date ? input.operationInstant : new Date();
      const requiredPerson = ['legalNames', 'legalSurnames', 'documentType', 'documentNumber', 'birthDate', 'country', 'city'];
      if (!requiredPerson.every((field) => this.text(person[field]))) return this.invalid();
      if (!isValidRegistrationPerson(person, 'adult', operationInstant)) return this.invalid();
      if ('isAdult' in person || [...RESERVED_FIELDS].some((field) => field in person)) return this.invalid();
      if (person.phone !== undefined && !this.text(person.phone)) return this.invalid();
      if (!this.agePolicy.routeCompatibility('PERSONAL_ADULT', String(person.birthDate), operationInstant).compatible) return this.invalid();
      if (input.actingForSelf !== true) return this.invalid();
      if (!this.text(consent.privacyVersion, 40) || consent.privacyAccepted !== true || consent.truthfulnessAccepted !== true || consent.selfActionAccepted === false) return this.invalid();
      if (requireEvidence && !this.exactEvidence(input.evidence, REQUIRED_EVIDENCE)) return this.invalid();
      return Object.freeze({ complete: true, applicantIsPlayer: true });
    } catch {
      return this.invalid();
    }
  }

  private invalid(): PersonalAdultValidation { return Object.freeze({ complete: false, code: 'INVALID_PERSONAL_ADULT_DRAFT' }); }
  private record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid'); return value as Record<string, unknown>; }
  private text(value: unknown, max = 180): boolean { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max; }
  private exactEvidence(value: unknown, required: readonly string[]): boolean {
    return Array.isArray(value) && value.length === required.length && new Set(value).size === value.length && required.every((item) => value.includes(item));
  }
}
