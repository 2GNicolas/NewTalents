import { randomUUID } from 'node:crypto';

import type { Prisma } from '../../generated/prisma/client.js';
import type { PassportTransactionRunner } from '../../player-passport/passport-lifecycle/transaction-runner.js';
import { decryptPassportValue } from '../../player-passport/player-private-identity/passport-crypto.js';
import type { PassportKeyMaterial } from '../../player-passport/player-private-identity/passport-keys.js';
import type { RegistrationAgePolicy } from '../personal/registration-age-policy.js';

export type AcademyApprovalInput = Readonly<{ requestId: string; expectedVersion: number; actorIdentityId?: string; idempotencyKey?: string; operationInstant?: Date }>;
type Kind = 'FORMAL_ACADEMY' | 'NATURAL_PERSON_ACADEMY';

export class AcademyCreationApprovalExecutor {
  constructor(private readonly runner: PassportTransactionRunner, private readonly ages: RegistrationAgePolicy, private readonly keys: PassportKeyMaterial) {}

  execute(kind: Kind, input: AcademyApprovalInput) {
    return this.runner.execute(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM "RegistrationRequest" WHERE id = $1::uuid FOR UPDATE', input.requestId);
      const request = await tx.registrationRequest.findUnique({ where: { id: input.requestId }, include: {
        applicantAccess: true, applicants: true, formalAcademyDetail: true, naturalPersonAcademyDetail: true,
        approvalExecutions: { where: { requestVersion: input.expectedVersion } },
      } });
      if (!request || request.type !== kind) throw new Error('REGISTRATION_REQUEST_NOT_FOUND');
      const prior = request.approvalExecutions[0];
      if (prior?.status === 'FINALIZED' && prior.resultReferences) return prior.resultReferences;
      if (prior && prior.status !== 'READY_TO_FINALIZE') throw new Error('APPROVAL_EXECUTION_NOT_READY');
      if (request.status !== 'SUBMITTED' || request.version !== input.expectedVersion || !request.ownerIdentityId) throw new Error('STALE_REGISTRATION_REQUEST');
      const responsible = request.applicants[0];
      const detail = kind === 'FORMAL_ACADEMY' ? request.formalAcademyDetail : request.naturalPersonAcademyDetail;
      if (!responsible || !detail || responsible.identityId !== request.ownerIdentityId || !responsible.encryptedPhone) throw new Error('INVALID_ACADEMY_RESPONSIBLE');
      const birthDate = decryptPassportValue(this.keys.privateEncryptionKey, responsible.encryptedDateOfBirth);
      if (this.ages.evaluate({ dateOfBirth: birthDate, operationInstant: input.operationInstant ?? new Date() }).classification !== 'ADULT') throw new Error('INVALID_ACADEMY_RESPONSIBLE');
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', detail.academyNameFingerprint);
      const duplicate = kind === 'FORMAL_ACADEMY'
        ? await tx.formalAcademyRequestDetail.findFirst({ where: { requestId: { not: request.id }, OR: [{ academyNameFingerprint: detail.academyNameFingerprint }, { nitFingerprint: request.formalAcademyDetail!.nitFingerprint }], request: { status: 'APPROVED' } }, select: { id: true } })
        : await tx.naturalPersonAcademyRequestDetail.findFirst({ where: { requestId: { not: request.id }, academyNameFingerprint: detail.academyNameFingerprint, request: { status: 'APPROVED' } }, select: { id: true } });
      if (duplicate) throw new Error('REGISTRATION_CONFLICT');
      const existingRoles = await tx.roleAssignment.count({ where: { identityId: request.ownerIdentityId, status: 'ACTIVE' } });
      if (existingRoles > 0) throw new Error('REGISTRATION_CONFLICT');
      const displayName = decryptPassportValue(this.keys.privateEncryptionKey, detail.encryptedAcademyName);
      const academy = await tx.academy.create({ data: { displayName } });
      const actorIdentityId = input.actorIdentityId ?? request.ownerIdentityId;
      await tx.roleAssignment.create({ data: { identityId: request.ownerIdentityId, role: 'ACADEMY_USER', status: 'ACTIVE', assignedByIdentityId: actorIdentityId } });
      await tx.academyMembership.create({ data: { identityId: request.ownerIdentityId, academyId: academy.id, status: 'ACTIVE', assignedByIdentityId: actorIdentityId } });
      const updated = await tx.registrationRequest.updateMany({ where: { id: request.id, version: input.expectedVersion, status: 'SUBMITTED' }, data: { status: 'APPROVED', version: { increment: 1 }, academyContextId: academy.id, decidedAt: new Date(), approvalExecutionStatus: 'FINALIZED' } });
      if (updated.count !== 1) throw new Error('STALE_REGISTRATION_REQUEST');
      await tx.registrationApplicantAccess.update({ where: { requestId: request.id }, data: { status: 'APPROVED' } });
      const sequence = (await tx.registrationRequestEvent.aggregate({ where: { requestId: request.id }, _max: { sequence: true } }))._max.sequence ?? 0;
      await tx.registrationRequestEvent.create({ data: { requestId: request.id, sequence: sequence + 1, requestVersion: input.expectedVersion + 1, actorIdentityId, action: 'FINALIZE_APPROVAL', priorStatus: 'SUBMITTED', resultingStatus: 'APPROVED', outcome: 'APPLIED', safeCategory: 'APPROVAL' } });
      const result = kind === 'FORMAL_ACADEMY'
        ? Object.freeze({ outcome: 'approved', academyCount: 1, academyId: academy.id, responsibleRoles: ['ACADEMY_USER'], membership: 'ACTIVE', responsibleRelationship: 'ACTIVE' })
        : Object.freeze({ outcome: 'approved', academyCount: 1, academyId: academy.id, responsibleRoles: ['ACADEMY_USER'], membership: 'ACTIVE', responsibleRelationship: 'ACTIVE', legalCertificationClaimed: false });
      if (prior) {
        await tx.registrationApprovalExecution.update({ where: { id: prior.id }, data: { status: 'FINALIZED', attempts: { increment: 1 }, resultReferences: result as unknown as Prisma.InputJsonValue, finalizedAt: new Date() } });
      } else {
        await tx.registrationApprovalExecution.create({ data: { requestId: request.id, requestVersion: input.expectedVersion, status: 'FINALIZED', idempotencyKey: input.idempotencyKey ?? randomUUID(), attempts: 1, resultReferences: result as unknown as Prisma.InputJsonValue, finalizedAt: new Date() } });
      }
      return result;
    });
  }
}
