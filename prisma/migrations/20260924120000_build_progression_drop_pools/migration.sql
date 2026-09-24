-- Plan preset: length on rollup; drop legacy long-run pool cup columns
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "planDurationWeeks" INTEGER;

ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "baseLongRunPoolMiles";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "peakLongRunPoolMiles";
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "taperLongRunPoolMiles";

-- Build: progression miles + rotations only
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "startLongRunMiles" DOUBLE PRECISION;
ALTER TABLE "build_preset" ADD COLUMN IF NOT EXISTS "peakLongRunMiles" DOUBLE PRECISION;

UPDATE "build_preset"
SET "peakLongRunMiles" = "peakLongRunPoolMiles"
WHERE "peakLongRunPoolMiles" IS NOT NULL
  AND "peakLongRunPoolMiles" > 0
  AND "peakLongRunPoolMiles" <= 35
  AND ("peakLongRunMiles" IS NULL OR "peakLongRunMiles" = 0);

UPDATE "build_preset"
SET "startLongRunMiles" = "baseLongRunPoolMiles"
WHERE "baseLongRunPoolMiles" IS NOT NULL
  AND "baseLongRunPoolMiles" > 0
  AND "baseLongRunPoolMiles" <= 35
  AND ("startLongRunMiles" IS NULL OR "startLongRunMiles" = 0);

ALTER TABLE "build_preset" DROP COLUMN IF EXISTS "longRunCycleWeeks";
ALTER TABLE "build_preset" DROP COLUMN IF EXISTS "minWeeklyMiles";
ALTER TABLE "build_preset" DROP COLUMN IF EXISTS "baseLongRunPoolMiles";
ALTER TABLE "build_preset" DROP COLUMN IF EXISTS "peakLongRunPoolMiles";
ALTER TABLE "build_preset" DROP COLUMN IF EXISTS "taperLongRunPoolMiles";
ALTER TABLE "build_preset" DROP COLUMN IF EXISTS "tempoIdealDow";
ALTER TABLE "build_preset" DROP COLUMN IF EXISTS "intervalIdealDow";
ALTER TABLE "build_preset" DROP COLUMN IF EXISTS "longRunDefaultDow";
ALTER TABLE "build_preset" DROP COLUMN IF EXISTS "easyRunConfig";
ALTER TABLE "build_preset" DROP COLUMN IF EXISTS "coachPlanOverview";
ALTER TABLE "build_preset" DROP COLUMN IF EXISTS "workoutStructure";

-- Taper: drop pool + DOW legacy
ALTER TABLE "taper_preset" DROP COLUMN IF EXISTS "taperLongRunPoolMiles";
ALTER TABLE "taper_preset" DROP COLUMN IF EXISTS "tempoIdealDow";
ALTER TABLE "taper_preset" DROP COLUMN IF EXISTS "intervalIdealDow";
ALTER TABLE "taper_preset" DROP COLUMN IF EXISTS "longRunDefaultDow";
ALTER TABLE "taper_preset" DROP COLUMN IF EXISTS "easyRunConfig";

UPDATE "training_plan_preset" p
SET "snapPeakLongRunMiles" = b."peakLongRunMiles"
FROM "build_preset" b
WHERE p."buildPresetId" = b.id;
