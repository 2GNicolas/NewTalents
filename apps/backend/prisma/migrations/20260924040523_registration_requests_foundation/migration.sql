-- CreateEnum
CREATE TYPE "RegistrationRequestType" AS ENUM ('PERSONAL_ADULT', 'REPRESENTED_MINOR', 'FORMAL_ACADEMY', 'NATURAL_PERSON_ACADEMY', 'ADDITIONAL_ACADEMY_ACCOUNT', 'ACADEMY_ADULT_PLAYER', 'ACADEMY_MINOR_PLAYER');

-- CreateEnum
CREATE TYPE "RegistrationRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REQUIRES_CORRECTION', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RegistrationApplicantAccessStatus" AS ENUM ('PENDING_ONBOARDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('QUARANTINED', 'SCANNING', 'CLEAN', 'REJECTED', 'REPLACED', 'DELETION_PENDING', 'DELETED');

-- CreateEnum
CREATE TYPE "ApprovalExecutionStatus" AS ENUM ('NONE', 'PREPARED', 'DELETING_EVIDENCE', 'READY_TO_FINALIZE', 'FINALIZED', 'RECOVERY_REQUIRED');

-- CreateEnum
CREATE TYPE "EvidenceDeletionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'RECOVERY_REQUIRED');

-- CreateEnum
CREATE TYPE "RegistrationEvidenceCategory" AS ENUM ('IDENTITY_FRONT', 'IDENTITY_BACK', 'CIVIL_IDENTITY', 'REPRESENTATION_AUTHORITY', 'RUT', 'EXISTENCE_CERTIFICATE', 'OPERATION_PROOF', 'RESPONSIBLE_AUTHORIZATION', 'ADULT_AUTHORIZATION');

-- CreateEnum
CREATE TYPE "RegistrationConsentType" AS ENUM ('PRIVACY', 'TRUTHFULNESS', 'SELF_ACTION', 'REPRESENTATION', 'MINOR_TREATMENT', 'ACADEMY_PRESENTATION');

-- CreateEnum
CREATE TYPE "RegistrationRelationshipKind" AS ENUM ('MOTHER', 'FATHER', 'LEGAL_GUARDIAN');

-- CreateEnum
CREATE TYPE "RegistrationProofOfOperationCategory" AS ENUM ('RUT', 'MUNICIPAL_OR_SPORT_CERTIFICATION', 'PLACE_USE_AUTHORIZATION', 'OPERATION_CONTRACT_OR_REGISTER', 'OTHER_CONTROLLED');

-- CreateEnum
CREATE TYPE "RegistrationReviewDecisionKind" AS ENUM ('CORRECTION_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RegistrationDuplicateSignalStatus" AS ENUM ('OPEN', 'DISTINCT', 'CONFIRMED_CONFLICT');

-- CreateEnum
CREATE TYPE "RegistrationRequestEventOutcome" AS ENUM ('APPLIED', 'DENIED', 'FAILED');

-- CreateTable
CREATE TABLE "RegistrationRequest" (
    "id" UUID NOT NULL,
    "type" "RegistrationRequestType" NOT NULL,
    "status" "RegistrationRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerIdentityId" UUID,
    "academyContextId" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "approvalExecutionStatus" "ApprovalExecutionStatus" NOT NULL DEFAULT 'NONE',
    "latestSafeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationApplicantAccess" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "identityId" UUID NOT NULL,
    "status" "RegistrationApplicantAccessStatus" NOT NULL DEFAULT 'PENDING_ONBOARDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationApplicantAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationRequestApplicant" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "identityId" UUID,
    "encryptedLegalName" TEXT NOT NULL,
    "encryptedDateOfBirth" TEXT NOT NULL,
    "encryptedDocumentType" TEXT NOT NULL,
    "encryptedDocumentNumber" TEXT NOT NULL,
    "documentFingerprint" TEXT NOT NULL,
    "nameDobFingerprint" TEXT NOT NULL,
    "encryptedEmail" TEXT,
    "emailFingerprint" TEXT,
    "encryptedPhone" TEXT,
    "phoneFingerprint" TEXT,
    "derivedAdult" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationRequestApplicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationRequestPlayer" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "linkedPlayerId" UUID,
    "encryptedLegalName" TEXT NOT NULL,
    "encryptedDateOfBirth" TEXT NOT NULL,
    "encryptedDocumentType" TEXT NOT NULL,
    "encryptedDocumentNumber" TEXT NOT NULL,
    "documentFingerprint" TEXT NOT NULL,
    "nameDobFingerprint" TEXT NOT NULL,
    "encryptedCountry" TEXT NOT NULL,
    "encryptedCity" TEXT NOT NULL,
    "derivedAdult" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationRequestPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationRequestRepresentative" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "identityId" UUID,
    "encryptedLegalName" TEXT NOT NULL,
    "encryptedDocumentType" TEXT NOT NULL,
    "encryptedDocumentNumber" TEXT NOT NULL,
    "documentFingerprint" TEXT NOT NULL,
    "encryptedPhone" TEXT NOT NULL,
    "phoneFingerprint" TEXT NOT NULL,
    "relationship" "RegistrationRelationshipKind" NOT NULL,
    "authorityDeclared" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationRequestRepresentative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalAdultRequestDetail" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "applicantId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "actingForSelf" BOOLEAN NOT NULL,

    CONSTRAINT "PersonalAdultRequestDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepresentedMinorRequestDetail" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "applicantId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "relationship" "RegistrationRelationshipKind" NOT NULL,
    "authorityDeclared" BOOLEAN NOT NULL,

    CONSTRAINT "RepresentedMinorRequestDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormalAcademyRequestDetail" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "responsibleApplicantId" UUID NOT NULL,
    "encryptedAcademyName" TEXT NOT NULL,
    "academyNameFingerprint" TEXT NOT NULL,
    "encryptedCountry" TEXT NOT NULL,
    "encryptedCity" TEXT NOT NULL,
    "encryptedOrganizationType" TEXT NOT NULL,
    "encryptedNit" TEXT NOT NULL,
    "nitFingerprint" TEXT NOT NULL,
    "authorityDeclared" BOOLEAN NOT NULL,

    CONSTRAINT "FormalAcademyRequestDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NaturalPersonAcademyRequestDetail" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "responsibleApplicantId" UUID NOT NULL,
    "encryptedAcademyName" TEXT NOT NULL,
    "academyNameFingerprint" TEXT NOT NULL,
    "encryptedCountry" TEXT NOT NULL,
    "encryptedCity" TEXT NOT NULL,
    "encryptedTrainingPlace" TEXT,
    "operationDeclared" BOOLEAN NOT NULL,
    "proofCategories" "RegistrationProofOfOperationCategory"[],

    CONSTRAINT "NaturalPersonAcademyRequestDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdditionalAcademyAccountRequestDetail" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "applicantId" UUID NOT NULL,
    "encryptedFunction" TEXT NOT NULL,
    "responsibleAuthorization" BOOLEAN NOT NULL,

    CONSTRAINT "AdditionalAcademyAccountRequestDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademyAdultPlayerRequestDetail" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "adultAuthorization" BOOLEAN NOT NULL,

    CONSTRAINT "AcademyAdultPlayerRequestDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademyMinorPlayerRequestDetail" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "representativeId" UUID NOT NULL,
    "authorityDeclared" BOOLEAN NOT NULL,

    CONSTRAINT "AcademyMinorPlayerRequestDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationEvidenceItem" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "category" "RegistrationEvidenceCategory" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "declaredMime" TEXT NOT NULL,
    "detectedMime" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "contentDigest" TEXT NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'QUARANTINED',
    "scannerResultCode" TEXT,
    "replacedById" UUID,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RegistrationEvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationConsentRecord" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "type" "RegistrationConsentType" NOT NULL,
    "textVersion" TEXT NOT NULL,
    "actorIdentityId" UUID,
    "scopeCategory" TEXT NOT NULL,
    "requestVersion" INTEGER NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationCorrectionRequest" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "requestVersion" INTEGER NOT NULL,
    "correctionTargets" TEXT[],
    "safeReason" TEXT NOT NULL,
    "administratorIdentityId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationReviewDecision" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "requestVersion" INTEGER NOT NULL,
    "kind" "RegistrationReviewDecisionKind" NOT NULL,
    "administratorIdentityId" UUID NOT NULL,
    "safeReason" TEXT,
    "internalCode" TEXT,
    "idempotencyKey" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationManualDossierConfirmation" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "requestVersion" INTEGER NOT NULL,
    "administratorIdentityId" UUID NOT NULL,
    "transferredCategories" "RegistrationEvidenceCategory"[],
    "declarationVersion" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationManualDossierConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationApprovalExecution" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "requestVersion" INTEGER NOT NULL,
    "status" "ApprovalExecutionStatus" NOT NULL DEFAULT 'PREPARED',
    "idempotencyKey" UUID NOT NULL,
    "leaseUntil" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "resultReferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "RegistrationApprovalExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationEvidenceDeletionRecord" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "requestVersion" INTEGER NOT NULL,
    "evidenceItemId" UUID NOT NULL,
    "status" "EvidenceDeletionStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "lastSafeErrorCode" TEXT,
    "verifiedAbsentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationEvidenceDeletionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationRequestEvent" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "requestVersion" INTEGER NOT NULL,
    "actorIdentityId" UUID,
    "action" TEXT NOT NULL,
    "priorStatus" "RegistrationRequestStatus",
    "resultingStatus" "RegistrationRequestStatus",
    "safeCategory" TEXT,
    "outcome" "RegistrationRequestEventOutcome" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationPrivateDuplicateSignal" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "status" "RegistrationDuplicateSignalStatus" NOT NULL DEFAULT 'OPEN',
    "signalType" TEXT NOT NULL,
    "encryptedCandidateReference" TEXT,
    "resolvedByIdentityId" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationPrivateDuplicateSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistrationRequest_ownerIdentityId_status_updatedAt_idx" ON "RegistrationRequest"("ownerIdentityId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "RegistrationRequest_academyContextId_status_updatedAt_idx" ON "RegistrationRequest"("academyContextId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "RegistrationRequest_type_status_submittedAt_idx" ON "RegistrationRequest"("type", "status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationApplicantAccess_requestId_key" ON "RegistrationApplicantAccess"("requestId");

-- CreateIndex
CREATE INDEX "RegistrationApplicantAccess_identityId_status_idx" ON "RegistrationApplicantAccess"("identityId", "status");

-- CreateIndex
CREATE INDEX "RegistrationRequestApplicant_requestId_idx" ON "RegistrationRequestApplicant"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationRequestApplicant_requestId_documentFingerprint_key" ON "RegistrationRequestApplicant"("requestId", "documentFingerprint");

-- CreateIndex
CREATE INDEX "RegistrationRequestApplicant_nameDobFingerprint_idx" ON "RegistrationRequestApplicant"("nameDobFingerprint");

-- CreateIndex
CREATE INDEX "RegistrationRequestApplicant_emailFingerprint_idx" ON "RegistrationRequestApplicant"("emailFingerprint");

-- CreateIndex
CREATE INDEX "RegistrationRequestPlayer_requestId_idx" ON "RegistrationRequestPlayer"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationRequestPlayer_requestId_documentFingerprint_key" ON "RegistrationRequestPlayer"("requestId", "documentFingerprint");

-- CreateIndex
CREATE INDEX "RegistrationRequestPlayer_nameDobFingerprint_idx" ON "RegistrationRequestPlayer"("nameDobFingerprint");

-- CreateIndex
CREATE INDEX "RegistrationRequestRepresentative_requestId_idx" ON "RegistrationRequestRepresentative"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationRequestRepresentative_requestId_documentFingerprint_key" ON "RegistrationRequestRepresentative"("requestId", "documentFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalAdultRequestDetail_requestId_key" ON "PersonalAdultRequestDetail"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "RepresentedMinorRequestDetail_requestId_key" ON "RepresentedMinorRequestDetail"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "FormalAcademyRequestDetail_requestId_key" ON "FormalAcademyRequestDetail"("requestId");

-- CreateIndex
CREATE INDEX "FormalAcademyRequestDetail_academyNameFingerprint_idx" ON "FormalAcademyRequestDetail"("academyNameFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "FormalAcademyRequestDetail_requestId_nitFingerprint_key" ON "FormalAcademyRequestDetail"("requestId", "nitFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "NaturalPersonAcademyRequestDetail_requestId_key" ON "NaturalPersonAcademyRequestDetail"("requestId");

-- CreateIndex
CREATE INDEX "NaturalPersonAcademyRequestDetail_academyNameFingerprint_idx" ON "NaturalPersonAcademyRequestDetail"("academyNameFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "AdditionalAcademyAccountRequestDetail_requestId_key" ON "AdditionalAcademyAccountRequestDetail"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademyAdultPlayerRequestDetail_requestId_key" ON "AcademyAdultPlayerRequestDetail"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademyMinorPlayerRequestDetail_requestId_key" ON "AcademyMinorPlayerRequestDetail"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationEvidenceItem_objectKey_key" ON "RegistrationEvidenceItem"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationEvidenceItem_replacedById_key" ON "RegistrationEvidenceItem"("replacedById");

-- CreateIndex
CREATE INDEX "RegistrationEvidenceItem_requestId_category_status_idx" ON "RegistrationEvidenceItem"("requestId", "category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationConsentRecord_requestId_type_requestVersion_key" ON "RegistrationConsentRecord"("requestId", "type", "requestVersion");

-- CreateIndex
CREATE INDEX "RegistrationCorrectionRequest_requestId_requestVersion_idx" ON "RegistrationCorrectionRequest"("requestId", "requestVersion");

-- CreateIndex
CREATE INDEX "RegistrationReviewDecision_requestId_requestVersion_kind_idx" ON "RegistrationReviewDecision"("requestId", "requestVersion", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationReviewDecision_administratorIdentityId_idempote_key" ON "RegistrationReviewDecision"("administratorIdentityId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationManualDossierConfirmation_requestId_requestVers_key" ON "RegistrationManualDossierConfirmation"("requestId", "requestVersion");

-- CreateIndex
CREATE INDEX "RegistrationApprovalExecution_status_leaseUntil_idx" ON "RegistrationApprovalExecution"("status", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationApprovalExecution_requestId_requestVersion_key" ON "RegistrationApprovalExecution"("requestId", "requestVersion");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationApprovalExecution_idempotencyKey_key" ON "RegistrationApprovalExecution"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RegistrationEvidenceDeletionRecord_status_nextAttemptAt_lea_idx" ON "RegistrationEvidenceDeletionRecord"("status", "nextAttemptAt", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationEvidenceDeletionRecord_evidenceItemId_requestVe_key" ON "RegistrationEvidenceDeletionRecord"("evidenceItemId", "requestVersion");

-- CreateIndex
CREATE INDEX "RegistrationRequestEvent_requestId_createdAt_idx" ON "RegistrationRequestEvent"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "RegistrationRequestEvent_actorIdentityId_createdAt_idx" ON "RegistrationRequestEvent"("actorIdentityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationRequestEvent_requestId_sequence_key" ON "RegistrationRequestEvent"("requestId", "sequence");

-- CreateIndex
CREATE INDEX "RegistrationPrivateDuplicateSignal_requestId_status_idx" ON "RegistrationPrivateDuplicateSignal"("requestId", "status");

-- AddForeignKey
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_ownerIdentityId_fkey" FOREIGN KEY ("ownerIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_academyContextId_fkey" FOREIGN KEY ("academyContextId") REFERENCES "Academy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationApplicantAccess" ADD CONSTRAINT "RegistrationApplicantAccess_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationApplicantAccess" ADD CONSTRAINT "RegistrationApplicantAccess_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequestApplicant" ADD CONSTRAINT "RegistrationRequestApplicant_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequestApplicant" ADD CONSTRAINT "RegistrationRequestApplicant_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequestPlayer" ADD CONSTRAINT "RegistrationRequestPlayer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequestPlayer" ADD CONSTRAINT "RegistrationRequestPlayer_linkedPlayerId_fkey" FOREIGN KEY ("linkedPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequestRepresentative" ADD CONSTRAINT "RegistrationRequestRepresentative_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequestRepresentative" ADD CONSTRAINT "RegistrationRequestRepresentative_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalAdultRequestDetail" ADD CONSTRAINT "PersonalAdultRequestDetail_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalAdultRequestDetail" ADD CONSTRAINT "PersonalAdultRequestDetail_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "RegistrationRequestApplicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalAdultRequestDetail" ADD CONSTRAINT "PersonalAdultRequestDetail_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "RegistrationRequestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepresentedMinorRequestDetail" ADD CONSTRAINT "RepresentedMinorRequestDetail_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepresentedMinorRequestDetail" ADD CONSTRAINT "RepresentedMinorRequestDetail_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "RegistrationRequestApplicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepresentedMinorRequestDetail" ADD CONSTRAINT "RepresentedMinorRequestDetail_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "RegistrationRequestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormalAcademyRequestDetail" ADD CONSTRAINT "FormalAcademyRequestDetail_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormalAcademyRequestDetail" ADD CONSTRAINT "FormalAcademyRequestDetail_responsibleApplicantId_fkey" FOREIGN KEY ("responsibleApplicantId") REFERENCES "RegistrationRequestApplicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NaturalPersonAcademyRequestDetail" ADD CONSTRAINT "NaturalPersonAcademyRequestDetail_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NaturalPersonAcademyRequestDetail" ADD CONSTRAINT "NaturalPersonAcademyRequestDetail_responsibleApplicantId_fkey" FOREIGN KEY ("responsibleApplicantId") REFERENCES "RegistrationRequestApplicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdditionalAcademyAccountRequestDetail" ADD CONSTRAINT "AdditionalAcademyAccountRequestDetail_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdditionalAcademyAccountRequestDetail" ADD CONSTRAINT "AdditionalAcademyAccountRequestDetail_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "RegistrationRequestApplicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyAdultPlayerRequestDetail" ADD CONSTRAINT "AcademyAdultPlayerRequestDetail_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyAdultPlayerRequestDetail" ADD CONSTRAINT "AcademyAdultPlayerRequestDetail_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "RegistrationRequestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyMinorPlayerRequestDetail" ADD CONSTRAINT "AcademyMinorPlayerRequestDetail_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyMinorPlayerRequestDetail" ADD CONSTRAINT "AcademyMinorPlayerRequestDetail_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "RegistrationRequestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyMinorPlayerRequestDetail" ADD CONSTRAINT "AcademyMinorPlayerRequestDetail_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "RegistrationRequestRepresentative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationEvidenceItem" ADD CONSTRAINT "RegistrationEvidenceItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationEvidenceItem" ADD CONSTRAINT "RegistrationEvidenceItem_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "RegistrationEvidenceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationConsentRecord" ADD CONSTRAINT "RegistrationConsentRecord_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationCorrectionRequest" ADD CONSTRAINT "RegistrationCorrectionRequest_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationCorrectionRequest" ADD CONSTRAINT "RegistrationCorrectionRequest_administratorIdentityId_fkey" FOREIGN KEY ("administratorIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationReviewDecision" ADD CONSTRAINT "RegistrationReviewDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationReviewDecision" ADD CONSTRAINT "RegistrationReviewDecision_administratorIdentityId_fkey" FOREIGN KEY ("administratorIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationManualDossierConfirmation" ADD CONSTRAINT "RegistrationManualDossierConfirmation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationManualDossierConfirmation" ADD CONSTRAINT "RegistrationManualDossierConfirmation_administratorIdentit_fkey" FOREIGN KEY ("administratorIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationApprovalExecution" ADD CONSTRAINT "RegistrationApprovalExecution_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationEvidenceDeletionRecord" ADD CONSTRAINT "RegistrationEvidenceDeletionRecord_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationEvidenceDeletionRecord" ADD CONSTRAINT "RegistrationEvidenceDeletionRecord_evidenceItemId_fkey" FOREIGN KEY ("evidenceItemId") REFERENCES "RegistrationEvidenceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequestEvent" ADD CONSTRAINT "RegistrationRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequestEvent" ADD CONSTRAINT "RegistrationRequestEvent_actorIdentityId_fkey" FOREIGN KEY ("actorIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationPrivateDuplicateSignal" ADD CONSTRAINT "RegistrationPrivateDuplicateSignal_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationPrivateDuplicateSignal" ADD CONSTRAINT "RegistrationPrivateDuplicateSignal_resolvedByIdentityId_fkey" FOREIGN KEY ("resolvedByIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Feature 006 invariants are additive and intentionally do not rewrite Feature 001-005 records.
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "registration_request_version_nonnegative" CHECK ("version" >= 0);
ALTER TABLE "RegistrationEvidenceItem" ADD CONSTRAINT "registration_evidence_size_nonnegative" CHECK ("sizeBytes" >= 0);
ALTER TABLE "RegistrationApprovalExecution" ADD CONSTRAINT "registration_approval_attempts_nonnegative" CHECK ("attempts" >= 0);
ALTER TABLE "RegistrationEvidenceDeletionRecord" ADD CONSTRAINT "registration_deletion_attempts_nonnegative" CHECK ("attempts" >= 0 AND "attempts" <= 5);
ALTER TABLE "PersonalAdultRequestDetail" ADD CONSTRAINT "personal_adult_self_declared" CHECK ("actingForSelf" = TRUE);
ALTER TABLE "RepresentedMinorRequestDetail" ADD CONSTRAINT "represented_minor_authority_declared" CHECK ("authorityDeclared" = TRUE);
ALTER TABLE "FormalAcademyRequestDetail" ADD CONSTRAINT "formal_academy_authority_declared" CHECK ("authorityDeclared" = TRUE);
ALTER TABLE "NaturalPersonAcademyRequestDetail" ADD CONSTRAINT "natural_academy_operation_declared" CHECK ("operationDeclared" = TRUE AND cardinality("proofCategories") > 0);
ALTER TABLE "AdditionalAcademyAccountRequestDetail" ADD CONSTRAINT "additional_account_authorized" CHECK ("responsibleAuthorization" = TRUE);
ALTER TABLE "AcademyAdultPlayerRequestDetail" ADD CONSTRAINT "academy_adult_authorized" CHECK ("adultAuthorization" = TRUE);
ALTER TABLE "AcademyMinorPlayerRequestDetail" ADD CONSTRAINT "academy_minor_authority_declared" CHECK ("authorityDeclared" = TRUE);

CREATE UNIQUE INDEX "RegistrationReviewDecision_one_final_per_request"
ON "RegistrationReviewDecision"("requestId") WHERE "kind" IN ('APPROVED', 'REJECTED');

CREATE FUNCTION "validate_registration_request_detail"() RETURNS trigger AS $$
DECLARE
  target_request_id uuid;
  request_type "RegistrationRequestType";
  detail_count integer;
  matching_detail boolean;
BEGIN
  IF TG_TABLE_NAME = 'RegistrationRequest' THEN
    target_request_id := COALESCE(NEW.id, OLD.id);
  ELSE
    target_request_id := COALESCE(NEW."requestId", OLD."requestId");
  END IF;

  SELECT "type" INTO request_type FROM "RegistrationRequest" WHERE id = target_request_id;
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT
    (SELECT count(*) FROM "PersonalAdultRequestDetail" WHERE "requestId" = target_request_id) +
    (SELECT count(*) FROM "RepresentedMinorRequestDetail" WHERE "requestId" = target_request_id) +
    (SELECT count(*) FROM "FormalAcademyRequestDetail" WHERE "requestId" = target_request_id) +
    (SELECT count(*) FROM "NaturalPersonAcademyRequestDetail" WHERE "requestId" = target_request_id) +
    (SELECT count(*) FROM "AdditionalAcademyAccountRequestDetail" WHERE "requestId" = target_request_id) +
    (SELECT count(*) FROM "AcademyAdultPlayerRequestDetail" WHERE "requestId" = target_request_id) +
    (SELECT count(*) FROM "AcademyMinorPlayerRequestDetail" WHERE "requestId" = target_request_id)
  INTO detail_count;

  matching_detail := CASE request_type
    WHEN 'PERSONAL_ADULT' THEN EXISTS (SELECT 1 FROM "PersonalAdultRequestDetail" WHERE "requestId" = target_request_id)
    WHEN 'REPRESENTED_MINOR' THEN EXISTS (SELECT 1 FROM "RepresentedMinorRequestDetail" WHERE "requestId" = target_request_id)
    WHEN 'FORMAL_ACADEMY' THEN EXISTS (SELECT 1 FROM "FormalAcademyRequestDetail" WHERE "requestId" = target_request_id)
    WHEN 'NATURAL_PERSON_ACADEMY' THEN EXISTS (SELECT 1 FROM "NaturalPersonAcademyRequestDetail" WHERE "requestId" = target_request_id)
    WHEN 'ADDITIONAL_ACADEMY_ACCOUNT' THEN EXISTS (SELECT 1 FROM "AdditionalAcademyAccountRequestDetail" WHERE "requestId" = target_request_id)
    WHEN 'ACADEMY_ADULT_PLAYER' THEN EXISTS (SELECT 1 FROM "AcademyAdultPlayerRequestDetail" WHERE "requestId" = target_request_id)
    WHEN 'ACADEMY_MINOR_PLAYER' THEN EXISTS (SELECT 1 FROM "AcademyMinorPlayerRequestDetail" WHERE "requestId" = target_request_id)
  END;

  IF detail_count <> 1 OR matching_detail IS NOT TRUE THEN
    RAISE EXCEPTION 'Registration request must have exactly one matching typed detail' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "registration_request_detail_matches_type"
AFTER INSERT OR UPDATE ON "RegistrationRequest"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "validate_registration_request_detail"();

CREATE CONSTRAINT TRIGGER "personal_adult_request_detail_matches_type"
AFTER INSERT OR UPDATE OR DELETE ON "PersonalAdultRequestDetail"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "validate_registration_request_detail"();
CREATE CONSTRAINT TRIGGER "represented_minor_request_detail_matches_type"
AFTER INSERT OR UPDATE OR DELETE ON "RepresentedMinorRequestDetail"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "validate_registration_request_detail"();
CREATE CONSTRAINT TRIGGER "formal_academy_request_detail_matches_type"
AFTER INSERT OR UPDATE OR DELETE ON "FormalAcademyRequestDetail"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "validate_registration_request_detail"();
CREATE CONSTRAINT TRIGGER "natural_academy_request_detail_matches_type"
AFTER INSERT OR UPDATE OR DELETE ON "NaturalPersonAcademyRequestDetail"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "validate_registration_request_detail"();
CREATE CONSTRAINT TRIGGER "additional_account_request_detail_matches_type"
AFTER INSERT OR UPDATE OR DELETE ON "AdditionalAcademyAccountRequestDetail"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "validate_registration_request_detail"();
CREATE CONSTRAINT TRIGGER "academy_adult_request_detail_matches_type"
AFTER INSERT OR UPDATE OR DELETE ON "AcademyAdultPlayerRequestDetail"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "validate_registration_request_detail"();
CREATE CONSTRAINT TRIGGER "academy_minor_request_detail_matches_type"
AFTER INSERT OR UPDATE OR DELETE ON "AcademyMinorPlayerRequestDetail"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "validate_registration_request_detail"();

CREATE FUNCTION "prevent_registration_immutable_record_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Feature 006 lifecycle records are immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "registration_request_events_immutable"
BEFORE UPDATE OR DELETE ON "RegistrationRequestEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_registration_immutable_record_mutation"();
CREATE TRIGGER "registration_consents_immutable"
BEFORE UPDATE OR DELETE ON "RegistrationConsentRecord"
FOR EACH ROW EXECUTE FUNCTION "prevent_registration_immutable_record_mutation"();
CREATE TRIGGER "registration_corrections_immutable"
BEFORE UPDATE OR DELETE ON "RegistrationCorrectionRequest"
FOR EACH ROW EXECUTE FUNCTION "prevent_registration_immutable_record_mutation"();
CREATE TRIGGER "registration_decisions_immutable"
BEFORE UPDATE OR DELETE ON "RegistrationReviewDecision"
FOR EACH ROW EXECUTE FUNCTION "prevent_registration_immutable_record_mutation"();
CREATE TRIGGER "registration_dossier_confirmations_immutable"
BEFORE UPDATE OR DELETE ON "RegistrationManualDossierConfirmation"
FOR EACH ROW EXECUTE FUNCTION "prevent_registration_immutable_record_mutation"();
