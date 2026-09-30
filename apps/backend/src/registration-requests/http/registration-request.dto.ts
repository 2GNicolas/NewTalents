import { z } from 'zod';

import { COLOMBIA_DOCUMENT_TYPES, isValidBirthDate, isValidColombiaDocument, isValidColombiaLocation } from '../validation/registration-person.validation.js';

export type SafeParseResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; issues: readonly Readonly<{ field: string; code: string }>[] }>;

function parse<T>(schema: z.ZodType<T>, input: unknown): SafeParseResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, issues: Object.freeze(result.error.issues.map((issue) => Object.freeze({ field: issue.path.join('.'), code: issue.code }))) };
}

function uniqueArray<T extends z.ZodTypeAny>(item: T, message: string) {
  return z.array(item).min(1).superRefine((values, context) => {
    if (new Set(values.map(String)).size !== values.length) context.addIssue({ code: 'custom', message });
  });
}

const uuid = z.string().uuid();
const bounded = (maximum: number, minimum = 0) => z.string().min(minimum).max(maximum);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => isValidBirthDate(value), 'invalid_or_future_date');
const country = z.literal('CO');
const municipality = z.string().length(5).refine((value) => isValidColombiaLocation('CO', value), 'invalid_divipola_municipality');
const documentType = z.enum(COLOMBIA_DOCUMENT_TYPES);

const credentialInput = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  passwordConfirmation: z.string().min(12).max(128),
}).strict().superRefine((value, context) => {
  if (value.password !== value.passwordConfirmation) context.addIssue({ code: 'custom', path: ['passwordConfirmation'], message: 'confirmation_mismatch' });
});

const privatePersonInput = z.object({
  legalNames: bounded(120, 1), legalSurnames: bounded(120, 1), documentType, documentNumber: bounded(80, 1),
  birthDate: date, country, city: municipality, phone: bounded(40, 1).optional(),
}).strict().superRefine((value, context) => {
  if (!isValidColombiaDocument(value.documentType, value.documentNumber)) context.addIssue({ code: 'custom', path: ['documentNumber'], message: 'invalid_document_number_for_type' });
});

const consentInput = z.object({
  privacyVersion: bounded(40, 1), privacyAccepted: z.literal(true), truthfulnessAccepted: z.literal(true),
  representationAccepted: z.boolean().optional(), minorTreatmentAccepted: z.boolean().optional(), academyPresentationAccepted: z.boolean().optional(),
}).strict();

const academyBaseInput = z.object({
  academyName: bounded(180, 1), country, city: municipality, trainingPlace: bounded(180, 1).optional(), responsiblePerson: privatePersonInput,
}).strict();

const relationship = z.enum(['MOTHER', 'FATHER', 'LEGAL_GUARDIAN']);
const proofCategory = z.enum(['RUT', 'MUNICIPAL_OR_SPORT_CERTIFICATION', 'PLACE_USE_AUTHORIZATION', 'OPERATION_CONTRACT_OR_REGISTER', 'OTHER_CONTROLLED']);
const evidenceCategory = z.enum(['IDENTITY_FRONT', 'IDENTITY_BACK', 'MINOR_CIVIL_IDENTITY', 'REPRESENTATION_AUTHORITY', 'RUT', 'EXISTENCE_CERTIFICATE', 'RESPONSIBLE_AUTHORITY', 'OPERATION_PROOF', 'ADULT_AUTHORIZATION', 'ACADEMY_ACCOUNT_AUTHORIZATION']);

const personalAdultCreate = z.object({ credentials: credentialInput, person: privatePersonInput, actingForSelf: z.literal(true), consent: consentInput }).strict();
const representedMinorCreate = z.object({ credentials: credentialInput, representative: privatePersonInput, minor: privatePersonInput, relationship, authorityDeclared: z.literal(true), consent: consentInput }).strict();
const formalAcademyCreate = z.object({ credentials: credentialInput, academy: academyBaseInput, organizationType: bounded(80), nit: bounded(40), authorityDeclared: z.literal(true), consent: consentInput }).strict();
const naturalPersonAcademyCreate = z.object({ credentials: credentialInput, academy: academyBaseInput, operationDeclared: z.literal(true), proofCategories: uniqueArray(proofCategory, 'duplicate_proof_category'), consent: consentInput }).strict();
const additionalAcademyAccountCreate = z.object({ person: privatePersonInput, function: bounded(120), responsibleAuthorization: z.literal(true), consent: consentInput }).strict();
const academyAdultPlayerCreate = z.object({ player: privatePersonInput, adultAuthorization: z.literal(true), consent: consentInput }).strict();
const academyMinorPlayerCreate = z.object({ minor: privatePersonInput, representative: privatePersonInput, relationship, authorityDeclared: z.literal(true), consent: consentInput }).strict();

const typedCreate = z.union([personalAdultCreate, representedMinorCreate, formalAcademyCreate, naturalPersonAcademyCreate, additionalAcademyAccountCreate, academyAdultPlayerCreate, academyMinorPlayerCreate]);
const transitionCommand = z.object({ expectedVersion: z.number().int().nonnegative(), idempotencyKey: uuid }).strict();
const correctionCommand = transitionCommand.extend({ safeReason: bounded(1000, 1), correctionTargets: uniqueArray(bounded(100, 1), 'duplicate_correction_target') }).strict();
const manualDossierConfirmation = z.object({ confirmed: z.literal(true), declarationVersion: bounded(40, 1), categories: uniqueArray(evidenceCategory, 'duplicate_evidence_category') }).strict();
const approvalCommand = transitionCommand.extend({ manualDossierConfirmation }).strict();
const rejectionCommand = transitionCommand.extend({ safeReason: bounded(1000, 1) }).strict();
const requestUpdate = z.object({ expectedVersion: z.number().int().nonnegative(), details: typedCreate }).strict();
const requestListQuery = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.preprocess((value) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value, z.number().int().min(1).max(50).default(20)),
}).strict();
const registrationRequestType = z.enum(['PERSONAL_ADULT', 'REPRESENTED_MINOR', 'FORMAL_ACADEMY', 'NATURAL_PERSON_ACADEMY', 'ADDITIONAL_ACADEMY_ACCOUNT', 'ACADEMY_ADULT_PLAYER', 'ACADEMY_MINOR_PLAYER']);
const registrationRequestStatus = z.enum(['DRAFT', 'SUBMITTED', 'REQUIRES_CORRECTION', 'APPROVED', 'REJECTED']);
const adminRequestListQuery = requestListQuery.extend({ type: registrationRequestType.optional(), status: registrationRequestStatus.optional() }).strict();
const identityConflictField = z.enum(['person.documentNumber', 'representative.documentNumber', 'minor.documentNumber', 'academy.responsiblePerson.documentNumber', 'player.documentNumber', 'nit', 'academy.academyName']);
const identityConflictCheck = z.union([
  z.object({ field: identityConflictField.exclude(['nit', 'academy.academyName']), documentType, documentNumber: bounded(80, 1) }).strict().superRefine((value, context) => {
    if (!isValidColombiaDocument(value.documentType, value.documentNumber)) context.addIssue({ code: 'custom', path: ['documentNumber'], message: 'invalid_document_number_for_type' });
  }),
  z.object({ field: z.literal('nit'), nit: bounded(40, 1) }).strict(),
  z.object({ field: z.literal('academy.academyName'), academyName: bounded(180, 1) }).strict(),
]);
const identityConflictValidation = z.object({ requestType: registrationRequestType, checks: z.array(identityConflictCheck).min(1).max(3) }).strict().superRefine((value, context) => {
  const allowed: Readonly<Record<z.infer<typeof registrationRequestType>, readonly z.infer<typeof identityConflictField>[]>> = {
    PERSONAL_ADULT: ['person.documentNumber'], REPRESENTED_MINOR: ['representative.documentNumber', 'minor.documentNumber'],
    FORMAL_ACADEMY: ['academy.academyName', 'nit', 'academy.responsiblePerson.documentNumber'], NATURAL_PERSON_ACADEMY: ['academy.academyName', 'academy.responsiblePerson.documentNumber'],
    ADDITIONAL_ACADEMY_ACCOUNT: ['person.documentNumber'], ACADEMY_ADULT_PLAYER: ['player.documentNumber'], ACADEMY_MINOR_PLAYER: ['minor.documentNumber', 'representative.documentNumber'],
  };
  value.checks.forEach((check, index) => { if (!allowed[value.requestType].includes(check.field)) context.addIssue({ code: 'custom', path: ['checks', index, 'field'], message: 'field_not_allowed_for_request_type' }); });
});

export const parsePersonalAdultCreate = (input: unknown) => parse(personalAdultCreate, input);
export const parseRepresentedMinorCreate = (input: unknown) => parse(representedMinorCreate, input);
export const parseFormalAcademyCreate = (input: unknown) => parse(formalAcademyCreate, input);
export const parseNaturalPersonAcademyCreate = (input: unknown) => parse(naturalPersonAcademyCreate, input);
export const parseAdditionalAcademyAccountCreate = (input: unknown) => parse(additionalAcademyAccountCreate, input);
export const parseAcademyAdultPlayerCreate = (input: unknown) => parse(academyAdultPlayerCreate, input);
export const parseAcademyMinorPlayerCreate = (input: unknown) => parse(academyMinorPlayerCreate, input);
export const parseRequestUpdate = (input: unknown) => parse(requestUpdate, input);
export const parseTransitionCommand = (input: unknown) => parse(transitionCommand, input);
export const parseCorrectionCommand = (input: unknown) => parse(correctionCommand, input);
export const parseApprovalCommand = (input: unknown) => parse(approvalCommand, input);
export const parseRejectionCommand = (input: unknown) => parse(rejectionCommand, input);
export const parseRequestListQuery = (input: unknown) => parse(requestListQuery, input);
export const parseAdminRequestListQuery = (input: unknown) => parse(adminRequestListQuery, input);
export const parseIdentityConflictValidation = (input: unknown) => parse(identityConflictValidation, input);
