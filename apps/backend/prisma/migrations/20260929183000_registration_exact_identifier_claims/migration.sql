CREATE TABLE "RegistrationExactIdentifierClaim" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "claimKey" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "requestId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistrationExactIdentifierClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationExactIdentifierClaim_claimKey_key"
ON "RegistrationExactIdentifierClaim"("claimKey");

CREATE INDEX "RegistrationExactIdentifierClaim_requestId_idx"
ON "RegistrationExactIdentifierClaim"("requestId");

ALTER TABLE "RegistrationExactIdentifierClaim"
ADD CONSTRAINT "RegistrationExactIdentifierClaim_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "RegistrationExactIdentifierClaim" ("claimKey", "field", "requestId")
SELECT DISTINCT ON (claim_key) claim_key, field, "requestId"
FROM (
    SELECT 'DOCUMENT:' || "documentFingerprint" AS claim_key, 'documentNumber' AS field, "requestId" FROM "RegistrationRequestApplicant"
    UNION ALL
    SELECT 'DOCUMENT:' || "documentFingerprint", 'documentNumber', "requestId" FROM "RegistrationRequestPlayer"
    UNION ALL
    SELECT 'DOCUMENT:' || "documentFingerprint", 'documentNumber', "requestId" FROM "RegistrationRequestRepresentative"
    UNION ALL
    SELECT 'NIT:' || "nitFingerprint", 'nit', "requestId" FROM "FormalAcademyRequestDetail"
) existing
ORDER BY claim_key, "requestId";
