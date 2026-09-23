-- Build preset: Company HQ core + rotation FKs (drop catalogue junction)

ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "longRunCycleWeeks" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "minWeeklyMiles" INTEGER NOT NULL DEFAULT 40;
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "maxWeeklyMiles" INTEGER;
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "baseLongRunPoolMiles" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "peakLongRunPoolMiles" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "taperLongRunPoolMiles" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "tempoIdealDow" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "intervalIdealDow" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "longRunDefaultDow" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "longRunConfigId" TEXT;
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "intervalsConfigId" TEXT;
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "tempoConfigId" TEXT;
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "easyConfigId" TEXT;
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "easyRunConfig" JSONB;
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "coachPlanOverview" JSONB;
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "workoutStructure" JSONB;

-- Legacy snap columns → HQ names
UPDATE "build_preset"
SET
  "peakLongRunPoolMiles" = COALESCE("peakLongRunMiles", "peakLongRunPoolMiles"),
  "maxWeeklyMiles" = COALESCE("peakWeeklyMiles", "maxWeeklyMiles")
WHERE "peakLongRunMiles" IS NOT NULL OR "peakWeeklyMiles" IS NOT NULL;

-- Copy monolithic preset body onto linked build rows
UPDATE "build_preset" b
SET
  "longRunCycleWeeks" = p."longRunCycleWeeks",
  "minWeeklyMiles" = p."minWeeklyMiles",
  "maxWeeklyMiles" = COALESCE(b."maxWeeklyMiles", p."maxWeeklyMiles"),
  "baseLongRunPoolMiles" = p."baseLongRunPoolMiles",
  "peakLongRunPoolMiles" = CASE
    WHEN b."peakLongRunPoolMiles" > 0 THEN b."peakLongRunPoolMiles"
    ELSE p."peakLongRunPoolMiles"
  END,
  "taperLongRunPoolMiles" = p."taperLongRunPoolMiles",
  "tempoIdealDow" = p."tempoIdealDow",
  "intervalIdealDow" = p."intervalIdealDow",
  "longRunDefaultDow" = p."longRunDefaultDow",
  "longRunConfigId" = p."longRunConfigId",
  "intervalsConfigId" = p."intervalsConfigId",
  "tempoConfigId" = p."tempoConfigId",
  "easyConfigId" = p."easyConfigId",
  "easyRunConfig" = p."easyRunConfig",
  "coachPlanOverview" = p."coachPlanOverview",
  "workoutStructure" = p."workoutStructure"
FROM "training_plan_preset" p
WHERE p."buildPresetId" = b.id;

ALTER TABLE "build_preset" DROP COLUMN IF EXISTS "peakLongRunMiles";
ALTER TABLE "build_preset" DROP COLUMN IF EXISTS "peakWeeklyMiles";

DROP TABLE IF EXISTS "build_preset_workout";

-- Taper preset rotation parity
ALTER TABLE "taper_preset" ADD COLUMN IF NOT EXISTS "taperLongRunPoolMiles" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "taper_preset" ADD COLUMN IF NOT EXISTS "tempoIdealDow" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "taper_preset" ADD COLUMN IF NOT EXISTS "intervalIdealDow" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "taper_preset" ADD COLUMN IF NOT EXISTS "longRunDefaultDow" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "taper_preset" ADD COLUMN IF NOT EXISTS "longRunConfigId" TEXT;
ALTER TABLE "taper_preset" ADD COLUMN IF NOT EXISTS "intervalsConfigId" TEXT;
ALTER TABLE "taper_preset" ADD COLUMN IF NOT EXISTS "tempoConfigId" TEXT;
ALTER TABLE "taper_preset" ADD COLUMN IF NOT EXISTS "easyConfigId" TEXT;
ALTER TABLE "taper_preset" ADD COLUMN IF NOT EXISTS "easyRunConfig" JSONB;

UPDATE "taper_preset" t
SET
  "taperLongRunPoolMiles" = p."taperLongRunPoolMiles",
  "tempoIdealDow" = p."tempoIdealDow",
  "intervalIdealDow" = p."intervalIdealDow",
  "longRunDefaultDow" = p."longRunDefaultDow",
  "longRunConfigId" = p."longRunConfigId",
  "intervalsConfigId" = p."intervalsConfigId",
  "tempoConfigId" = p."tempoConfigId",
  "easyConfigId" = p."easyConfigId",
  "easyRunConfig" = p."easyRunConfig"
FROM "training_plan_preset" p
WHERE p."taperPresetId" = t.id;

DROP TABLE IF EXISTS "taper_preset_workout";

-- FKs
ALTER TABLE "build_preset" ADD CONSTRAINT "build_preset_longRunConfigId_fkey"
  FOREIGN KEY ("longRunConfigId") REFERENCES "long_run_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "build_preset" ADD CONSTRAINT "build_preset_intervalsConfigId_fkey"
  FOREIGN KEY ("intervalsConfigId") REFERENCES "intervals_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "build_preset" ADD CONSTRAINT "build_preset_tempoConfigId_fkey"
  FOREIGN KEY ("tempoConfigId") REFERENCES "tempo_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "build_preset" ADD CONSTRAINT "build_preset_easyConfigId_fkey"
  FOREIGN KEY ("easyConfigId") REFERENCES "easy_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "taper_preset" ADD CONSTRAINT "taper_preset_longRunConfigId_fkey"
  FOREIGN KEY ("longRunConfigId") REFERENCES "long_run_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "taper_preset" ADD CONSTRAINT "taper_preset_intervalsConfigId_fkey"
  FOREIGN KEY ("intervalsConfigId") REFERENCES "intervals_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "taper_preset" ADD CONSTRAINT "taper_preset_tempoConfigId_fkey"
  FOREIGN KEY ("tempoConfigId") REFERENCES "tempo_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "taper_preset" ADD CONSTRAINT "taper_preset_easyConfigId_fkey"
  FOREIGN KEY ("easyConfigId") REFERENCES "easy_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "build_preset_longRunConfigId_idx" ON "build_preset"("longRunConfigId");
CREATE INDEX IF NOT EXISTS "build_preset_intervalsConfigId_idx" ON "build_preset"("intervalsConfigId");
CREATE INDEX IF NOT EXISTS "build_preset_tempoConfigId_idx" ON "build_preset"("tempoConfigId");
CREATE INDEX IF NOT EXISTS "build_preset_easyConfigId_idx" ON "build_preset"("easyConfigId");
CREATE INDEX IF NOT EXISTS "taper_preset_longRunConfigId_idx" ON "taper_preset"("longRunConfigId");
CREATE INDEX IF NOT EXISTS "taper_preset_intervalsConfigId_idx" ON "taper_preset"("intervalsConfigId");
CREATE INDEX IF NOT EXISTS "taper_preset_tempoConfigId_idx" ON "taper_preset"("tempoConfigId");
CREATE INDEX IF NOT EXISTS "taper_preset_easyConfigId_idx" ON "taper_preset"("easyConfigId");

-- Refresh plan snaps from build/taper phase rows
UPDATE "training_plan_preset" p
SET
  "snapPeakLongRunMiles" = b."peakLongRunPoolMiles",
  "snapPeakWeeklyMiles" = b."maxWeeklyMiles"
FROM "build_preset" b
WHERE p."buildPresetId" = b.id;

UPDATE "training_plan_preset" p
SET
  "snapTaperWeek1TotalMiles" = t."week1TotalMiles",
  "snapTaperWeek1LongRunMiles" = t."week1LongRunMiles",
  "snapTaperWeek2TotalMiles" = t."week2TotalMiles",
  "snapTaperWeek2LongRunMiles" = t."week2LongRunMiles"
FROM "taper_preset" t
WHERE p."taperPresetId" = t.id;
