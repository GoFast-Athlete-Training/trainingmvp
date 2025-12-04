-- Migration: Add goalRacePace and predictedRacePace to TrainingPlan
-- These fields store pace in seconds per mile (Int) instead of mm:ss strings

-- Add goalRacePace column (nullable, stores seconds per mile)
ALTER TABLE "TrainingPlan" ADD COLUMN IF NOT EXISTS "goalRacePace" INTEGER;

-- Add predictedRacePace column (nullable, stores seconds per mile)
ALTER TABLE "TrainingPlan" ADD COLUMN IF NOT EXISTS "predictedRacePace" INTEGER;

-- Note: goalPace5K is kept for backward compatibility but is deprecated

