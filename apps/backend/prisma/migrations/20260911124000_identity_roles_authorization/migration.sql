CREATE TYPE "IdentityStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "RoleStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "FunctionalRole" AS ENUM ('ADMINISTRATOR', 'ANALYST', 'TUTOR', 'ACADEMY_USER');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'ENDED');
CREATE TYPE "ChangeOutcome" AS ENUM ('APPLIED', 'DENIED', 'FAILED');

CREATE TABLE "Identity" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "status" "IdentityStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL, "deactivatedAt" TIMESTAMPTZ, CONSTRAINT "Identity_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Academy" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Academy_pkey" PRIMARY KEY ("id"));
CREATE TABLE "RoleAssignment" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "identityId" UUID NOT NULL, "role" "FunctionalRole" NOT NULL, "status" "RoleStatus" NOT NULL DEFAULT 'ACTIVE', "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMPTZ, "assignedByIdentityId" UUID NOT NULL, CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id"));
CREATE TABLE "AcademyMembership" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "identityId" UUID NOT NULL, "academyId" UUID NOT NULL, "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE', "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "endedAt" TIMESTAMPTZ, "assignedByIdentityId" UUID NOT NULL, CONSTRAINT "AcademyMembership_pkey" PRIMARY KEY ("id"));
CREATE TABLE "AuthorizationChangeRecord" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "actorIdentityId" UUID NOT NULL, "targetIdentityId" UUID NOT NULL, "operation" TEXT NOT NULL, "priorState" JSONB NOT NULL, "resultingState" JSONB NOT NULL, "outcome" "ChangeOutcome" NOT NULL, "reasonCategory" TEXT NOT NULL, "policyVersion" TEXT NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AuthorizationChangeRecord_pkey" PRIMARY KEY ("id"));

CREATE INDEX "RoleAssignment_identityId_status_idx" ON "RoleAssignment"("identityId", "status");
CREATE INDEX "AcademyMembership_academyId_status_idx" ON "AcademyMembership"("academyId", "status");
CREATE INDEX "AcademyMembership_identityId_startedAt_idx" ON "AcademyMembership"("identityId", "startedAt");
CREATE INDEX "AuthorizationChangeRecord_targetIdentityId_createdAt_idx" ON "AuthorizationChangeRecord"("targetIdentityId", "createdAt");
CREATE UNIQUE INDEX "role_assignments_one_active_role" ON "RoleAssignment"("identityId", "role") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "academy_memberships_one_active_identity" ON "AcademyMembership"("identityId") WHERE "status" = 'ACTIVE';

ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_assignedByIdentityId_fkey" FOREIGN KEY ("assignedByIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademyMembership" ADD CONSTRAINT "AcademyMembership_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademyMembership" ADD CONSTRAINT "AcademyMembership_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademyMembership" ADD CONSTRAINT "AcademyMembership_assignedByIdentityId_fkey" FOREIGN KEY ("assignedByIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthorizationChangeRecord" ADD CONSTRAINT "AuthorizationChangeRecord_actorIdentityId_fkey" FOREIGN KEY ("actorIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthorizationChangeRecord" ADD CONSTRAINT "AuthorizationChangeRecord_targetIdentityId_fkey" FOREIGN KEY ("targetIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
