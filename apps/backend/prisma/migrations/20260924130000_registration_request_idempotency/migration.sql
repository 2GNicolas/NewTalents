CREATE TABLE "RegistrationRequestIdempotencyRecord" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "actorIdentityId" UUID,
    "action" TEXT NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "expectedVersion" INTEGER NOT NULL,
    "resultingVersion" INTEGER NOT NULL,
    "resultSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistrationRequestIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationRequestIdempotencyRecord_requestId_action_idempotencyKey_key" ON "RegistrationRequestIdempotencyRecord"("requestId", "action", "idempotencyKey");
CREATE INDEX "RegistrationRequestIdempotencyRecord_actorIdentityId_createdAt_idx" ON "RegistrationRequestIdempotencyRecord"("actorIdentityId", "createdAt");
CREATE INDEX "RegistrationRequestIdempotencyRecord_requestId_resultingVersion_idx" ON "RegistrationRequestIdempotencyRecord"("requestId", "resultingVersion");

ALTER TABLE "RegistrationRequestIdempotencyRecord" ADD CONSTRAINT "RegistrationRequestIdempotencyRecord_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegistrationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistrationRequestIdempotencyRecord" ADD CONSTRAINT "RegistrationRequestIdempotencyRecord_actorIdentityId_fkey" FOREIGN KEY ("actorIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "registration_request_idempotency_records_immutable"
BEFORE UPDATE OR DELETE ON "RegistrationRequestIdempotencyRecord"
FOR EACH ROW EXECUTE FUNCTION "prevent_registration_immutable_record_mutation"();
