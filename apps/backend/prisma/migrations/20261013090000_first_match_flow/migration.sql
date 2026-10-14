-- Feature 009 foundation: one match-owned allowance unit; existing 005-008 rows are untouched.
CREATE TYPE "FirstMatchState" AS ENUM ('WAITING', 'CANCELED', 'LOADED');
CREATE TYPE "FirstMatchUnitState" AS ENUM ('RESERVED', 'RELEASED', 'USED');
CREATE TYPE "FirstMatchAction" AS ENUM ('SCHEDULE', 'RESCHEDULE', 'CANCEL', 'LOAD_CONFIRMED');

-- Composite FK makes a match's player the passport's player, including on later updates.
CREATE UNIQUE INDEX "PlayerPassport_id_playerId_key" ON "PlayerPassport"("id", "playerId");

CREATE TABLE "FirstMatch" (
    "id" UUID NOT NULL,
    "passportId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "matchDate" DATE NOT NULL,
    "matchTime" VARCHAR(5) NOT NULL,
    "opponent" VARCHAR(160) NOT NULL,
    "competition" VARCHAR(160) NOT NULL,
    "venue" VARCHAR(160) NOT NULL,
    "scheduledByIdentityId" UUID NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" "FirstMatchState" NOT NULL DEFAULT 'WAITING',
    "unitState" "FirstMatchUnitState" NOT NULL DEFAULT 'RESERVED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "loadedByAnalystIdentityId" UUID,
    "loadId" UUID,
    "loadedAt" TIMESTAMP(3),
    "canceledByIdentityId" UUID,
    "canceledAt" TIMESTAMP(3),
    CONSTRAINT "FirstMatch_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "first_match_state_unit_coherent" CHECK (
      ("state" = 'WAITING' AND "unitState" = 'RESERVED'
        AND "loadedByAnalystIdentityId" IS NULL AND "loadId" IS NULL AND "loadedAt" IS NULL
        AND "canceledByIdentityId" IS NULL AND "canceledAt" IS NULL)
      OR ("state" = 'CANCELED' AND "unitState" = 'RELEASED'
        AND "canceledByIdentityId" IS NOT NULL AND "canceledAt" IS NOT NULL
        AND "loadedByAnalystIdentityId" IS NULL AND "loadId" IS NULL AND "loadedAt" IS NULL)
      OR ("state" = 'LOADED' AND "unitState" = 'USED'
        AND "loadedByAnalystIdentityId" IS NOT NULL AND "loadId" IS NOT NULL AND "loadedAt" IS NOT NULL
        AND "canceledByIdentityId" IS NULL AND "canceledAt" IS NULL)
    ),
    CONSTRAINT "first_match_version_positive" CHECK ("version" >= 1),
    CONSTRAINT "first_match_time_format" CHECK ("matchTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    CONSTRAINT "first_match_labels_nonempty" CHECK (
      length(btrim("opponent")) > 0 AND length(btrim("competition")) > 0 AND length(btrim("venue")) > 0)
);

CREATE UNIQUE INDEX "FirstMatch_id_passportId_key" ON "FirstMatch"("id", "passportId");
CREATE UNIQUE INDEX "FirstMatch_loadId_key" ON "FirstMatch"("loadId");
CREATE UNIQUE INDEX "FirstMatch_one_current_per_passport" ON "FirstMatch"("passportId")
  WHERE "state" IN ('WAITING', 'LOADED');
CREATE INDEX "FirstMatch_passportId_matchDate_unitState_idx"
  ON "FirstMatch"("passportId", "matchDate", "unitState");

ALTER TABLE "FirstMatch" ADD CONSTRAINT "FirstMatch_passportId_playerId_fkey"
  FOREIGN KEY ("passportId", "playerId") REFERENCES "PlayerPassport"("id", "playerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FirstMatch" ADD CONSTRAINT "FirstMatch_scheduledByIdentityId_fkey"
  FOREIGN KEY ("scheduledByIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FirstMatch" ADD CONSTRAINT "FirstMatch_loadedByAnalystIdentityId_fkey"
  FOREIGN KEY ("loadedByAnalystIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FirstMatch" ADD CONSTRAINT "FirstMatch_canceledByIdentityId_fkey"
  FOREIGN KEY ("canceledByIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "FirstMatchIntent" (
    "id" UUID NOT NULL,
    "passportId" UUID NOT NULL,
    "matchId" UUID,
    "idempotencyKey" UUID NOT NULL,
    "action" "FirstMatchAction" NOT NULL,
    "intentDigest" VARCHAR(64) NOT NULL,
    "actorIdentityId" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" VARCHAR(32) NOT NULL,
    "resultVersion" INTEGER NOT NULL,
    CONSTRAINT "FirstMatchIntent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "first_match_intent_digest_format" CHECK ("intentDigest" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "first_match_intent_version_positive" CHECK ("resultVersion" >= 1),
    CONSTRAINT "first_match_intent_outcome_nonempty" CHECK (length(btrim("outcome")) > 0)
);

CREATE UNIQUE INDEX "FirstMatchIntent_passportId_idempotencyKey_key"
  ON "FirstMatchIntent"("passportId", "idempotencyKey");
CREATE INDEX "FirstMatchIntent_matchId_occurredAt_idx" ON "FirstMatchIntent"("matchId", "occurredAt");
ALTER TABLE "FirstMatchIntent" ADD CONSTRAINT "FirstMatchIntent_passportId_fkey"
  FOREIGN KEY ("passportId") REFERENCES "PlayerPassport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FirstMatchIntent" ADD CONSTRAINT "FirstMatchIntent_matchId_passportId_fkey"
  FOREIGN KEY ("matchId", "passportId") REFERENCES "FirstMatch"("id", "passportId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FirstMatchIntent" ADD CONSTRAINT "FirstMatchIntent_actorIdentityId_fkey"
  FOREIGN KEY ("actorIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "guard_first_match_update"() RETURNS trigger AS $$
BEGIN
  IF NEW."passportId" IS DISTINCT FROM OLD."passportId"
    OR NEW."playerId" IS DISTINCT FROM OLD."playerId"
    OR NEW."scheduledByIdentityId" IS DISTINCT FROM OLD."scheduledByIdentityId"
    OR NEW."scheduledAt" IS DISTINCT FROM OLD."scheduledAt" THEN
    RAISE EXCEPTION 'First match identity and scheduler are immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'First match version must increase once' USING ERRCODE = '23514';
  END IF;
  IF OLD."state" = 'CANCELED' OR OLD."state" = 'LOADED' THEN
    RAISE EXCEPTION 'Terminal first match cannot change' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "first_match_update_guard" BEFORE UPDATE ON "FirstMatch"
  FOR EACH ROW EXECUTE FUNCTION "guard_first_match_update"();

CREATE FUNCTION "prevent_first_match_intent_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'First match intents are immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "first_match_intents_immutable" BEFORE UPDATE OR DELETE ON "FirstMatchIntent"
  FOR EACH ROW EXECUTE FUNCTION "prevent_first_match_intent_mutation"();
