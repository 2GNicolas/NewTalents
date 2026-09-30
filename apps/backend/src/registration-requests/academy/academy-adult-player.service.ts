import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';
import { authorizeAcademyOperation, exactEvidence, exactFields, record, validConsent, validPerson, type AcademyOperationInput } from './academy-operation-validation.js';

const ALLOWED = new Set(['player', 'adultAuthorization', 'consent', 'evidence', 'operationInstant']);
const EVIDENCE = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'ADULT_AUTHORIZATION'] as const;

export type AcademyAdultPlayerValidation =
  | Readonly<{ complete: true; academyContextId: string; ownerIdentityId: string; academyDecisionAllowed: false; createsUserOrSelf: false }>
  | Readonly<{ complete: false; code: 'ACADEMY_OPERATION_NOT_AUTHORIZED' | 'INVALID_ACADEMY_ADULT_PLAYER_DRAFT' }>;

@Injectable()
export class AcademyAdultPlayerService {
  constructor(_prisma: PrismaService, private readonly authorization: RegistrationAuthorizationAdapter) {}

  validate(input: AcademyOperationInput): Promise<AcademyAdultPlayerValidation> { return this.validateInternal(input, true); }
  validateDraft(input: AcademyOperationInput): Promise<AcademyAdultPlayerValidation> { return this.validateInternal(input, false); }

  private async validateInternal(input: AcademyOperationInput, requireEvidence: boolean): Promise<AcademyAdultPlayerValidation> {
    if (!(await authorizeAcademyOperation(this.authorization, input, 'registration.request.academy.create-adult-player'))) return this.denied();
    try {
      const payload = record(input.payload);
      const operationInstant = payload.operationInstant instanceof Date ? payload.operationInstant : new Date();
      if (!exactFields(payload, ALLOWED) || !validPerson(payload.player, { phone: 'optional', age: 'adult', operationInstant })) return this.invalid();
      if (payload.adultAuthorization !== true || !validConsent(payload.consent, { academyPresentation: true }) || (requireEvidence && !exactEvidence(payload.evidence, EVIDENCE))) return this.invalid();
      return Object.freeze({ complete: true, academyContextId: input.academyId, ownerIdentityId: input.actorIdentityId, academyDecisionAllowed: false, createsUserOrSelf: false });
    } catch { return this.invalid(); }
  }

  private denied(): AcademyAdultPlayerValidation { return Object.freeze({ complete: false, code: 'ACADEMY_OPERATION_NOT_AUTHORIZED' }); }
  private invalid(): AcademyAdultPlayerValidation { return Object.freeze({ complete: false, code: 'INVALID_ACADEMY_ADULT_PLAYER_DRAFT' }); }
}
