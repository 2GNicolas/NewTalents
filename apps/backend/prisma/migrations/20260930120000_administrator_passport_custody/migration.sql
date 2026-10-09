-- CreateEnum
CREATE TYPE "RegistrationAdminReviewStage" AS ENUM ('OPENED', 'REVIEWED');

-- CreateEnum
CREATE TYPE "PassportCustodyAction" AS ENUM ('ASSIGNED', 'CHANGED', 'REMOVED');

-- CreateTable
CREATE TABLE "RegistrationAdminReviewProgress" (
    "requestId" UUID NOT NULL,
    "stage" "RegistrationAdminReviewStage" NOT NULL,
    "observedRequestVersion" INTEGER NOT NULL,
    "startedByIdentityId" UUID NOT NULL,
    "lastUpdatedByIdentityId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationAdminReviewProgress_pkey" PRIMARY KEY ("requestId")
);

-- CreateTable
CREATE TABLE "AnalystOperationalProfile" (
    "identityId" UUID NOT NULL,
    "displayLabel" VARCHAR(120) NOT NULL,
    "normalizedLabel" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalystOperationalProfile_pkey" PRIMARY KEY ("identityId")
);

-- CreateTable
CREATE TABLE "PassportCustody" (
    "id" UUID NOT NULL,
    "passportId" UUID NOT NULL,
    "currentAnalystIdentityId" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "assignedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassportCustody_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassportCustodyEvent" (
    "id" UUID NOT NULL,
    "passportId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "action" "PassportCustodyAction" NOT NULL,
    "administratorIdentityId" UUID NOT NULL,
    "previousAnalystIdentityId" UUID,
    "nextAnalystIdentityId" UUID,
    "safeReason" VARCHAR(500) NOT NULL,
    "expectedVersion" INTEGER NOT NULL,
    "resultingVersion" INTEGER NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassportCustodyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistrationAdminReviewProgress_stage_updatedAt_requestId_idx"
ON "RegistrationAdminReviewProgress"("stage", "updatedAt", "requestId");

-- CreateIndex
CREATE INDEX "AnalystOperationalProfile_normalizedLabel_identityId_idx"
ON "AnalystOperationalProfile"("normalizedLabel", "identityId");

-- CreateIndex
CREATE UNIQUE INDEX "PassportCustody_passportId_key" ON "PassportCustody"("passportId");

-- CreateIndex
CREATE INDEX "PassportCustody_currentAnalystIdentityId_updatedAt_passportId_idx"
ON "PassportCustody"("currentAnalystIdentityId", "updatedAt", "passportId");

-- CreateIndex
CREATE INDEX "PassportCustody_updatedAt_passportId_idx" ON "PassportCustody"("updatedAt", "passportId");

-- CreateIndex
CREATE UNIQUE INDEX "PassportCustodyEvent_idempotencyKey_key" ON "PassportCustodyEvent"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PassportCustodyEvent_passportId_sequence_key"
ON "PassportCustodyEvent"("passportId", "sequence");

-- CreateIndex
CREATE INDEX "PassportCustodyEvent_passportId_createdAt_id_idx"
ON "PassportCustodyEvent"("passportId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "PassportCustodyEvent_administratorIdentityId_createdAt_idx"
ON "PassportCustodyEvent"("administratorIdentityId", "createdAt");

-- AddForeignKey
ALTER TABLE "RegistrationAdminReviewProgress"
ADD CONSTRAINT "RegistrationAdminReviewProgress_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationAdminReviewProgress"
ADD CONSTRAINT "RegistrationAdminReviewProgress_startedByIdentityId_fkey"
FOREIGN KEY ("startedByIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationAdminReviewProgress"
ADD CONSTRAINT "RegistrationAdminReviewProgress_lastUpdatedByIdentityId_fkey"
FOREIGN KEY ("lastUpdatedByIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalystOperationalProfile"
ADD CONSTRAINT "AnalystOperationalProfile_identityId_fkey"
FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportCustody"
ADD CONSTRAINT "PassportCustody_passportId_fkey"
FOREIGN KEY ("passportId") REFERENCES "PlayerPassport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportCustody"
ADD CONSTRAINT "PassportCustody_currentAnalystIdentityId_fkey"
FOREIGN KEY ("currentAnalystIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportCustodyEvent"
ADD CONSTRAINT "PassportCustodyEvent_passportId_fkey"
FOREIGN KEY ("passportId") REFERENCES "PlayerPassport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportCustodyEvent"
ADD CONSTRAINT "PassportCustodyEvent_administratorIdentityId_fkey"
FOREIGN KEY ("administratorIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportCustodyEvent"
ADD CONSTRAINT "PassportCustodyEvent_previousAnalystIdentityId_fkey"
FOREIGN KEY ("previousAnalystIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportCustodyEvent"
ADD CONSTRAINT "PassportCustodyEvent_nextAnalystIdentityId_fkey"
FOREIGN KEY ("nextAnalystIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Feature 007 invariants are additive and do not rewrite Feature 001-006 records.
ALTER TABLE "RegistrationAdminReviewProgress"
ADD CONSTRAINT "registration_admin_review_progress_version_nonnegative"
CHECK ("observedRequestVersion" >= 0);

ALTER TABLE "AnalystOperationalProfile"
ADD CONSTRAINT "analyst_operational_profile_labels_nonempty"
CHECK (length(btrim("displayLabel")) > 0 AND length(btrim("normalizedLabel")) > 0);

ALTER TABLE "PassportCustody"
ADD CONSTRAINT "passport_custody_version_nonnegative"
CHECK ("version" >= 0);

ALTER TABLE "PassportCustody"
ADD CONSTRAINT "passport_custody_assignment_coherent"
CHECK (
  ("currentAnalystIdentityId" IS NULL AND "assignedAt" IS NULL)
  OR
  ("currentAnalystIdentityId" IS NOT NULL AND "assignedAt" IS NOT NULL)
);

ALTER TABLE "PassportCustodyEvent"
ADD CONSTRAINT "passport_custody_event_sequence_positive"
CHECK ("sequence" > 0);

ALTER TABLE "PassportCustodyEvent"
ADD CONSTRAINT "passport_custody_event_versions_coherent"
CHECK ("expectedVersion" >= 0 AND "resultingVersion" = "expectedVersion" + 1);

ALTER TABLE "PassportCustodyEvent"
ADD CONSTRAINT "passport_custody_event_reason_nonempty"
CHECK (length(btrim("safeReason")) > 0);

ALTER TABLE "PassportCustodyEvent"
ADD CONSTRAINT "passport_custody_event_action_coherent"
CHECK (
  ("action" = 'ASSIGNED' AND "previousAnalystIdentityId" IS NULL AND "nextAnalystIdentityId" IS NOT NULL)
  OR
  ("action" = 'CHANGED' AND "previousAnalystIdentityId" IS NOT NULL AND "nextAnalystIdentityId" IS NOT NULL AND "previousAnalystIdentityId" <> "nextAnalystIdentityId")
  OR
  ("action" = 'REMOVED' AND "previousAnalystIdentityId" IS NOT NULL AND "nextAnalystIdentityId" IS NULL)
);

CREATE FUNCTION "prevent_passport_custody_event_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Passport custody events are immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "passport_custody_events_immutable"
BEFORE UPDATE OR DELETE ON "PassportCustodyEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_passport_custody_event_mutation"();
