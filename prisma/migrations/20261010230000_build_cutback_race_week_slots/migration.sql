-- Build long-run cutback percent (week 4, 8, 12…)
ALTER TABLE "build_preset" ADD COLUMN "longRunCutback" DOUBLE PRECISION;

-- Race week: week lives in slots JSON only
ALTER TABLE "race_week_preset" DROP COLUMN IF EXISTS "shakeoutRunConfigId";
ALTER TABLE "race_week_preset" DROP COLUMN IF EXISTS "shakeoutDaysPriorToRace";
ALTER TABLE "race_week_preset" DROP COLUMN IF EXISTS "weekPins";
