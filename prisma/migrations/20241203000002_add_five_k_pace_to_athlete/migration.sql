-- Add fiveKPace column to Athlete table
-- This field is required by TrainingMVP but not present in GoFast MVP's schema
-- It stores the athlete's 5K pace in mm:ss format (e.g., "8:30")

ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "fiveKPace" TEXT;

-- Add comment to document the field
COMMENT ON COLUMN "Athlete"."fiveKPace" IS '5K pace in mm:ss format - THE SOURCE OF TRUTH for 5K pace (TrainingMVP specific)';

