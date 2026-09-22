-- CreateEnum
CREATE TYPE "PassportOrigin" AS ENUM ('TUTOR', 'ACADEMY');

-- CreateEnum
CREATE TYPE "PassportLifecycleState" AS ENUM ('DRAFT', 'IN_REVIEW', 'RETURNED_FOR_CORRECTION', 'APPROVED', 'ACTIVE');

-- CreateEnum
CREATE TYPE "DominantFoot" AS ENUM ('LEFT', 'RIGHT', 'BOTH', 'UNDECLARED');

-- CreateEnum
CREATE TYPE "PassportPossibleDuplicateStatus" AS ENUM ('UNRESOLVED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "PassportDuplicateResolution" AS ENUM ('PENDING_REVIEW', 'DIFFERENT_PLAYERS', 'CORRECTABLE', 'CONFIRMED_EXISTING_PLAYER');

-- CreateEnum
CREATE TYPE "PassportLifecycleAction" AS ENUM ('CREATED', 'INITIAL_TUTOR_RESPONSIBILITY_ESTABLISHED', 'EDITED', 'SUBMITTED', 'RETURNED_FOR_CORRECTION', 'POSSIBLE_DUPLICATE_RESOLVED', 'APPROVED', 'ACTIVATED');

-- CreateEnum
CREATE TYPE "PassportLifecycleOutcome" AS ENUM ('APPLIED', 'DENIED', 'FAILED');
-- CreateTable
CREATE TABLE "Player" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerPrivateIdentity" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "encryptedLegalName" TEXT NOT NULL,
    "encryptedDateOfBirth" TEXT NOT NULL,
    "encryptedDocumentType" TEXT NOT NULL,
    "encryptedDocumentNumber" TEXT NOT NULL,
    "documentFingerprint" TEXT NOT NULL,
    "nameDobFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerPrivateIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerPassport" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "state" "PassportLifecycleState" NOT NULL DEFAULT 'DRAFT',
    "originKind" "PassportOrigin" NOT NULL,
    "position" TEXT NOT NULL,
    "ageCategory" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "dominantFoot" "DominantFoot" NOT NULL,
    "createdByIdentityId" UUID NOT NULL,
    "originAcademyId" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerPassport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitialTutorResponsibility" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "tutorIdentityId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InitialTutorResponsibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassportReviewReturn" (
    "id" UUID NOT NULL,
    "passportId" UUID NOT NULL,
    "analystIdentityId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassportReviewReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassportPossibleDuplicateSignal" (
    "id" UUID NOT NULL,
    "passportId" UUID NOT NULL,
    "status" "PassportPossibleDuplicateStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "resolution" "PassportDuplicateResolution" NOT NULL DEFAULT 'PENDING_REVIEW',
    "resolvedByIdentityId" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassportPossibleDuplicateSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassportLifecycleEvent" (
    "id" UUID NOT NULL,
    "passportId" UUID NOT NULL,
    "action" "PassportLifecycleAction" NOT NULL,
    "outcome" "PassportLifecycleOutcome" NOT NULL,
    "actorIdentityId" UUID NOT NULL,
    "priorState" "PassportLifecycleState",
    "resultingState" "PassportLifecycleState",
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassportLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerPrivateIdentity_playerId_key" ON "PlayerPrivateIdentity"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerPrivateIdentity_documentFingerprint_key" ON "PlayerPrivateIdentity"("documentFingerprint");

-- CreateIndex
CREATE INDEX "PlayerPrivateIdentity_nameDobFingerprint_idx" ON "PlayerPrivateIdentity"("nameDobFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerPassport_playerId_key" ON "PlayerPassport"("playerId");

-- CreateIndex
CREATE INDEX "PlayerPassport_createdByIdentityId_state_idx" ON "PlayerPassport"("createdByIdentityId", "state");

-- CreateIndex
CREATE INDEX "PlayerPassport_originAcademyId_idx" ON "PlayerPassport"("originAcademyId");

-- CreateIndex
CREATE INDEX "PlayerPassport_state_idx" ON "PlayerPassport"("state");

-- CreateIndex
CREATE UNIQUE INDEX "InitialTutorResponsibility_playerId_key" ON "InitialTutorResponsibility"("playerId");

-- CreateIndex
CREATE INDEX "InitialTutorResponsibility_tutorIdentityId_idx" ON "InitialTutorResponsibility"("tutorIdentityId");

-- CreateIndex
CREATE INDEX "PassportReviewReturn_passportId_createdAt_idx" ON "PassportReviewReturn"("passportId", "createdAt");

-- CreateIndex
CREATE INDEX "PassportPossibleDuplicateSignal_passportId_status_idx" ON "PassportPossibleDuplicateSignal"("passportId", "status");

-- CreateIndex
CREATE INDEX "PassportLifecycleEvent_passportId_createdAt_idx" ON "PassportLifecycleEvent"("passportId", "createdAt");

-- CreateIndex
CREATE INDEX "PassportLifecycleEvent_actorIdentityId_createdAt_idx" ON "PassportLifecycleEvent"("actorIdentityId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlayerPrivateIdentity" ADD CONSTRAINT "PlayerPrivateIdentity_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerPassport" ADD CONSTRAINT "PlayerPassport_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerPassport" ADD CONSTRAINT "PlayerPassport_createdByIdentityId_fkey" FOREIGN KEY ("createdByIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerPassport" ADD CONSTRAINT "PlayerPassport_originAcademyId_fkey" FOREIGN KEY ("originAcademyId") REFERENCES "Academy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitialTutorResponsibility" ADD CONSTRAINT "InitialTutorResponsibility_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitialTutorResponsibility" ADD CONSTRAINT "InitialTutorResponsibility_tutorIdentityId_fkey" FOREIGN KEY ("tutorIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportReviewReturn" ADD CONSTRAINT "PassportReviewReturn_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "PlayerPassport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportReviewReturn" ADD CONSTRAINT "PassportReviewReturn_analystIdentityId_fkey" FOREIGN KEY ("analystIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportPossibleDuplicateSignal" ADD CONSTRAINT "PassportPossibleDuplicateSignal_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "PlayerPassport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportPossibleDuplicateSignal" ADD CONSTRAINT "PassportPossibleDuplicateSignal_resolvedByIdentityId_fkey" FOREIGN KEY ("resolvedByIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportLifecycleEvent" ADD CONSTRAINT "PassportLifecycleEvent_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "PlayerPassport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportLifecycleEvent" ADD CONSTRAINT "PassportLifecycleEvent_actorIdentityId_fkey" FOREIGN KEY ("actorIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "PlayerPassport" ADD CONSTRAINT "player_passport_origin_coherent" CHECK (
  ("originKind" = 'TUTOR' AND "originAcademyId" IS NULL)
  OR ("originKind" = 'ACADEMY' AND "originAcademyId" IS NOT NULL)
);

CREATE FUNCTION "prevent_passport_lifecycle_event_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Passport lifecycle events are immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "passport_lifecycle_events_immutable"
BEFORE UPDATE OR DELETE ON "PassportLifecycleEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_passport_lifecycle_event_mutation"();