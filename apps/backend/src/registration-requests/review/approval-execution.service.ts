import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import type { RegistrationEvidenceCategory, RegistrationRequestType } from '../../generated/prisma/client.js';
import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';
import { REGISTRATION_TYPED_REQUEST_APPLICATION, type RegistrationTypedRequestApplication } from '../application/applicant-request.service.js';
import { PersonalAdultApprovalOrchestrator } from '../outcomes/personal-adult-approval.orchestrator.js';
import { RepresentedMinorApprovalOrchestrator } from '../outcomes/represented-minor-approval.orchestrator.js';
import { FormalAcademyApprovalOrchestrator } from '../outcomes/formal-academy-approval.orchestrator.js';
import { NaturalPersonAcademyApprovalOrchestrator } from '../outcomes/natural-person-academy-approval.orchestrator.js';
import { AdditionalAcademyAccountApprovalOrchestrator } from '../outcomes/additional-academy-account-approval.orchestrator.js';
import { AcademyAdultPlayerApprovalOrchestrator } from '../outcomes/academy-adult-player-approval.orchestrator.js';
import { AcademyMinorPlayerApprovalOrchestrator } from '../outcomes/academy-minor-player-approval.orchestrator.js';

type ApprovalInput = Readonly<{
  expectedVersion: number;
  idempotencyKey: string;
  manualDossierConfirmation: Readonly<{ confirmed: boolean; dossierName: string; declarationVersion: string; categories: readonly RegistrationEvidenceCategory[] }>;
}>;

@Injectable()
export class ApprovalExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: RegistrationAuthorizationAdapter,
    @Inject(REGISTRATION_TYPED_REQUEST_APPLICATION) private readonly typed: RegistrationTypedRequestApplication,
    private readonly personalAdult: PersonalAdultApprovalOrchestrator,
    private readonly representedMinor: RepresentedMinorApprovalOrchestrator,
    private readonly formalAcademy: FormalAcademyApprovalOrchestrator,
    private readonly naturalAcademy: NaturalPersonAcademyApprovalOrchestrator,
    private readonly additionalAccount: AdditionalAcademyAccountApprovalOrchestrator,
    private readonly academyAdult: AcademyAdultPlayerApprovalOrchestrator,
    private readonly academyMinor: AcademyMinorPlayerApprovalOrchestrator,
  ) {}

  async approve(identityId: string, requestId: string, input: ApprovalInput) {
    const invalid = this.validateDossier(input.manualDossierConfirmation);
    if (invalid) return { outcome: 'invalid' as const, code: invalid };
    const prior = await this.prisma.registrationApprovalExecution.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, requestId: true } });
    if (prior) return prior.requestId === requestId ? this.finalize(prior.id, identityId) : { outcome: 'conflict' as const };

    const request = await this.prisma.registrationRequest.findUnique({ where: { id: requestId }, include: { evidenceItems: { where: { replacedById: null, deletedAt: null } }, duplicateSignals: true } });
    if (!request) return { outcome: 'not-found' as const };
    const evidenceCompleteAndClean = request.evidenceItems.length > 0 && request.evidenceItems.every(({ status }) => status === 'CLEAN');
    const duplicateConflictAbsent = !request.duplicateSignals.some(({ status }) => status === 'OPEN' || status === 'CONFIRMED_CONFLICT');
    const readiness = await this.typed.readiness(requestId);
    const allowed = await this.authorization.authorize({ identityId, permission: 'registration.review.confirm-dossier', requestId, expectedVersion: input.expectedVersion, evidenceCompleteAndClean, duplicateConflictAbsent, ...readiness });
    if (!allowed.allowed) return { outcome: 'not-found' as const };

    const prepared = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM "RegistrationRequest" WHERE id = $1::uuid FOR UPDATE', requestId);
      const current = await tx.registrationRequest.findUnique({ where: { id: requestId }, include: { evidenceItems: { where: { replacedById: null, deletedAt: null } }, duplicateSignals: true } });
      if (!current || current.status !== 'SUBMITTED') return { outcome: 'not-found' as const };
      if (current.version !== input.expectedVersion || current.approvalExecutionStatus !== 'NONE') return { outcome: 'stale' as const };
      if (!current.evidenceItems.length || current.evidenceItems.some(({ status }) => status !== 'CLEAN') || current.duplicateSignals.some(({ status }) => status === 'OPEN' || status === 'CONFIRMED_CONFLICT')) return { outcome: 'invalid' as const, code: 'REQUEST_NOT_APPROVABLE' };
      const nextVersion = current.version + 1;
      await tx.registrationManualDossierConfirmation.create({ data: { requestId, requestVersion: nextVersion, administratorIdentityId: identityId, dossierName: input.manualDossierConfirmation.dossierName.trim(), transferredCategories: [...input.manualDossierConfirmation.categories], declarationVersion: input.manualDossierConfirmation.declarationVersion } });
      const execution = await tx.registrationApprovalExecution.create({ data: { requestId, requestVersion: nextVersion, status: 'DELETING_EVIDENCE', idempotencyKey: input.idempotencyKey }, select: { id: true } });
      for (const evidence of current.evidenceItems) {
        await tx.registrationEvidenceItem.update({ where: { id: evidence.id }, data: { status: 'DELETION_PENDING' } });
        await tx.registrationEvidenceDeletionRecord.upsert({ where: { evidenceItemId_requestVersion: { evidenceItemId: evidence.id, requestVersion: nextVersion } }, create: { requestId, requestVersion: nextVersion, evidenceItemId: evidence.id, status: 'PENDING' }, update: {} });
      }
      await tx.registrationRequest.update({ where: { id: requestId }, data: { version: nextVersion, approvalExecutionStatus: 'DELETING_EVIDENCE' } });
      const sequence = (await tx.registrationRequestEvent.aggregate({ where: { requestId }, _max: { sequence: true } }))._max.sequence ?? 0;
      await tx.registrationRequestEvent.create({ data: { requestId, sequence: sequence + 1, requestVersion: nextVersion, actorIdentityId: identityId, action: 'APPROVAL_PREPARED', priorStatus: 'SUBMITTED', resultingStatus: 'SUBMITTED', outcome: 'APPLIED', safeCategory: 'APPROVAL' } });
      return { outcome: 'prepared' as const, executionId: execution.id };
    });
    return prepared.outcome === 'prepared' ? this.finalize(prepared.executionId, identityId) : prepared;
  }

  prepare(identityId: string, requestId: string, input: ApprovalInput) {
    return this.approve(identityId, requestId, input);
  }

  async finalize(executionId: string, actorIdentityId?: string) {
    const execution = await this.prisma.registrationApprovalExecution.findUnique({ where: { id: executionId }, include: { request: { select: { id: true, type: true, status: true, version: true, duplicateSignals: { select: { status: true } }, dossierConfirmations: { orderBy: { confirmedAt: 'desc' }, take: 1, select: { administratorIdentityId: true } } } } } });
    if (!execution) return { outcome: 'not-found' as const };
    if (execution.status === 'FINALIZED') return { outcome: 'approved' as const, requestId: execution.requestId, requestStatus: 'APPROVED' as const, result: execution.resultReferences };
    const deletions = await this.prisma.registrationEvidenceDeletionRecord.findMany({ where: { requestId: execution.requestId, requestVersion: execution.requestVersion }, select: { status: true } });
    if (deletions.some(({ status }) => status === 'RECOVERY_REQUIRED')) {
      await this.prisma.$transaction([
        this.prisma.registrationApprovalExecution.update({ where: { id: execution.id }, data: { status: 'RECOVERY_REQUIRED' } }),
        this.prisma.registrationRequest.update({ where: { id: execution.requestId }, data: { approvalExecutionStatus: 'RECOVERY_REQUIRED' } }),
      ]);
      return { outcome: 'recovery-required' as const, requestId: execution.requestId, requestStatus: 'SUBMITTED' as const };
    }
    if (deletions.length === 0 || deletions.some(({ status }) => status !== 'COMPLETED')) return { outcome: 'pending-deletion' as const, executionId: execution.id, requestId: execution.requestId, requestStatus: 'SUBMITTED' as const };
    const approvingIdentityId = actorIdentityId ?? execution.request.dossierConfirmations[0]?.administratorIdentityId;
    if (!approvingIdentityId) return { outcome: 'not-found' as const };
    const allowed = await this.authorization.authorize({
      identityId: approvingIdentityId,
      permission: 'registration.review.approve',
      requestId: execution.requestId,
      expectedVersion: execution.requestVersion,
      manualDossierConfirmed: true,
      deletionState: 'COMPLETED',
      duplicateConflictAbsent: !execution.request.duplicateSignals.some(({ status }) => status === 'OPEN' || status === 'CONFIRMED_CONFLICT'),
      // Preparation durably records that typed completeness/representation passed
      // before evidence is deleted. Re-reading evidence-based readiness after
      // verified deletion would necessarily return false. Type-specific outcome
      // orchestrators still re-evaluate volatile facts such as age and authority.
      ageRouteCompatible: true,
      representationComplete: true,
    });
    if (!allowed.allowed) return { outcome: 'not-found' as const };
    await this.prisma.$transaction([
      this.prisma.registrationApprovalExecution.update({ where: { id: execution.id }, data: { status: 'READY_TO_FINALIZE' } }),
      this.prisma.registrationRequest.update({ where: { id: execution.requestId }, data: { approvalExecutionStatus: 'READY_TO_FINALIZE' } }),
    ]);
    try {
      const result = await this.dispatch(execution.request.type, {
        requestId: execution.requestId,
        expectedVersion: execution.requestVersion,
        idempotencyKey: execution.idempotencyKey,
        actorIdentityId: approvingIdentityId,
      });
      return { outcome: 'approved' as const, requestId: execution.requestId, requestStatus: 'APPROVED' as const, result };
    } catch {
      await this.prisma.$transaction([
        this.prisma.registrationApprovalExecution.update({ where: { id: execution.id }, data: { status: 'RECOVERY_REQUIRED', attempts: { increment: 1 } } }),
        this.prisma.registrationRequest.update({ where: { id: execution.requestId }, data: { approvalExecutionStatus: 'RECOVERY_REQUIRED' } }),
      ]).catch(() => undefined);
      return { outcome: 'recoverable-failure' as const, requestId: execution.requestId, requestStatus: 'SUBMITTED' as const };
    }
  }

  private dispatch(type: RegistrationRequestType, input: Readonly<{ requestId: string; expectedVersion: number; actorIdentityId?: string; idempotencyKey: string }>) {
    if (type === 'PERSONAL_ADULT') return this.personalAdult.approve(input);
    if (type === 'REPRESENTED_MINOR') return this.representedMinor.approve(input);
    if (type === 'FORMAL_ACADEMY') return this.formalAcademy.approve(input);
    if (type === 'NATURAL_PERSON_ACADEMY') return this.naturalAcademy.approve(input);
    if (type === 'ADDITIONAL_ACADEMY_ACCOUNT') return this.additionalAccount.approve(input);
    if (type === 'ACADEMY_ADULT_PLAYER') return this.academyAdult.approve(input);
    return this.academyMinor.approve(input);
  }

  private validateDossier(value: ApprovalInput['manualDossierConfirmation']) {
    if (value.confirmed !== true) return 'DOSSIER_CONFIRMATION_REQUIRED' as const;
    if (typeof value.dossierName !== 'string' || !value.dossierName.trim() || value.dossierName.trim().length > 180) return 'DOSSIER_NAME_INVALID' as const;
    if (!value.declarationVersion.trim() || value.declarationVersion.length > 40) return 'DOSSIER_DECLARATION_INVALID' as const;
    if (value.categories.length === 0) return 'DOSSIER_CATEGORIES_REQUIRED' as const;
    if (new Set(value.categories).size !== value.categories.length) return 'DOSSIER_CATEGORIES_INVALID' as const;
    return undefined;
  }
}
