-- Additive Feature 005 corrective foundation. Historical rows are preserved.
ALTER TYPE "FunctionalRole" ADD VALUE IF NOT EXISTS 'USER';
ALTER TYPE "PassportOrigin" ADD VALUE IF NOT EXISTS 'PARTICULAR';

CREATE TYPE "PassportResponsibilityKind" AS ENUM ('SELF', 'LEGAL_REPRESENTATIVE', 'ACADEMY');
CREATE TYPE "RepresentativeConfirmationStatus" AS ENUM ('PENDING', 'CONSUMED', 'EXPIRED', 'REVOKED');

ALTER TABLE "Academy" ADD COLUMN "displayName" TEXT;

CREATE TABLE "PassportResponsibility" (
  "id" UUID NOT NULL,
  "passportId" UUID NOT NULL,
  "identityId" UUID,
  "academyId" UUID,
  "kind" "PassportResponsibilityKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PassportResponsibility_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PassportResponsibility_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "PlayerPassport"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PassportResponsibility_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PassportResponsibility_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PassportResponsibility_passportId_kind_identityId_key" ON "PassportResponsibility"("passportId", "kind", "identityId");
CREATE INDEX "PassportResponsibility_identityId_kind_idx" ON "PassportResponsibility"("identityId", "kind");
CREATE INDEX "PassportResponsibility_academyId_kind_idx" ON "PassportResponsibility"("academyId", "kind");

CREATE TABLE "RepresentativeConfirmation" (
  "id" UUID NOT NULL,
  "passportId" UUID,
  "representativeIdentityId" UUID NOT NULL,
  "encryptedLegalName" TEXT NOT NULL,
  "encryptedDocumentType" TEXT NOT NULL,
  "encryptedDocumentNumber" TEXT NOT NULL,
  "documentFingerprint" TEXT NOT NULL,
  "playerDocumentBinding" TEXT NOT NULL,
  "status" "RepresentativeConfirmationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RepresentativeConfirmation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RepresentativeConfirmation_representativeIdentityId_fkey" FOREIGN KEY ("representativeIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "RepresentativeConfirmation_representativeIdentityId_status_expiresAt_idx" ON "RepresentativeConfirmation"("representativeIdentityId", "status", "expiresAt");
CREATE INDEX "RepresentativeConfirmation_playerDocumentBinding_status_idx" ON "RepresentativeConfirmation"("playerDocumentBinding", "status");

CREATE TABLE "HistoricalTutorReconciliationAudit" (
  "id" UUID NOT NULL,
  "actorIdentityId" UUID NOT NULL,
  "legacyResponsibilityId" TEXT,
  "outcome" TEXT NOT NULL,
  "reasonCategory" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricalTutorReconciliationAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HistoricalTutorReconciliationAudit_actorIdentityId_fkey" FOREIGN KEY ("actorIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "HistoricalTutorReconciliationAudit_actorIdentityId_createdAt_idx" ON "HistoricalTutorReconciliationAudit"("actorIdentityId", "createdAt");
