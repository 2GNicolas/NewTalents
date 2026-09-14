ALTER TABLE "TemporaryCredential" ADD COLUMN "normalizedEmail" TEXT;
UPDATE "TemporaryCredential" SET "normalizedEmail" = CONCAT('pending-', "id", '@invalid.local') WHERE "normalizedEmail" IS NULL;
ALTER TABLE "TemporaryCredential" ALTER COLUMN "normalizedEmail" SET NOT NULL;
CREATE INDEX "TemporaryCredential_normalizedEmail_idx" ON "TemporaryCredential"("normalizedEmail");
