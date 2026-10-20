CREATE TABLE "AnalystMatchUpload" (
  "loadId" UUID NOT NULL,
  "firstMatchId" UUID NOT NULL,
  "analystIdentityId" UUID NOT NULL,
  "expectedMatchVersion" INTEGER NOT NULL,
  "intentDigest" VARCHAR(64) NOT NULL,
  "participation" VARCHAR(32) NOT NULL,
  "totalMinutesPlayed" INTEGER NOT NULL,
  "youtubeUrl" VARCHAR(2048) NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalystMatchUpload_pkey" PRIMARY KEY ("loadId"),
  CONSTRAINT "AnalystMatchUpload_total_minutes_check" CHECK (
    ("participation" = 'PARTICIPATED' AND "totalMinutesPlayed" > 0) OR
    ("participation" = 'DID_NOT_PARTICIPATE' AND "totalMinutesPlayed" = 0)
  )
);

CREATE UNIQUE INDEX "AnalystMatchUpload_firstMatchId_key" ON "AnalystMatchUpload"("firstMatchId");
CREATE INDEX "AnalystMatchUpload_analystIdentityId_confirmedAt_idx" ON "AnalystMatchUpload"("analystIdentityId", "confirmedAt");
ALTER TABLE "AnalystMatchUpload" ADD CONSTRAINT "AnalystMatchUpload_firstMatchId_fkey"
  FOREIGN KEY ("firstMatchId") REFERENCES "FirstMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnalystMatchUpload" ADD CONSTRAINT "AnalystMatchUpload_analystIdentityId_fkey"
  FOREIGN KEY ("analystIdentityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AnalystMatchEvent" (
  "id" UUID NOT NULL,
  "loadId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "catalogVersion" INTEGER NOT NULL,
  "eventType" VARCHAR(48) NOT NULL,
  "variant" VARCHAR(16),
  "result" VARCHAR(32) NOT NULL,
  "videoMinute" VARCHAR(20) NOT NULL,
  "period" VARCHAR(24),
  "addedTime" INTEGER,
  "context" JSONB NOT NULL,
  "complexity" JSONB NOT NULL,
  "goalkeeperDetail" JSONB,
  "observation" TEXT,
  CONSTRAINT "AnalystMatchEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AnalystMatchEvent_sequence_check" CHECK ("sequence" > 0)
);

CREATE UNIQUE INDEX "AnalystMatchEvent_loadId_sequence_key" ON "AnalystMatchEvent"("loadId", "sequence");
ALTER TABLE "AnalystMatchEvent" ADD CONSTRAINT "AnalystMatchEvent_loadId_fkey"
  FOREIGN KEY ("loadId") REFERENCES "AnalystMatchUpload"("loadId") ON DELETE RESTRICT ON UPDATE CASCADE;
