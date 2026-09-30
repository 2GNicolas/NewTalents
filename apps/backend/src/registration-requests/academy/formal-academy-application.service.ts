import { Injectable } from '@nestjs/common';

import { RegistrationAgePolicy } from '../personal/registration-age-policy.js';
import { isValidColombiaLocation, isValidRegistrationPerson } from '../validation/registration-person.validation.js';

const FORMAL_EVIDENCE = ['EXISTENCE_CERTIFICATE', 'RESPONSIBLE_AUTHORITY', 'RUT'] as const;
const FORMAL_ONLY_ALLOWED = new Set(['academy', 'organizationType', 'nit', 'authorityDeclared', 'responsiblePerson', 'consent', 'evidence', 'operationInstant', 'credentials']);

type Validation = Readonly<{
  complete: boolean;
  code?: 'INVALID_FORMAL_ACADEMY_DRAFT';
  academyOperable: false;
  grantedRoles: readonly [];
  normalizedAcademyName?: string;
  normalizedNit?: string;
}>;

@Injectable()
export class FormalAcademyApplicationService {
  constructor(private readonly agePolicy: RegistrationAgePolicy = new RegistrationAgePolicy()) {}

  async validate(value: unknown): Promise<Validation> { return this.validateInternal(value, true); }
  async validateDraft(value: unknown): Promise<Validation> { return this.validateInternal(value, false); }

  private async validateInternal(value: unknown, requireEvidence: boolean): Promise<Validation> {
    try {
      const input = this.record(value);
      if (Object.keys(input).some((field) => !FORMAL_ONLY_ALLOWED.has(field))) return this.invalid();
      const academy = this.record(input.academy);
      const responsible = this.record(input.responsiblePerson ?? academy.responsiblePerson);
      const consent = this.record(input.consent);
      if (!this.text(academy.academyName, 180) || !this.text(academy.country, 80) || !this.text(academy.city, 120)) return this.invalid();
      if (!isValidColombiaLocation(academy.country, academy.city)) return this.invalid();
      if ('trainingPlace' in academy && !this.text(academy.trainingPlace, 180)) return this.invalid();
      if (!this.text(input.organizationType, 80) || !this.text(input.nit, 40) || input.authorityDeclared !== true) return this.invalid();
      const identity = ['legalNames', 'legalSurnames', 'documentType', 'documentNumber', 'birthDate', 'country', 'city'];
      if (!identity.every((field) => this.text(responsible[field])) || !this.text(responsible.phone, 40)) return this.invalid();
      const operationInstant = input.operationInstant instanceof Date ? input.operationInstant : new Date();
      if (!isValidRegistrationPerson(responsible, 'adult', operationInstant)) return this.invalid();
      if (this.agePolicy.evaluate({ dateOfBirth: String(responsible.birthDate), operationInstant }).classification !== 'ADULT') return this.invalid();
      if (!this.text(consent.privacyVersion, 40) || consent.privacyAccepted !== true || consent.truthfulnessAccepted !== true) return this.invalid();
      if (requireEvidence && !this.exactEvidence(input.evidence)) return this.invalid();
      return Object.freeze({ complete: true, academyOperable: false, grantedRoles: Object.freeze([] as const), normalizedAcademyName: this.normalizeName(String(academy.academyName)), normalizedNit: this.normalizeNit(String(input.nit)) });
    } catch { return this.invalid(); }
  }

  private normalizeName(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase(); }
  private normalizeNit(value: string) { const normalized = value.replace(/[^0-9A-Za-z]/g, '').toUpperCase(); if (!normalized) throw new Error('invalid'); return normalized; }
  private exactEvidence(value: unknown) { return Array.isArray(value) && value.length === FORMAL_EVIDENCE.length && new Set(value).size === value.length && FORMAL_EVIDENCE.every((item) => value.includes(item)); }
  private text(value: unknown, max = 180) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max; }
  private record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid'); return value as Record<string, unknown>; }
  private invalid(): Validation { return Object.freeze({ complete: false, code: 'INVALID_FORMAL_ACADEMY_DRAFT', academyOperable: false, grantedRoles: Object.freeze([] as const) }); }
}
