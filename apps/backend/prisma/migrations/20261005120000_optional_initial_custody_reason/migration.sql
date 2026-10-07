ALTER TABLE "PassportCustodyEvent"
DROP CONSTRAINT IF EXISTS "passport_custody_event_reason_nonempty";

ALTER TABLE "PassportCustodyEvent"
ALTER COLUMN "safeReason" DROP NOT NULL;

ALTER TABLE "PassportCustodyEvent"
DROP CONSTRAINT IF EXISTS "passport_custody_event_reason_by_action";

ALTER TABLE "PassportCustodyEvent"
ADD CONSTRAINT "passport_custody_event_reason_by_action"
CHECK (
  ("action" = 'ASSIGNED' AND ("safeReason" IS NULL OR length(btrim("safeReason")) > 0))
  OR
  ("action" IN ('CHANGED', 'REMOVED') AND "safeReason" IS NOT NULL AND length(btrim("safeReason")) > 0)
);
