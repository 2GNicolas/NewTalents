import { randomUUID } from 'node:crypto';

import type { Prisma } from '../../generated/prisma/client.js';
import type { PassportTransactionRunner } from '../../player-passport/passport-lifecycle/transaction-runner.js';
import { decryptPassportValue } from '../../player-passport/player-private-identity/passport-crypto.js';
import type { PassportKeyMaterial } from '../../player-passport/player-private-identity/passport-keys.js';
import type { RegistrationAgePolicy } from '../personal/registration-age-policy.js';

export type AcademyOperationApprovalInput = Readonly<{
  requestId: string;
  expectedVersion: number;
  actorIdentityId?: string;
  idempotencyKey?: string;
  operationInstant?: Date;
}>;

type AcademyOperationKind = 'ADDITIONAL_ACADEMY_ACCOUNT' | 'ACADEMY_ADULT_PLAYER' | 'ACADEMY_MINOR_PLAYER';

export class AcademyOperationApprovalExecutor {
  constructor(
    private readonly runner: PassportTransactionRunner,
    private readonly ages: RegistrationAgePolicy,
    private readonly keys: PassportKeyMaterial,
  ) {}

  execute(kind: AcademyOperationKind, input: AcademyOperationApprovalInput): Promise<unknown> {
    return this.runner.execute(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM "RegistrationRequest" WHERE id = $1::uuid FOR UPDATE', input.requestId);
      const request = await tx.registrationRequest.findUnique({
        where: { id: input.requestId },
        include: {
          applicants: true,
          players: true,
          representatives: true,
          additionalAcademyAccountDetail: true,
          academyAdultPlayerDetail: true,
          academyMinorPlayerDetail: true,
          approvalExecutions: { where: { requestVersion: input.expectedVersion } },
        },
      });
      if (!request || request.type !== kind) throw new Error('REGISTRATION_REQUEST_NOT_FOUND');
      const prior = request.approvalExecutions[0];
      if (prior?.status === 'FINALIZED' && prior.resultReferences) return prior.resultReferences;
      if (prior && prior.status !== 'READY_TO_FINALIZE') throw new Error('APPROVAL_EXECUTION_NOT_READY');
      if (request.status !== 'SUBMITTED' || request.version !== input.expectedVersion || !request.ownerIdentityId || !request.academyContextId) throw new Error('STALE_REGISTRATION_REQUEST');

      await this.assertAcademyAuthority(tx, request.ownerIdentityId, request.academyContextId, kind === 'ADDITIONAL_ACADEMY_ACCOUNT');
      const assignedByIdentityId = input.actorIdentityId ?? request.ownerIdentityId;
      let result: Readonly<Record<string, unknown>>;

      if (kind === 'ADDITIONAL_ACADEMY_ACCOUNT') {
        const applicant = request.applicants[0];
        if (!request.additionalAcademyAccountDetail?.responsibleAuthorization || !applicant?.identityId) throw new Error('INVALID_ADDITIONAL_ACADEMY_ACCOUNT_OUTCOME');
        const activeRoles = await tx.roleAssignment.count({ where: { identityId: applicant.identityId, status: 'ACTIVE' } });
        const activeMemberships = await tx.academyMembership.count({ where: { identityId: applicant.identityId, status: 'ACTIVE' } });
        if (activeRoles > 0 || activeMemberships > 0) throw new Error('REGISTRATION_CONFLICT');
        await tx.roleAssignment.create({ data: { identityId: applicant.identityId, role: 'ACADEMY_USER', status: 'ACTIVE', assignedByIdentityId } });
        await tx.academyMembership.create({ data: { identityId: applicant.identityId, academyId: request.academyContextId, status: 'ACTIVE', assignedByIdentityId } });
        result = Object.freeze({ outcome: 'approved', identityRoles: ['ACADEMY_USER'], membership: 'ACTIVE', academyId: request.academyContextId, userPrivilege: false, analystPrivilege: false, administratorPrivilege: false });
      } else {
        const registrationPlayer = request.players[0];
        const adult = kind === 'ACADEMY_ADULT_PLAYER';
        if (!registrationPlayer || (adult ? !request.academyAdultPlayerDetail?.adultAuthorization : !request.academyMinorPlayerDetail?.authorityDeclared)) throw new Error('INVALID_ACADEMY_PLAYER_OUTCOME');
        const birthDate = decryptPassportValue(this.keys.privateEncryptionKey, registrationPlayer.encryptedDateOfBirth);
        const classification = this.ages.evaluate({ dateOfBirth: birthDate, operationInstant: input.operationInstant ?? new Date() }).classification;
        if (classification !== (adult ? 'ADULT' : 'MINOR')) throw new Error('AGE_CLASSIFICATION_CHANGED');
        await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', registrationPlayer.documentFingerprint);
        const player = await this.resolvePlayer(tx, registrationPlayer);
        const passport = await tx.playerPassport.create({ data: {
          playerId: player.id,
          state: 'ACTIVE',
          enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT',
          originKind: 'ACADEMY',
          originAcademyId: request.academyContextId,
          position: '', ageCategory: '', city: '', country: '', dominantFoot: 'UNDECLARED',
          createdByIdentityId: request.ownerIdentityId,
        } });
        await tx.passportResponsibility.create({ data: { passportId: passport.id, academyId: request.academyContextId, kind: 'ACADEMY' } });
        if (!adult) {
          const representative = request.representatives[0];
          if (!representative?.authorityDeclared || !representative.encryptedPhone) throw new Error('INVALID_ACADEMY_REPRESENTATIVE');
          await tx.passportResponsibility.create({ data: { passportId: passport.id, ...(representative.identityId ? { identityId: representative.identityId } : {}), kind: 'LEGAL_REPRESENTATIVE' } });
        }
        await tx.registrationRequestPlayer.update({ where: { id: registrationPlayer.id }, data: { linkedPlayerId: player.id } });
        result = adult
          ? Object.freeze({ outcome: 'approved', playerCount: 1, sportingRelationship: 'ACTIVE', responsibility: 'ACADEMY', passportCount: 1, passport: { id: passport.id, state: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT' }, userCreated: false, selfResponsibilityCreated: false })
          : Object.freeze({ outcome: 'approved', playerCount: 1, sportingRelationship: 'ACTIVE', responsibilities: ['LEGAL_REPRESENTATIVE', 'ACADEMY'], passportCount: 1, passport: { id: passport.id, state: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT' }, automaticAccounts: 0 });
      }

      const updated = await tx.registrationRequest.updateMany({ where: { id: request.id, status: 'SUBMITTED', version: input.expectedVersion }, data: { status: 'APPROVED', version: { increment: 1 }, decidedAt: new Date(), approvalExecutionStatus: 'FINALIZED' } });
      if (updated.count !== 1) throw new Error('STALE_REGISTRATION_REQUEST');
      const sequence = (await tx.registrationRequestEvent.aggregate({ where: { requestId: request.id }, _max: { sequence: true } }))._max.sequence ?? 0;
      await tx.registrationRequestEvent.create({ data: { requestId: request.id, sequence: sequence + 1, requestVersion: input.expectedVersion + 1, actorIdentityId: assignedByIdentityId, action: 'FINALIZE_APPROVAL', priorStatus: 'SUBMITTED', resultingStatus: 'APPROVED', outcome: 'APPLIED', safeCategory: 'APPROVAL' } });
      if (prior) {
        await tx.registrationApprovalExecution.update({ where: { id: prior.id }, data: { status: 'FINALIZED', attempts: { increment: 1 }, resultReferences: result as Prisma.InputJsonValue, finalizedAt: new Date() } });
      } else {
        await tx.registrationApprovalExecution.create({ data: { requestId: request.id, requestVersion: input.expectedVersion, status: 'FINALIZED', idempotencyKey: input.idempotencyKey ?? randomUUID(), attempts: 1, resultReferences: result as Prisma.InputJsonValue, finalizedAt: new Date() } });
      }
      return result;
    });
  }

  private async assertAcademyAuthority(tx: Prisma.TransactionClient, ownerIdentityId: string, academyId: string, responsibleRequired: boolean): Promise<void> {
    const [identity, membership, academy, responsible] = await Promise.all([
      tx.identity.findUnique({ where: { id: ownerIdentityId }, select: { status: true, roleAssignments: { where: { role: 'ACADEMY_USER', status: 'ACTIVE' }, select: { id: true } } } }),
      tx.academyMembership.findFirst({ where: { identityId: ownerIdentityId, academyId, status: 'ACTIVE' }, select: { id: true } }),
      tx.academy.findUnique({ where: { id: academyId }, select: { id: true } }),
      responsibleRequired ? tx.registrationRequest.findFirst({ where: { ownerIdentityId, academyContextId: academyId, type: { in: ['FORMAL_ACADEMY', 'NATURAL_PERSON_ACADEMY'] }, status: 'APPROVED' }, select: { id: true } }) : Promise.resolve({ id: 'not-required' }),
    ]);
    if (identity?.status !== 'ACTIVE' || identity.roleAssignments.length !== 1 || !membership || !academy || !responsible) throw new Error('ACADEMY_OPERATION_NOT_AUTHORIZED');
  }

  private async resolvePlayer(tx: Prisma.TransactionClient, registrationPlayer: Readonly<{
    encryptedLegalName: string; encryptedDateOfBirth: string; encryptedDocumentType: string; encryptedDocumentNumber: string; documentFingerprint: string; nameDobFingerprint: string;
  }>) {
    const existing = await tx.playerPrivateIdentity.findUnique({ where: { documentFingerprint: registrationPlayer.documentFingerprint }, include: { player: { include: { passport: true } } } });
    if (existing) {
      if (existing.player.passport) throw new Error('REGISTRATION_CONFLICT');
      return existing.player;
    }
    return tx.player.create({ data: { privateIdentity: { create: {
      encryptedLegalName: registrationPlayer.encryptedLegalName,
      encryptedDateOfBirth: registrationPlayer.encryptedDateOfBirth,
      encryptedDocumentType: registrationPlayer.encryptedDocumentType,
      encryptedDocumentNumber: registrationPlayer.encryptedDocumentNumber,
      documentFingerprint: registrationPlayer.documentFingerprint,
      nameDobFingerprint: registrationPlayer.nameDobFingerprint,
    } } } });
  }
}
