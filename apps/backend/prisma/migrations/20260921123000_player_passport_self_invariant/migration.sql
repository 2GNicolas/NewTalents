-- Additive invariant correction; does not rewrite prior migration history.
CREATE UNIQUE INDEX "PassportResponsibility_one_self_per_identity" ON "PassportResponsibility"("identityId") WHERE "kind" = 'SELF' AND "identityId" IS NOT NULL;
