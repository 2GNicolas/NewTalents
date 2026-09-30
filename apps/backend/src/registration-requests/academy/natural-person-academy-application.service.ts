import { Injectable } from '@nestjs/common';

import { RegistrationAgePolicy } from '../personal/registration-age-policy.js';
import { isValidColombiaLocation, isValidRegistrationPerson } from '../validation/registration-person.validation.js';

const PROOFS = new Set(['RUT', 'MUNICIPAL_OR_SPORT_CERTIFICATION', 'PLACE_USE_AUTHORIZATION', 'OPERATION_CONTRACT_OR_REGISTER', 'OTHER_CONTROLLED']);
const EVIDENCE = ['OPERATION_PROOF', 'RESPONSIBLE_AUTHORITY'] as const;
const ALLOWED = new Set(['academy', 'responsiblePerson', 'operationDeclared', 'proofCategories', 'consent', 'evidence', 'operationInstant', 'credentials']);

type Validation = Readonly<{ complete: boolean; code?: 'INVALID_NATURAL_PERSON_ACADEMY_DRAFT'; legalCertificationClaimed: false; academyOperable: false; grantedRoles: readonly [] }>;

@Injectable()
export class NaturalPersonAcademyApplicationService {
  constructor(private readonly agePolicy: RegistrationAgePolicy = new RegistrationAgePolicy()) {}

  validate(value: unknown): Promise<Validation> { return this.validateInternal(value, true); }
  validateDraft(value: unknown): Promise<Validation> { return this.validateInternal(value, false); }

  private async validateInternal(value: unknown, requireEvidence: boolean): Promise<Validation> {
    try {
      const input = this.record(value);
      if (Object.keys(input).some((field) => !ALLOWED.has(field))) return this.invalid();
      const academy = this.record(input.academy);
      const responsible = this.record(input.responsiblePerson ?? academy.responsiblePerson);
      const consent = this.record(input.consent);
      if (!this.text(academy.academyName, 180) || !this.text(academy.country, 80) || !this.text(academy.city, 120)) return this.invalid();
      if (!isValidColombiaLocation(academy.country, academy.city)) return this.invalid();
      if (academy.trainingPlace !== undefined && !this.text(academy.trainingPlace, 180)) return this.invalid();
      const identity = ['legalNames', 'legalSurnames', 'documentType', 'documentNumber', 'birthDate', 'country', 'city'];
      if (!identity.every((field) => this.text(responsible[field])) || !this.text(responsible.phone, 40)) return this.invalid();
      const operationInstant = input.operationInstant instanceof Date ? input.operationInstant : new Date();
      if (!isValidRegistrationPerson(responsible, 'adult', operationInstant)) return this.invalid();
      if (this.agePolicy.evaluate({ dateOfBirth: String(responsible.birthDate), operationInstant }).classification !== 'ADULT') return this.invalid();
      if (input.operationDeclared !== true) return this.invalid();
      if (!Array.isArray(input.proofCategories) || input.proofCategories.length === 0 || new Set(input.proofCategories).size !== input.proofCategories.length || !input.proofCategories.every((item) => typeof item === 'string' && PROOFS.has(item))) return this.invalid();
      if (!this.text(consent.privacyVersion, 40) || consent.privacyAccepted !== true || consent.truthfulnessAccepted !== true) return this.invalid();
      if (requireEvidence && !this.exactEvidence(input.evidence)) return this.invalid();
      return Object.freeze({ complete: true, legalCertificationClaimed: false, academyOperable: false, grantedRoles: Object.freeze([] as const) });
    } catch { return this.invalid(); }
  }

  private exactEvidence(value: unknown) { return Array.isArray(value) && value.length === EVIDENCE.length && new Set(value).size === value.length && EVIDENCE.every((item) => value.includes(item)); }
  private text(value: unknown, max = 180) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max; }
  private record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid'); return value as Record<string, unknown>; }
  private invalid(): Validation { return Object.freeze({ complete: false, code: 'INVALID_NATURAL_PERSON_ACADEMY_DRAFT', legalCertificationClaimed: false, academyOperable: false, grantedRoles: Object.freeze([] as const) }); }
}
