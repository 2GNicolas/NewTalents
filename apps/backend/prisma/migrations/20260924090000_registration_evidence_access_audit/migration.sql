CREATE TABLE "RegistrationEvidenceAccessAudit" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "evidenceItemId" UUID NOT NULL,
    "actorIdentityId" UUID NOT NULL,
    "category" "RegistrationEvidenceCategory" NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistrationEvidenceAccessAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RegistrationEvidenceAccessAudit_requestId_createdAt_idx" ON "RegistrationEvidenceAccessAudit"("requestId", "createdAt");
CREATE INDEX "RegistrationEvidenceAccessAudit_evidenceItemId_createdAt_idx" ON "RegistrationEvidenceAccessAudit"("evidenceItemId", "createdAt");
CREATE INDEX "RegistrationEvidenceAccessAudit_actorIdentityId_createdAt_idx" ON "RegistrationEvidenceAccessAudit"("actorIdentityId", "createdAt");

ALTER TABLE "RegistrationEvidenceAccessAudit" ADD CONSTRAINT "RegistrationEvidenceAccessAudit_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistrationEvidenceAccessAudit" ADD CONSTRAINT "RegistrationEvidenceAccessAudit_evidenceItemId_fkey" FOREIGN KEY ("evidenceItemId") REFERENCES "RegistrationEvidenceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistrationEvidenceAccessAudit" ADD CONSTRAINT "RegistrationEvidenceAccessAudit_actorIdentityId_fkey" FOREIGN KEY ("actorIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "registration_evidence_access_audits_immutable"
BEFORE UPDATE OR DELETE ON "RegistrationEvidenceAccessAudit"
FOR EACH ROW EXECUTE FUNCTION "prevent_registration_immutable_record_mutation"();
