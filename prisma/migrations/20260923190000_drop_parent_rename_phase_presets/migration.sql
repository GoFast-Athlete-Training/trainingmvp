-- Drop mistaken parent rollup
DROP TABLE IF EXISTS "training_plan_preset_parent";

-- Phase preset naming (same shape as race_week_preset)
ALTER TABLE "build_config" RENAME TO "build_preset";
ALTER TABLE "build_config_workout" RENAME TO "build_preset_workout";
ALTER TABLE "build_preset_workout" RENAME COLUMN "buildConfigId" TO "buildPresetId";

ALTER TABLE "taper_config" RENAME TO "taper_preset";
ALTER TABLE "taper_config_workout" RENAME TO "taper_preset_workout";
ALTER TABLE "taper_preset_workout" RENAME COLUMN "taperConfigId" TO "taperPresetId";

ALTER TABLE "training_plan_preset" RENAME COLUMN "buildConfigId" TO "buildPresetId";
ALTER TABLE "training_plan_preset" RENAME COLUMN "taperConfigId" TO "taperPresetId";

ALTER INDEX IF EXISTS "training_plan_preset_buildConfigId_idx" RENAME TO "training_plan_preset_buildPresetId_idx";
ALTER INDEX IF EXISTS "training_plan_preset_taperConfigId_idx" RENAME TO "training_plan_preset_taperPresetId_idx";
ALTER INDEX IF EXISTS "build_config_workout_catalogueWorkoutId_idx" RENAME TO "build_preset_workout_catalogueWorkoutId_idx";
ALTER INDEX IF EXISTS "taper_config_workout_catalogueWorkoutId_idx" RENAME TO "taper_preset_workout_catalogueWorkoutId_idx";
