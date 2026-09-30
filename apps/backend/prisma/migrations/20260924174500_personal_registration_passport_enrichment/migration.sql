CREATE TYPE "PassportEnrichmentStatus" AS ENUM ('COMPLETE', 'AWAITING_ANALYST_ENRICHMENT');

ALTER TABLE "PlayerPassport"
ADD COLUMN "enrichmentStatus" "PassportEnrichmentStatus" NOT NULL DEFAULT 'COMPLETE';
