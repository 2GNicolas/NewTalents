import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';
import { authorizeAcademyOperation, exactEvidence, exactFields, record, validConsent, validPerson, type AcademyOperationInput } from './academy-operation-validation.js';

const ALLOWED = new Set(['minor', 'representative', 'relationship', 'authorityDeclared', 'consent', 'evidence', 'operationInstant']);
const RELATIONSHIPS = new Set(['MOTHER', 'FATHER', 'LEGAL_GUARDIAN']);
const EVIDENCE = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'MINOR_CIVIL_IDENTITY', 'REPRESENTATION_AUTHORITY'] as const;

export type AcademyMinorPlayerValidation =
  | Readonly<{ complete: true; academyContextId: string; ownerIdentityId: string; academyDecisionAllowed: false; academyIsLegalRepresentative: false; automaticAccounts: 0 }>
  | Readonly<{ complete: false; code: 'ACADEMY_OPERATION_NOT_AUTHORIZED' | 'INVALID_ACADEMY_MINOR_PLAYER_DRAFT' }>;

@Injectable()
export class AcademyMinorPlayerService {
  constructor(_prisma: PrismaService, private readonly authorization: RegistrationAuthorizationAdapter) {}

  validate(input: AcademyOperationInput): Promise<AcademyMinorPlayerValidation> { return this.validateInternal(input, true); }
  validateDraft(input: AcademyOperationInput): Promise<AcademyMinorPlayerValidation> { return this.validateInternal(input, false); }

  private async validateInternal(input: AcademyOperationInput, requireEvidence: boolean): Promise<AcademyMinorPlayerValidation> {
    if (!(await authorizeAcademyOperation(this.authorization, input, 'registration.request.academy.create-minor-player'))) return this.denied();
    try {
      const payload = record(input.payload);
      const operationInstant = payload.operationInstant instanceof Date ? payload.operationInstant : new Date();
      if (!exactFields(payload, ALLOWED) || !validPerson(payload.minor, { phone: 'forbidden', age: 'minor', operationInstant })) return this.invalid();
      if (!validPerson(payload.representative, { phone: 'required', age: 'adult', operationInstant }) || !RELATIONSHIPS.has(String(payload.relationship)) || payload.authorityDeclared !== true) return this.invalid();
      if (!validConsent(payload.consent, { representation: true, minorTreatment: true, academyPresentation: true }) || (requireEvidence && !exactEvidence(payload.evidence, EVIDENCE))) return this.invalid();
      return Object.freeze({ complete: true, academyContextId: input.academyId, ownerIdentityId: input.actorIdentityId, academyDecisionAllowed: false, academyIsLegalRepresentative: false, automaticAccounts: 0 });
    } catch { return this.invalid(); }
  }

  private denied(): AcademyMinorPlayerValidation { return Object.freeze({ complete: false, code: 'ACADEMY_OPERATION_NOT_AUTHORIZED' }); }
  private invalid(): AcademyMinorPlayerValidation { return Object.freeze({ complete: false, code: 'INVALID_ACADEMY_MINOR_PLAYER_DRAFT' }); }
}
