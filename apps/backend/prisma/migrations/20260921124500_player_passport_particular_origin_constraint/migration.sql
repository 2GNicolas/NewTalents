-- Extend the historical origin invariant for the corrective PARTICULAR origin.
ALTER TABLE "PlayerPassport"
  DROP CONSTRAINT "player_passport_origin_coherent";

ALTER TABLE "PlayerPassport"
  ADD CONSTRAINT "player_passport_origin_coherent" CHECK (
    ("originKind" IN ('TUTOR', 'PARTICULAR') AND "originAcademyId" IS NULL)
    OR ("originKind" = 'ACADEMY' AND "originAcademyId" IS NOT NULL)
  );
