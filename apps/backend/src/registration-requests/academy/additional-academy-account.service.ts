import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';
import { authorizeAcademyOperation, exactEvidence, exactFields, record, text, validConsent, validPerson, type AcademyOperationInput } from './academy-operation-validation.js';

const ALLOWED = new Set(['person', 'function', 'responsibleAuthorization', 'consent', 'evidence', 'operationInstant']);
const EVIDENCE = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'ACADEMY_ACCOUNT_AUTHORIZATION'] as const;

export type AdditionalAcademyAccountValidation =
  | Readonly<{ complete: true; academyContextId: string; ownerIdentityId: string; academyDecisionAllowed: false }>
  | Readonly<{ complete: false; code: 'ACADEMY_OPERATION_NOT_AUTHORIZED' | 'INVALID_ADDITIONAL_ACADEMY_ACCOUNT_DRAFT' }>;

@Injectable()
export class AdditionalAcademyAccountService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: RegistrationAuthorizationAdapter) {}

  validate(input: AcademyOperationInput): Promise<AdditionalAcademyAccountValidation> { return this.validateInternal(input, true); }
  validateDraft(input: AcademyOperationInput): Promise<AdditionalAcademyAccountValidation> { return this.validateInternal(input, false); }

  private async validateInternal(input: AcademyOperationInput, requireEvidence: boolean): Promise<AdditionalAcademyAccountValidation> {
    const responsible = await this.prisma.registrationRequest.findFirst({
      where: { ownerIdentityId: input.actorIdentityId, academyContextId: input.academyId, status: 'APPROVED', type: { in: ['FORMAL_ACADEMY', 'NATURAL_PERSON_ACADEMY'] } },
      select: { id: true },
    });
    if (!(await authorizeAcademyOperation(this.authorization, input, 'registration.request.academy.create-additional-account', Boolean(responsible)))) return this.denied();
    try {
      const payload = record(input.payload);
      const operationInstant = payload.operationInstant instanceof Date ? payload.operationInstant : new Date();
      if (!exactFields(payload, ALLOWED) || !validPerson(payload.person, { phone: 'optional', age: 'adult', operationInstant })) return this.invalid();
      if (!text(payload.function, 120) || payload.responsibleAuthorization !== true || !validConsent(payload.consent, {}) || (requireEvidence && !exactEvidence(payload.evidence, EVIDENCE))) return this.invalid();
      return Object.freeze({ complete: true, academyContextId: input.academyId, ownerIdentityId: input.actorIdentityId, academyDecisionAllowed: false });
    } catch { return this.invalid(); }
  }

  private denied(): AdditionalAcademyAccountValidation { return Object.freeze({ complete: false, code: 'ACADEMY_OPERATION_NOT_AUTHORIZED' }); }
  private invalid(): AdditionalAcademyAccountValidation { return Object.freeze({ complete: false, code: 'INVALID_ADDITIONAL_ACADEMY_ACCOUNT_DRAFT' }); }
}
