import type { RegistrationPermission, RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';
import { RegistrationAgePolicy } from '../personal/registration-age-policy.js';
import { isValidRegistrationPerson } from '../validation/registration-person.validation.js';

export type AcademyOperationInput = Readonly<{ actorIdentityId: string; academyId: string; payload: unknown }>;
export type AcademyOperationDenied = Readonly<{ complete: false; code: 'ACADEMY_OPERATION_NOT_AUTHORIZED' }>;

const PERSON_FIELDS = new Set(['legalNames', 'legalSurnames', 'documentType', 'documentNumber', 'birthDate', 'country', 'city', 'phone']);
const CONSENT_FIELDS = new Set(['privacyVersion', 'privacyAccepted', 'truthfulnessAccepted', 'representationAccepted', 'minorTreatmentAccepted', 'academyPresentationAccepted']);

export async function authorizeAcademyOperation(
  authorization: RegistrationAuthorizationAdapter,
  input: AcademyOperationInput,
  permission: RegistrationPermission,
  academyResponsibleAuthority?: boolean,
): Promise<boolean> {
  const decision = await authorization.authorize({
    identityId: input.actorIdentityId,
    permission,
    academyId: input.academyId,
    ...(academyResponsibleAuthority === undefined ? {} : { academyResponsibleAuthority }),
  });
  return decision.allowed;
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
  return value as Record<string, unknown>;
}

export function exactFields(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((field) => allowed.has(field));
}

export function text(value: unknown, max = 180): boolean {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

export function validPerson(value: unknown, options: Readonly<{ phone: 'required' | 'optional' | 'forbidden'; age: 'adult' | 'minor'; operationInstant?: Date }>): boolean {
  try {
    const person = record(value);
    if (!exactFields(person, PERSON_FIELDS)) return false;
    const fieldLimits = {
      legalNames: 120,
      legalSurnames: 120,
      documentType: 40,
      documentNumber: 80,
      birthDate: 10,
      country: 80,
      city: 120,
    } as const;
    if (!Object.entries(fieldLimits).every(([field, max]) => text(person[field], max))) return false;
    if (!isValidRegistrationPerson(person, options.age, options.operationInstant ?? new Date())) return false;
    if (options.phone === 'required' && !text(person.phone, 40)) return false;
    if (options.phone === 'forbidden' && 'phone' in person) return false;
    if (options.phone === 'optional' && person.phone !== undefined && !text(person.phone, 40)) return false;
    const classification = new RegistrationAgePolicy().evaluate({ dateOfBirth: String(person.birthDate), operationInstant: options.operationInstant ?? new Date() }).classification;
    return classification === (options.age === 'adult' ? 'ADULT' : 'MINOR');
  } catch { return false; }
}

export function validConsent(value: unknown, requirements: Readonly<{ representation?: boolean; minorTreatment?: boolean; academyPresentation?: boolean }>): boolean {
  try {
    const consent = record(value);
    if (!exactFields(consent, CONSENT_FIELDS) || !text(consent.privacyVersion, 40) || consent.privacyAccepted !== true || consent.truthfulnessAccepted !== true) return false;
    if (requirements.representation && consent.representationAccepted !== true) return false;
    if (requirements.minorTreatment && consent.minorTreatmentAccepted !== true) return false;
    if (requirements.academyPresentation && consent.academyPresentationAccepted !== true) return false;
    return true;
  } catch { return false; }
}

export function exactEvidence(value: unknown, required: readonly string[]): boolean {
  return Array.isArray(value) && value.length === required.length && new Set(value).size === value.length && required.every((category) => value.includes(category));
}
