-- Add fiveKPace column to Athlete table (PascalCase)
-- This column stores the athlete's 5K pace in mm:ss format

ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "fiveKPace" TEXT;

COMMENT ON COLUMN "Athlete"."fiveKPace" IS '5K pace in mm:ss format - THE SOURCE OF TRUTH for CURRENT 5K pace (TrainingMVP specific)';

