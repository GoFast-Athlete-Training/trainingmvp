-- Athlete sets plan length at enrollment; preset does not store weeks.
ALTER TABLE "training_plan_preset" DROP COLUMN IF EXISTS "planDurationWeeks";

-- Legacy long-run rotations used pool percentages / cutback slots.
UPDATE "training_plan_preset" SET "longRunConfigId" = NULL WHERE "longRunConfigId" IS NOT NULL;
UPDATE "build_preset" SET "longRunConfigId" = NULL WHERE "longRunConfigId" IS NOT NULL;
UPDATE "taper_preset" SET "longRunConfigId" = NULL WHERE "longRunConfigId" IS NOT NULL;
