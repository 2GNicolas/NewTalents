CREATE TYPE "CredentialStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "TemporaryCredentialStatus" AS ENUM ('ISSUED', 'CONSUMED', 'INVALIDATED', 'SUPERSEDED', 'EXPIRED');
CREATE TYPE "AuthenticationSessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "RefreshTokenStatus" AS ENUM ('ISSUED', 'CONSUMED', 'REVOKED', 'EXPIRED');
CREATE TYPE "AuthenticationSecurityEventType" AS ENUM ('LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGIN_THROTTLED', 'TEMPORARY_CREDENTIAL_PROVISIONED', 'TEMPORARY_CREDENTIAL_REISSUED', 'TEMPORARY_CREDENTIAL_REPLACED', 'REFRESH_ROTATED', 'REFRESH_REUSE_DETECTED', 'SESSION_REVOKED', 'SESSIONS_REVOKED', 'INITIALIZATION_SUCCEEDED', 'INITIALIZATION_DENIED', 'RECOVERY_SUCCEEDED', 'RECOVERY_DENIED');

CREATE TABLE "AuthenticationCredential" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "identityId" UUID NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "status" "CredentialStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "activatedAt" TIMESTAMPTZ,
  "disabledAt" TIMESTAMPTZ,
  CONSTRAINT "AuthenticationCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TemporaryCredential" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "identityId" UUID NOT NULL,
  "issuedByIdentityId" UUID,
  "secretHash" TEXT NOT NULL,
  "status" "TemporaryCredentialStatus" NOT NULL DEFAULT 'ISSUED',
  "issuedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "consumedAt" TIMESTAMPTZ,
  "invalidatedAt" TIMESTAMPTZ,
  "supersededAt" TIMESTAMPTZ,
  CONSTRAINT "TemporaryCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthenticationSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "identityId" UUID NOT NULL,
  "familyId" UUID NOT NULL,
  "status" "AuthenticationSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  "revocationReason" TEXT,
  CONSTRAINT "AuthenticationSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshTokenHistory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sessionId" UUID NOT NULL,
  "digest" TEXT NOT NULL,
  "status" "RefreshTokenStatus" NOT NULL DEFAULT 'ISSUED',
  "issuedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "consumedAt" TIMESTAMPTZ,
  "revokedAt" TIMESTAMPTZ,
  "replacedAt" TIMESTAMPTZ,
  "predecessorId" UUID,
  CONSTRAINT "RefreshTokenHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthenticationAttempt" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "identityId" UUID,
  "normalizedIdentityKeyDigest" TEXT NOT NULL,
  "sourceAddressKeyDigest" TEXT NOT NULL,
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "windowEndsAt" TIMESTAMPTZ NOT NULL,
  "clearedAt" TIMESTAMPTZ,
  "expiresAt" TIMESTAMPTZ,
  CONSTRAINT "AuthenticationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthenticationSecurityEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "AuthenticationSecurityEventType" NOT NULL,
  "outcome" "ChangeOutcome" NOT NULL,
  "identityId" UUID,
  "actorIdentityId" UUID,
  "sessionId" UUID,
  "reasonCategory" TEXT,
  "details" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthenticationSecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthenticationCredential_identityId_key" ON "AuthenticationCredential"("identityId");
CREATE UNIQUE INDEX "AuthenticationCredential_normalizedEmail_key" ON "AuthenticationCredential"("normalizedEmail");
CREATE INDEX "TemporaryCredential_identityId_expiresAt_idx" ON "TemporaryCredential"("identityId", "expiresAt");
CREATE UNIQUE INDEX "temporary_credentials_one_issued_identity" ON "TemporaryCredential"("identityId") WHERE "status" = 'ISSUED';
CREATE INDEX "AuthenticationSession_identityId_status_expiresAt_idx" ON "AuthenticationSession"("identityId", "status", "expiresAt");
CREATE INDEX "AuthenticationSession_familyId_status_idx" ON "AuthenticationSession"("familyId", "status");
CREATE UNIQUE INDEX "refresh_token_history_digest_key" ON "RefreshTokenHistory"("digest");
CREATE UNIQUE INDEX "RefreshTokenHistory_predecessorId_key" ON "RefreshTokenHistory"("predecessorId");
CREATE INDEX "RefreshTokenHistory_sessionId_status_expiresAt_idx" ON "RefreshTokenHistory"("sessionId", "status", "expiresAt");
CREATE INDEX "AuthenticationAttempt_normalizedIdentityKeyDigest_sourceAddressKeyDigest_windowEndsAt_idx" ON "AuthenticationAttempt"("normalizedIdentityKeyDigest", "sourceAddressKeyDigest", "windowEndsAt");
CREATE INDEX "AuthenticationAttempt_identityId_windowEndsAt_idx" ON "AuthenticationAttempt"("identityId", "windowEndsAt");
CREATE INDEX "AuthenticationSecurityEvent_identityId_createdAt_idx" ON "AuthenticationSecurityEvent"("identityId", "createdAt");
CREATE INDEX "AuthenticationSecurityEvent_actorIdentityId_createdAt_idx" ON "AuthenticationSecurityEvent"("actorIdentityId", "createdAt");
CREATE INDEX "AuthenticationSecurityEvent_sessionId_createdAt_idx" ON "AuthenticationSecurityEvent"("sessionId", "createdAt");

ALTER TABLE "AuthenticationCredential" ADD CONSTRAINT "AuthenticationCredential_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TemporaryCredential" ADD CONSTRAINT "TemporaryCredential_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TemporaryCredential" ADD CONSTRAINT "TemporaryCredential_issuedByIdentityId_fkey" FOREIGN KEY ("issuedByIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthenticationSession" ADD CONSTRAINT "AuthenticationSession_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefreshTokenHistory" ADD CONSTRAINT "RefreshTokenHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthenticationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefreshTokenHistory" ADD CONSTRAINT "RefreshTokenHistory_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "RefreshTokenHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthenticationAttempt" ADD CONSTRAINT "AuthenticationAttempt_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthenticationSecurityEvent" ADD CONSTRAINT "AuthenticationSecurityEvent_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthenticationSecurityEvent" ADD CONSTRAINT "AuthenticationSecurityEvent_actorIdentityId_fkey" FOREIGN KEY ("actorIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthenticationSecurityEvent" ADD CONSTRAINT "AuthenticationSecurityEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthenticationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "prevent_authentication_security_event_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Authentication security events are immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "authentication_security_events_immutable"
BEFORE UPDATE OR DELETE ON "AuthenticationSecurityEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_authentication_security_event_mutation"();

CREATE FUNCTION "authentication_has_never_had_administrator_assignment"() RETURNS boolean AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM "RoleAssignment" WHERE "role" = 'ADMINISTRATOR'
  );
$$ LANGUAGE sql STABLE;

CREATE FUNCTION "authentication_has_no_active_eligible_administrator"() RETURNS boolean AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM "RoleAssignment" assignment
    INNER JOIN "Identity" identity ON identity."id" = assignment."identityId"
    WHERE assignment."role" = 'ADMINISTRATOR'
      AND assignment."status" = 'ACTIVE'
      AND identity."status" = 'ACTIVE'
  );
$$ LANGUAGE sql STABLE;
