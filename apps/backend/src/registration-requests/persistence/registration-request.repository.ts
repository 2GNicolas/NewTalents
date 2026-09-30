import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { RegistrationRequestAction, RegistrationRequestSnapshot, RegistrationRequestType, RegistrationTransitionResult } from '../domain/registration-request.types.js';
import type { RegistrationLifecycleRepository } from '../lifecycle/registration-request-lifecycle.service.js';

type DraftBase<TType extends RegistrationRequestType, TDetail> = Readonly<{
  requestId: string;
  type: TType;
  ownerIdentityId?: string;
  academyContextId?: string;
  detail: TDetail & Readonly<{ type: TType }>;
}>;

export type RegistrationApplicantCreate = Readonly<{
  identityId?: string; encryptedLegalName: string; encryptedDateOfBirth: string; encryptedDocumentType: string; encryptedDocumentNumber: string;
  documentFingerprint: string; nameDobFingerprint: string; encryptedEmail?: string; emailFingerprint?: string; encryptedPhone?: string; phoneFingerprint?: string; derivedAdult: boolean;
}>;
export type RegistrationPlayerCreate = Readonly<{
  linkedPlayerId?: string; encryptedLegalName: string; encryptedDateOfBirth: string; encryptedDocumentType: string; encryptedDocumentNumber: string;
  documentFingerprint: string; nameDobFingerprint: string; encryptedCountry: string; encryptedCity: string; derivedAdult: boolean;
}>;
export type RegistrationRepresentativeCreate = Readonly<{
  identityId?: string; encryptedLegalName: string; encryptedDocumentType: string; encryptedDocumentNumber: string; documentFingerprint: string;
  encryptedPhone: string; phoneFingerprint: string; relationship: 'MOTHER' | 'FATHER' | 'LEGAL_GUARDIAN'; authorityDeclared: true;
}>;

export type RegistrationTypedDraftInput =
  | DraftBase<'PERSONAL_ADULT', Readonly<{ applicant: RegistrationApplicantCreate; player: RegistrationPlayerCreate; actingForSelf: true }>>
  | DraftBase<'REPRESENTED_MINOR', Readonly<{ applicant: RegistrationApplicantCreate; player: RegistrationPlayerCreate; relationship: 'MOTHER' | 'FATHER' | 'LEGAL_GUARDIAN'; authorityDeclared: true }>>
  | DraftBase<'FORMAL_ACADEMY', Readonly<{ responsibleApplicant: RegistrationApplicantCreate; encryptedAcademyName: string; academyNameFingerprint: string; encryptedCountry: string; encryptedCity: string; encryptedOrganizationType: string; encryptedNit: string; nitFingerprint: string; authorityDeclared: true }>>
  | DraftBase<'NATURAL_PERSON_ACADEMY', Readonly<{ responsibleApplicant: RegistrationApplicantCreate; encryptedAcademyName: string; academyNameFingerprint: string; encryptedCountry: string; encryptedCity: string; encryptedTrainingPlace?: string; operationDeclared: true; proofCategories: readonly ('RUT' | 'MUNICIPAL_OR_SPORT_CERTIFICATION' | 'PLACE_USE_AUTHORIZATION' | 'OPERATION_CONTRACT_OR_REGISTER' | 'OTHER_CONTROLLED')[] }>>
  | DraftBase<'ADDITIONAL_ACADEMY_ACCOUNT', Readonly<{ applicant: RegistrationApplicantCreate; encryptedFunction: string; responsibleAuthorization: true }>>
  | DraftBase<'ACADEMY_ADULT_PLAYER', Readonly<{ player: RegistrationPlayerCreate; adultAuthorization: true }>>
  | DraftBase<'ACADEMY_MINOR_PLAYER', Readonly<{ player: RegistrationPlayerCreate; representative: RegistrationRepresentativeCreate; authorityDeclared: true }>>;

export type RegistrationPageQuery = Readonly<{ cursor?: string; limit: number; type?: RegistrationRequestType; status?: RegistrationRequestSnapshot['status'] }>;
export type RegistrationPage<T> = Readonly<{ items: readonly T[]; nextCursor?: string }>;

const SNAPSHOT_SELECT = { id: true, type: true, status: true, version: true, approvalExecutionStatus: true } as const;
const DETAIL_INCLUDE = {
  personalAdultDetail: true, representedMinorDetail: true, formalAcademyDetail: true, naturalPersonAcademyDetail: true,
  additionalAcademyAccountDetail: true, academyAdultPlayerDetail: true, academyMinorPlayerDetail: true,
  evidenceItems: { where: { replacedById: null, deletedAt: null }, select: { status: true } },
  corrections: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { id: true } },
} as const;

@Injectable()
export class RegistrationRequestRepository implements RegistrationLifecycleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createTypedDraft(input: RegistrationTypedDraftInput): Promise<RegistrationRequestSnapshot> {
    return this.prisma.$transaction((transaction) => this.createTypedDraftInTransaction(transaction, input));
  }

  async createTypedDraftInTransaction(transaction: Prisma.TransactionClient, input: RegistrationTypedDraftInput): Promise<RegistrationRequestSnapshot> {
    const request = await transaction.registrationRequest.create({
      data: {
        id: input.requestId, type: input.type,
        ...(input.ownerIdentityId === undefined ? {} : { ownerIdentityId: input.ownerIdentityId }),
        ...(input.academyContextId === undefined ? {} : { academyContextId: input.academyContextId }),
      },
      select: SNAPSHOT_SELECT,
    });
    await this.createDetail(transaction, input);
    return this.snapshot(request);
  }

  async findSnapshot(requestId: string): Promise<RegistrationRequestSnapshot | null> {
    const request = await this.prisma.registrationRequest.findUnique({ where: { id: requestId }, select: SNAPSHOT_SELECT });
    return request ? this.snapshot(request) : null;
  }

  async findIdempotentResult(input: Readonly<{ requestId: string; action: RegistrationRequestAction; idempotencyKey: string }>): Promise<RegistrationRequestSnapshot | null> {
    const record = await this.prisma.registrationRequestIdempotencyRecord.findUnique({
      where: { requestId_action_idempotencyKey: input }, select: { resultSnapshot: true },
    });
    return record ? this.parseSnapshot(record.resultSnapshot) : null;
  }

  async commitTransition(input: Readonly<{ requestId: string; action: RegistrationRequestAction; expectedVersion: number; idempotencyKey: string; transition: RegistrationTransitionResult }>) {
    return this.prisma.$transaction(async (transaction) => {
      const prior = await transaction.registrationRequestIdempotencyRecord.findUnique({
        where: { requestId_action_idempotencyKey: { requestId: input.requestId, action: input.action, idempotencyKey: input.idempotencyKey } },
        select: { resultSnapshot: true },
      });
      if (prior) return { outcome: 'idempotent' as const, snapshot: this.parseSnapshot(prior.resultSnapshot) };

      const now = new Date();
      const updated = await transaction.registrationRequest.updateMany({
        where: {
          id: input.requestId, version: input.expectedVersion,
          status: input.transition.event.priorStatus,
          ...(input.transition.snapshot.approvalExecutionStatus === 'FINALIZED' ? { approvalExecutionStatus: 'READY_TO_FINALIZE' as const } : {}),
        },
        data: {
          status: input.transition.snapshot.status,
          version: input.transition.snapshot.version,
          approvalExecutionStatus: input.transition.snapshot.approvalExecutionStatus,
          ...(['SUBMIT', 'RESUBMIT'].includes(input.action) ? { submittedAt: now } : {}),
          ...(['REJECT', 'FINALIZE_APPROVAL'].includes(input.action) ? { decidedAt: now } : {}),
        },
      });
      if (updated.count !== 1) {
        const raced = await transaction.registrationRequestIdempotencyRecord.findUnique({
          where: { requestId_action_idempotencyKey: { requestId: input.requestId, action: input.action, idempotencyKey: input.idempotencyKey } },
          select: { resultSnapshot: true },
        });
        return raced ? { outcome: 'idempotent' as const, snapshot: this.parseSnapshot(raced.resultSnapshot) } : { outcome: 'stale' as const };
      }

      const sequence = (await transaction.registrationRequestEvent.aggregate({ where: { requestId: input.requestId }, _max: { sequence: true } }))._max.sequence ?? 0;
      await transaction.registrationRequestEvent.create({ data: {
        requestId: input.requestId, sequence: sequence + 1, requestVersion: input.transition.event.requestVersion,
        actorIdentityId: input.transition.event.actorId, action: input.transition.event.action,
        priorStatus: input.transition.event.priorStatus, resultingStatus: input.transition.event.resultingStatus,
        outcome: input.transition.event.outcome,
        ...(input.transition.event.safeCategory === undefined ? {} : { safeCategory: input.transition.event.safeCategory }),
      } });
      await transaction.registrationRequestIdempotencyRecord.create({ data: {
        requestId: input.requestId, actorIdentityId: input.transition.event.actorId, action: input.action,
        idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedVersion,
        resultingVersion: input.transition.snapshot.version,
        resultSnapshot: input.transition.snapshot as unknown as Prisma.InputJsonValue,
      } });
      return { outcome: 'applied' as const, snapshot: input.transition.snapshot };
    });
  }

  listOwned(ownerIdentityId: string, query: RegistrationPageQuery) {
    return this.list({ ownerIdentityId }, query);
  }

  listAcademy(academyContextId: string, query: RegistrationPageQuery) {
    return this.list({ academyContextId }, query);
  }

  listForReview(query: RegistrationPageQuery) {
    return this.list({}, query);
  }

  private async list(scope: Prisma.RegistrationRequestWhereInput, query: RegistrationPageQuery) {
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;
    const rows = await this.prisma.registrationRequest.findMany({
      where: {
        ...scope,
        ...(query.type === undefined ? {} : { type: query.type }),
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(cursor === null ? {} : { OR: [{ updatedAt: { lt: cursor.updatedAt } }, { updatedAt: cursor.updatedAt, id: { lt: cursor.id } }] }),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: query.limit + 1,
      include: DETAIL_INCLUDE,
    });
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items.at(-1);
    return Object.freeze({ items: Object.freeze(items), ...(hasMore && last ? { nextCursor: this.encodeCursor(last.updatedAt, last.id) } : {}) });
  }

  private async createDetail(transaction: Prisma.TransactionClient, input: RegistrationTypedDraftInput): Promise<void> {
    const { detail } = input;
    if (detail.type === 'PERSONAL_ADULT') {
      const applicant = await transaction.registrationRequestApplicant.create({ data: { requestId: input.requestId, ...detail.applicant }, select: { id: true } });
      const player = await transaction.registrationRequestPlayer.create({ data: { requestId: input.requestId, ...detail.player }, select: { id: true } });
      await transaction.personalAdultRequestDetail.create({ data: { requestId: input.requestId, applicantId: applicant.id, playerId: player.id, actingForSelf: detail.actingForSelf } }); return;
    }
    if (detail.type === 'REPRESENTED_MINOR') {
      const applicant = await transaction.registrationRequestApplicant.create({ data: { requestId: input.requestId, ...detail.applicant }, select: { id: true } });
      const player = await transaction.registrationRequestPlayer.create({ data: { requestId: input.requestId, ...detail.player }, select: { id: true } });
      await transaction.representedMinorRequestDetail.create({ data: { requestId: input.requestId, applicantId: applicant.id, playerId: player.id, relationship: detail.relationship, authorityDeclared: detail.authorityDeclared } }); return;
    }
    if (detail.type === 'FORMAL_ACADEMY') {
      const responsible = await transaction.registrationRequestApplicant.create({ data: { requestId: input.requestId, ...detail.responsibleApplicant }, select: { id: true } });
      const { type: _type, responsibleApplicant: _applicant, ...data } = detail;
      await transaction.formalAcademyRequestDetail.create({ data: { requestId: input.requestId, responsibleApplicantId: responsible.id, ...data } }); return;
    }
    if (detail.type === 'NATURAL_PERSON_ACADEMY') {
      const responsible = await transaction.registrationRequestApplicant.create({ data: { requestId: input.requestId, ...detail.responsibleApplicant }, select: { id: true } });
      const { type: _type, responsibleApplicant: _applicant, proofCategories, ...data } = detail;
      await transaction.naturalPersonAcademyRequestDetail.create({ data: { requestId: input.requestId, responsibleApplicantId: responsible.id, ...data, proofCategories: [...proofCategories] } }); return;
    }
    if (detail.type === 'ADDITIONAL_ACADEMY_ACCOUNT') {
      const applicant = await transaction.registrationRequestApplicant.create({ data: { requestId: input.requestId, ...detail.applicant }, select: { id: true } });
      await transaction.additionalAcademyAccountRequestDetail.create({ data: { requestId: input.requestId, applicantId: applicant.id, encryptedFunction: detail.encryptedFunction, responsibleAuthorization: detail.responsibleAuthorization } }); return;
    }
    if (detail.type === 'ACADEMY_ADULT_PLAYER') {
      const player = await transaction.registrationRequestPlayer.create({ data: { requestId: input.requestId, ...detail.player }, select: { id: true } });
      await transaction.academyAdultPlayerRequestDetail.create({ data: { requestId: input.requestId, playerId: player.id, adultAuthorization: detail.adultAuthorization } }); return;
    }
    const player = await transaction.registrationRequestPlayer.create({ data: { requestId: input.requestId, ...detail.player }, select: { id: true } });
    const representative = await transaction.registrationRequestRepresentative.create({ data: { requestId: input.requestId, ...detail.representative }, select: { id: true } });
    await transaction.academyMinorPlayerRequestDetail.create({ data: { requestId: input.requestId, playerId: player.id, representativeId: representative.id, authorityDeclared: detail.authorityDeclared } });
  }

  private snapshot(request: RegistrationRequestSnapshot): RegistrationRequestSnapshot {
    return Object.freeze({ id: request.id, type: request.type, status: request.status, version: request.version, approvalExecutionStatus: request.approvalExecutionStatus });
  }

  private parseSnapshot(value: Prisma.JsonValue): RegistrationRequestSnapshot {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid idempotency snapshot');
    const candidate = value as Record<string, Prisma.JsonValue>;
    if (typeof candidate.id !== 'string' || typeof candidate.type !== 'string' || typeof candidate.status !== 'string' || typeof candidate.version !== 'number' || typeof candidate.approvalExecutionStatus !== 'string') throw new Error('Invalid idempotency snapshot');
    return this.snapshot(candidate as unknown as RegistrationRequestSnapshot);
  }

  private encodeCursor(updatedAt: Date, id: string): string {
    return Buffer.from(JSON.stringify({ updatedAt: updatedAt.toISOString(), id }), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): Readonly<{ updatedAt: Date; id: string }> {
    try {
      const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { updatedAt?: unknown; id?: unknown };
      const updatedAt = typeof value.updatedAt === 'string' ? new Date(value.updatedAt) : new Date(Number.NaN);
      if (typeof value.id !== 'string' || Number.isNaN(updatedAt.getTime())) throw new Error('invalid');
      return { updatedAt, id: value.id };
    } catch {
      throw new Error('Invalid registration request cursor');
    }
  }
}
