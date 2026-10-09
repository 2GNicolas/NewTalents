import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PASSPORT_KEY_MATERIAL } from '../../player-passport/passport-key.token.js';
import { decryptPassportValue } from '../../player-passport/player-private-identity/passport-crypto.js';
import type { PassportKeyMaterial } from '../../player-passport/player-private-identity/passport-keys.js';
import { REGISTRATION_TYPED_REQUEST_APPLICATION, type RegistrationTypedRequestApplication } from '../application/applicant-request.service.js';
import { RegistrationAuthorizationAdapter } from '../authorization/registration-authorization.adapter.js';
import { RegistrationRequestHistoryService } from '../history/registration-request-history.service.js';
import { colombiaMunicipalityLabel } from '../validation/colombia-municipality-codes.js';

const REVIEW_CAPABILITIES = [
  'registration.review.view',
  'registration.review.view-evidence',
  'registration.review.request-correction',
  'registration.review.confirm-dossier',
  'registration.review.approve',
  'registration.review.reject',
  'registration.review.view-deletion-status',
  'registration.review.retry-deletion',
] as const;

const REVIEW_INCLUDE = {
  academyContext: { select: { id: true, displayName: true } },
  applicants: true,
  players: true,
  representatives: true,
  personalAdultDetail: true,
  representedMinorDetail: true,
  formalAcademyDetail: true,
  naturalPersonAcademyDetail: true,
  additionalAcademyAccountDetail: true,
  academyAdultPlayerDetail: true,
  academyMinorPlayerDetail: true,
  evidenceItems: { where: { replacedById: null, deletedAt: null }, orderBy: { uploadedAt: 'asc' as const } },
  consents: { orderBy: { acceptedAt: 'asc' as const } },
  corrections: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  dossierConfirmations: { orderBy: { confirmedAt: 'desc' as const } },
  deletionRecords: { orderBy: { updatedAt: 'desc' as const } },
  duplicateSignals: true,
} satisfies Prisma.RegistrationRequestInclude;

type ReviewRequest = Prisma.RegistrationRequestGetPayload<{ include: typeof REVIEW_INCLUDE }>;

@Injectable()
export class AdminRegistrationReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: RegistrationAuthorizationAdapter,
    private readonly history: RegistrationRequestHistoryService,
    @Inject(REGISTRATION_TYPED_REQUEST_APPLICATION) private readonly typed: RegistrationTypedRequestApplication,
    @Inject(PASSPORT_KEY_MATERIAL) private readonly keys: PassportKeyMaterial,
  ) {}

  async detail(identityId: string, requestId: string, expectedVersion?: number) {
    const access = await this.authorization.authorize({ identityId, permission: 'registration.review.view', requestId });
    if (!access.allowed) return { outcome: 'not-found' as const };
    const request = await this.prisma.registrationRequest.findUnique({
      where: { id: requestId },
      include: REVIEW_INCLUDE,
    });
    if (!request) return { outcome: 'not-found' as const };

    const currentEvidence = request.evidenceItems;
    const evidenceCompleteAndClean = currentEvidence.length > 0 && currentEvidence.every((item) => item.status === 'CLEAN');
    const duplicateReview = this.duplicateReview(request.duplicateSignals);
    const dossier = request.dossierConfirmations.find((item) => item.requestVersion === request.version);
    const deletionState = this.deletionState(request.deletionRecords);
    const readiness = await this.typed.readiness(requestId);
    const reviewVersion = expectedVersion ?? request.version;
    const capabilities = await this.authorization.projectCapabilities({
      identityId,
      requestId,
      expectedVersion: reviewVersion,
      evidenceCompleteAndClean,
      duplicateConflictAbsent: duplicateReview.canApprove,
      manualDossierConfirmed: Boolean(dossier),
      ...(deletionState ? { deletionState: deletionState === 'IN_PROGRESS' ? 'PENDING' as const : deletionState } : {}),
      ...readiness,
    }, REVIEW_CAPABILITIES);
    const history = await this.history.administratorHistory(requestId);

    return Object.freeze({ outcome: 'found' as const, request: Object.freeze({
      id: request.id,
      type: request.type,
      status: request.status,
      version: request.version,
      versionFresh: reviewVersion === request.version,
      approvalExecutionStatus: request.approvalExecutionStatus,
      createdAt: request.createdAt.toISOString(),
      ...(request.submittedAt ? { submittedAt: request.submittedAt.toISOString() } : {}),
      ...(request.latestSafeReason ? { safeReason: request.latestSafeReason } : {}),
      ...(request.academyContext ? { academy: Object.freeze({ id: request.academyContext.id, label: request.academyContext.displayName ?? 'Academia' }) } : {}),
      structuredData: this.structuredData(request),
      evidence: Object.freeze(currentEvidence.map(({ id, category, status, sizeBytes }) => Object.freeze({ id, category, status, sizeBytes, correctionRequired: request.corrections[0]?.correctionTargets.includes(category) ?? false }))),
      consents: Object.freeze(request.consents.filter((item) => item.requestVersion === request.version).map((item) => Object.freeze({ type: item.type, version: item.textVersion, acceptedAt: item.acceptedAt.toISOString() }))),
      duplicateReview,
      ...(dossier ? { dossier: Object.freeze({ declarationVersion: dossier.declarationVersion, categories: Object.freeze([...dossier.transferredCategories]), confirmedAt: dossier.confirmedAt.toISOString() }) } : {}),
      ...(deletionState ? { deletion: this.deletionView(request.deletionRecords, deletionState) } : {}),
      capabilities: Object.freeze(capabilities),
      history: Object.freeze(history.map(({ at, action, fromStatus, toStatus, result, category }) => Object.freeze({ at, action, ...(fromStatus ? { fromStatus } : {}), ...(toStatus ? { toStatus } : {}), result, ...(category ? { category } : {}) }))),
    }) });
  }

  private structuredData(request: ReviewRequest) {
    const applicants = request.applicants.map((person) => Object.freeze({
      id: person.id,
      legalName: this.decrypt(person.encryptedLegalName),
      birthDate: this.decrypt(person.encryptedDateOfBirth),
      document: Object.freeze({ type: this.decrypt(person.encryptedDocumentType), number: this.decrypt(person.encryptedDocumentNumber) }),
      ...(person.encryptedEmail ? { email: this.decrypt(person.encryptedEmail) } : {}),
      ...(person.encryptedPhone ? { phone: this.decrypt(person.encryptedPhone) } : {}),
      derivedAdult: person.derivedAdult,
    }));
    const players = request.players.map((person) => Object.freeze({
      id: person.id,
      legalName: this.decrypt(person.encryptedLegalName),
      birthDate: this.decrypt(person.encryptedDateOfBirth),
      document: Object.freeze({ type: this.decrypt(person.encryptedDocumentType), number: this.decrypt(person.encryptedDocumentNumber) }),
      country: this.decrypt(person.encryptedCountry),
      city: colombiaMunicipalityLabel(this.decrypt(person.encryptedCity)),
      derivedAdult: person.derivedAdult,
    }));
    const representatives = request.representatives.map((person) => Object.freeze({
      id: person.id,
      legalName: this.decrypt(person.encryptedLegalName),
      document: Object.freeze({ type: this.decrypt(person.encryptedDocumentType), number: this.decrypt(person.encryptedDocumentNumber) }),
      phone: this.decrypt(person.encryptedPhone),
      relationship: person.relationship,
      authorityDeclared: person.authorityDeclared,
    }));
    return Object.freeze({ applicants: Object.freeze(applicants), players: Object.freeze(players), representatives: Object.freeze(representatives), detail: this.typedDetail(request) });
  }

  private typedDetail(request: ReviewRequest) {
    if (request.type === 'PERSONAL_ADULT') return Object.freeze({ actingForSelf: request.personalAdultDetail?.actingForSelf === true });
    if (request.type === 'REPRESENTED_MINOR') return Object.freeze({ relationship: request.representedMinorDetail?.relationship, authorityDeclared: request.representedMinorDetail?.authorityDeclared === true });
    if (request.type === 'FORMAL_ACADEMY') return Object.freeze({ academyName: this.decrypt(request.formalAcademyDetail?.encryptedAcademyName), country: this.decrypt(request.formalAcademyDetail?.encryptedCountry), city: colombiaMunicipalityLabel(this.decrypt(request.formalAcademyDetail?.encryptedCity)), organizationType: this.decrypt(request.formalAcademyDetail?.encryptedOrganizationType), nit: this.decrypt(request.formalAcademyDetail?.encryptedNit), authorityDeclared: request.formalAcademyDetail?.authorityDeclared === true });
    if (request.type === 'NATURAL_PERSON_ACADEMY') return Object.freeze({ academyName: this.decrypt(request.naturalPersonAcademyDetail?.encryptedAcademyName), country: this.decrypt(request.naturalPersonAcademyDetail?.encryptedCountry), city: colombiaMunicipalityLabel(this.decrypt(request.naturalPersonAcademyDetail?.encryptedCity)), ...(request.naturalPersonAcademyDetail?.encryptedTrainingPlace ? { trainingPlace: this.decrypt(request.naturalPersonAcademyDetail.encryptedTrainingPlace) } : {}), operationDeclared: request.naturalPersonAcademyDetail?.operationDeclared === true, proofCategories: Object.freeze([...(request.naturalPersonAcademyDetail?.proofCategories ?? [])]) });
    if (request.type === 'ADDITIONAL_ACADEMY_ACCOUNT') return Object.freeze({ function: this.decrypt(request.additionalAcademyAccountDetail?.encryptedFunction), responsibleAuthorization: request.additionalAcademyAccountDetail?.responsibleAuthorization === true });
    if (request.type === 'ACADEMY_ADULT_PLAYER') return Object.freeze({ adultAuthorization: request.academyAdultPlayerDetail?.adultAuthorization === true });
    return Object.freeze({ authorityDeclared: request.academyMinorPlayerDetail?.authorityDeclared === true });
  }

  private duplicateReview(signals: readonly Readonly<{ status: string }>[]) {
    if (signals.some(({ status }) => status === 'CONFIRMED_CONFLICT')) return Object.freeze({ state: 'CONFLICT' as const, canApprove: false });
    if (signals.some(({ status }) => status === 'OPEN')) return Object.freeze({ state: 'REVIEW_REQUIRED' as const, canApprove: false });
    if (signals.some(({ status }) => status === 'DISTINCT')) return Object.freeze({ state: 'RESOLVED_DISTINCT' as const, canApprove: true });
    return Object.freeze({ state: 'CLEAR' as const, canApprove: true });
  }

  private deletionState(items: readonly Readonly<{ status: string }>[]) {
    if (items.length === 0) return undefined;
    if (items.some(({ status }) => status === 'RECOVERY_REQUIRED')) return 'RECOVERY_REQUIRED' as const;
    if (items.every(({ status }) => status === 'COMPLETED')) return 'COMPLETED' as const;
    if (items.some(({ status }) => status === 'IN_PROGRESS')) return 'IN_PROGRESS' as const;
    return 'PENDING' as const;
  }

  private deletionView(items: readonly Readonly<{ status: string; updatedAt: Date }>[], status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'RECOVERY_REQUIRED') {
    return Object.freeze({ status, totalItems: items.length, completedItems: items.filter((item) => item.status === 'COMPLETED').length, lastUpdatedAt: items[0]?.updatedAt.toISOString() });
  }

  private decrypt(value: string | null | undefined): string {
    return value ? decryptPassportValue(this.keys.privateEncryptionKey, value) : '';
  }
}
