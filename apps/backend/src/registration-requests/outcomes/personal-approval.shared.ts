import { randomUUID } from 'node:crypto';

import type { Prisma } from '../../generated/prisma/client.js';
import type { PassportTransactionRunner } from '../../player-passport/passport-lifecycle/transaction-runner.js';
import type { PassportKeyMaterial } from '../../player-passport/player-private-identity/passport-keys.js';
import { decryptPassportValue } from '../../player-passport/player-private-identity/passport-crypto.js';
import type { RegistrationAgePolicy } from '../personal/registration-age-policy.js';

export type PersonalApprovalInput = Readonly<{ requestId: string; expectedVersion: number; actorIdentityId?: string; idempotencyKey?: string; operationInstant?: Date }>;

type ApprovalKind = 'PERSONAL_ADULT' | 'REPRESENTED_MINOR';

export class PersonalApprovalExecutor {
  constructor(
    private readonly runner: PassportTransactionRunner,
    private readonly agePolicy: RegistrationAgePolicy,
    private readonly keys: PassportKeyMaterial,
  ) {}

  execute(kind: ApprovalKind, input: PersonalApprovalInput) {
    return this.runner.execute(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM "RegistrationRequest" WHERE id = $1::uuid FOR UPDATE', input.requestId);
      const request = await tx.registrationRequest.findUnique({
        where: { id: input.requestId },
        include: {
          applicantAccess: true,
          applicants: true,
          players: true,
          approvalExecutions: { where: { requestVersion: input.expectedVersion } },
        },
      });
      if (!request || request.type !== kind) throw new Error('REGISTRATION_REQUEST_NOT_FOUND');
      const prior = request.approvalExecutions[0];
      if (prior?.status === 'FINALIZED' && prior.resultReferences) return prior.resultReferences;
      if (prior && prior.status !== 'READY_TO_FINALIZE') throw new Error('APPROVAL_EXECUTION_NOT_READY');
      if (request.status !== 'SUBMITTED' || request.version !== input.expectedVersion || !request.ownerIdentityId) throw new Error('STALE_REGISTRATION_REQUEST');

      const applicant = request.applicants[0];
      const registrationPlayer = request.players[0];
      if (!applicant || !registrationPlayer || applicant.identityId !== request.ownerIdentityId) throw new Error('INVALID_REGISTRATION_OUTCOME');
      const operationInstant = input.operationInstant ?? new Date();
      const playerBirthDate = decryptPassportValue(this.keys.privateEncryptionKey, registrationPlayer.encryptedDateOfBirth);
      const classification = this.agePolicy.evaluate({ dateOfBirth: playerBirthDate, operationInstant }).classification;
      if ((kind === 'PERSONAL_ADULT' && classification !== 'ADULT') || (kind === 'REPRESENTED_MINOR' && classification !== 'MINOR')) throw new Error('AGE_CLASSIFICATION_CHANGED');
      if (kind === 'REPRESENTED_MINOR') {
        const representativeBirthDate = decryptPassportValue(this.keys.privateEncryptionKey, applicant.encryptedDateOfBirth);
        if (this.agePolicy.evaluate({ dateOfBirth: representativeBirthDate, operationInstant }).classification !== 'ADULT' || !applicant.encryptedPhone) throw new Error('INVALID_REPRESENTATIVE');
      }

      await this.ensureUserRole(tx, request.ownerIdentityId, input.actorIdentityId ?? request.ownerIdentityId);
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', registrationPlayer.documentFingerprint);
      const player = await this.resolvePlayer(tx, registrationPlayer);
      const passport = await tx.playerPassport.create({ data: {
        playerId: player.id,
        state: 'ACTIVE',
        enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT',
        originKind: 'PARTICULAR',
        position: '', ageCategory: '', city: '', country: '', dominantFoot: 'UNDECLARED',
        createdByIdentityId: request.ownerIdentityId,
      } });
      const responsibility = kind === 'PERSONAL_ADULT' ? 'SELF' : 'LEGAL_REPRESENTATIVE';
      if (kind === 'PERSONAL_ADULT') {
        const existingSelf = await tx.passportResponsibility.findFirst({ where: { identityId: request.ownerIdentityId, kind: 'SELF' } });
        if (existingSelf) throw new Error('REGISTRATION_CONFLICT');
      } else {
        await tx.initialTutorResponsibility.create({ data: { playerId: player.id, tutorIdentityId: request.ownerIdentityId } });
      }
      await tx.passportResponsibility.create({ data: { passportId: passport.id, identityId: request.ownerIdentityId, kind: responsibility } });
      await tx.registrationRequestPlayer.update({ where: { id: registrationPlayer.id }, data: { linkedPlayerId: player.id } });
      const updated = await tx.registrationRequest.updateMany({
        where: { id: request.id, version: input.expectedVersion, status: 'SUBMITTED' },
        data: { status: 'APPROVED', version: { increment: 1 }, decidedAt: new Date(), approvalExecutionStatus: 'FINALIZED' },
      });
      if (updated.count !== 1) throw new Error('STALE_REGISTRATION_REQUEST');
      await tx.registrationApplicantAccess.update({ where: { requestId: request.id }, data: { status: 'APPROVED' } });
      const sequence = (await tx.registrationRequestEvent.aggregate({ where: { requestId: request.id }, _max: { sequence: true } }))._max.sequence ?? 0;
      await tx.registrationRequestEvent.create({ data: {
        requestId: request.id, sequence: sequence + 1, requestVersion: input.expectedVersion + 1,
        actorIdentityId: input.actorIdentityId ?? request.ownerIdentityId, action: 'FINALIZE_APPROVAL', priorStatus: 'SUBMITTED', resultingStatus: 'APPROVED', outcome: 'APPLIED', safeCategory: 'APPROVAL',
      } });
      const result = kind === 'PERSONAL_ADULT'
        ? Object.freeze({ outcome: 'approved', identityRoles: ['USER'], responsibility: 'SELF', passport: { id: passport.id, state: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT' } })
        : Object.freeze({ outcome: 'approved', representativeRoles: ['USER'], responsibility: 'LEGAL_REPRESENTATIVE', minorAccountCreated: false, passportCount: 1, passport: { id: passport.id, state: 'ACTIVE', enrichmentStatus: 'AWAITING_ANALYST_ENRICHMENT' } });
      if (prior) {
        await tx.registrationApprovalExecution.update({ where: { id: prior.id }, data: { status: 'FINALIZED', attempts: { increment: 1 }, resultReferences: result as unknown as Prisma.InputJsonValue, finalizedAt: new Date() } });
      } else {
        await tx.registrationApprovalExecution.create({ data: {
          requestId: request.id, requestVersion: input.expectedVersion, status: 'FINALIZED', idempotencyKey: input.idempotencyKey ?? randomUUID(), attempts: 1,
          resultReferences: result as unknown as Prisma.InputJsonValue, finalizedAt: new Date(),
        } });
      }
      return result;
    });
  }

  private async ensureUserRole(tx: Prisma.TransactionClient, identityId: string, assignedByIdentityId: string): Promise<void> {
    const existing = await tx.roleAssignment.findFirst({ where: { identityId, role: 'USER', status: 'ACTIVE' } });
    if (!existing) await tx.roleAssignment.create({ data: { identityId, role: 'USER', status: 'ACTIVE', assignedByIdentityId } });
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
