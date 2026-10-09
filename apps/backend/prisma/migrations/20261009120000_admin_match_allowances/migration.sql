-- Feature 008 is additive. Existing passports, approvals, dossiers and custody rows are not rewritten.
CREATE TYPE "MatchAllowanceCadence" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

CREATE TABLE "PassportMatchAllowance" (
    "id" UUID NOT NULL,
    "passportId" UUID NOT NULL,
    "activatedOn" DATE NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PassportMatchAllowance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PassportMatchAllowanceRevision" (
    "id" UUID NOT NULL,
    "allowanceId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "expectedVersion" INTEGER NOT NULL,
    "cadence" "MatchAllowanceCadence" NOT NULL,
    "matchLimit" BIGINT NOT NULL,
    "effectiveOn" DATE NOT NULL,
    "previousCadence" "MatchAllowanceCadence",
    "previousMatchLimit" BIGINT,
    "previousEffectiveOn" DATE,
    "supersededPendingRevision" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedByIdentityId" UUID NOT NULL,
    CONSTRAINT "PassportMatchAllowanceRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PassportMatchAllowance_passportId_key"
ON "PassportMatchAllowance"("passportId");

CREATE UNIQUE INDEX "PassportMatchAllowanceRevision_allowanceId_sequence_key"
ON "PassportMatchAllowanceRevision"("allowanceId", "sequence");

CREATE UNIQUE INDEX "PassportMatchAllowanceRevision_allowanceId_idempotencyKey_key"
ON "PassportMatchAllowanceRevision"("allowanceId", "idempotencyKey");

CREATE INDEX "AllowanceRevision_effective_idx"
ON "PassportMatchAllowanceRevision"("allowanceId", "effectiveOn", "sequence");

CREATE INDEX "AllowanceRevision_actor_confirmedAt_idx"
ON "PassportMatchAllowanceRevision"("confirmedByIdentityId", "confirmedAt");

ALTER TABLE "PassportMatchAllowance"
ADD CONSTRAINT "PassportMatchAllowance_passportId_fkey"
FOREIGN KEY ("passportId") REFERENCES "PlayerPassport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PassportMatchAllowanceRevision"
ADD CONSTRAINT "PassportMatchAllowanceRevision_allowanceId_fkey"
FOREIGN KEY ("allowanceId") REFERENCES "PassportMatchAllowance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PassportMatchAllowanceRevision"
ADD CONSTRAINT "PassportMatchAllowanceRevision_confirmedByIdentityId_fkey"
FOREIGN KEY ("confirmedByIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PassportMatchAllowance"
ADD CONSTRAINT "passport_match_allowance_version_positive" CHECK ("version" >= 1);

ALTER TABLE "PassportMatchAllowanceRevision"
ADD CONSTRAINT "passport_match_allowance_revision_sequence_coherent"
CHECK ("sequence" >= 1 AND "expectedVersion" = "sequence" - 1);

ALTER TABLE "PassportMatchAllowanceRevision"
ADD CONSTRAINT "passport_match_allowance_revision_limit_safe"
CHECK ("matchLimit" BETWEEN 1 AND 9007199254740991);

ALTER TABLE "PassportMatchAllowanceRevision"
ADD CONSTRAINT "passport_match_allowance_revision_previous_limit_safe"
CHECK ("previousMatchLimit" IS NULL OR "previousMatchLimit" BETWEEN 1 AND 9007199254740991);

ALTER TABLE "PassportMatchAllowanceRevision"
ADD CONSTRAINT "passport_match_allowance_revision_snapshot_coherent"
CHECK (
    ("sequence" = 1 AND "previousCadence" IS NULL AND "previousMatchLimit" IS NULL
      AND "previousEffectiveOn" IS NULL AND "supersededPendingRevision" = false)
    OR
    ("sequence" > 1 AND "previousCadence" IS NOT NULL AND "previousMatchLimit" IS NOT NULL
      AND "previousEffectiveOn" IS NOT NULL)
);

CREATE FUNCTION "prevent_match_allowance_revision_mutation"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Match allowance revisions are immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "match_allowance_revisions_immutable"
BEFORE UPDATE OR DELETE ON "PassportMatchAllowanceRevision"
FOR EACH ROW EXECUTE FUNCTION "prevent_match_allowance_revision_mutation"();

CREATE FUNCTION "prevent_match_allowance_activation_change"() RETURNS trigger AS $$
BEGIN
    IF NEW."activatedOn" IS DISTINCT FROM OLD."activatedOn"
        OR NEW."passportId" IS DISTINCT FROM OLD."passportId" THEN
        RAISE EXCEPTION 'Match allowance activation and passport are immutable' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "match_allowance_activation_immutable"
BEFORE UPDATE ON "PassportMatchAllowance"
FOR EACH ROW EXECUTE FUNCTION "prevent_match_allowance_activation_change"();
