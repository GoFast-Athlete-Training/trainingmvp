-- Migration: Remove RaceTrainingPlan junction table, add direct raceId FK to TrainingPlan
-- This simplifies the architecture: Race 1 -> N TrainingPlan (direct FK, no junction table)

-- Step 1: Add raceId column to TrainingPlan (nullable initially)
ALTER TABLE "TrainingPlan" ADD COLUMN IF NOT EXISTS "raceId" TEXT;

-- Step 2: Migrate existing data from RaceTrainingPlan junction table to raceId
-- Copy raceRegistryId from junction table to TrainingPlan.raceId
UPDATE "TrainingPlan" tp
SET "raceId" = rtp."raceRegistryId"
FROM "race_training_plans" rtp
WHERE tp.id = rtp."trainingPlanId"
AND tp."raceId" IS NULL;

-- Step 3: Add foreign key constraint
-- First, ensure all raceIds reference valid races
DELETE FROM "TrainingPlan" WHERE "raceId" IS NOT NULL AND "raceId" NOT IN (SELECT id FROM "race_registry");

-- Add foreign key constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'TrainingPlan_raceId_fkey'
  ) THEN
    ALTER TABLE "TrainingPlan" 
    ADD CONSTRAINT "TrainingPlan_raceId_fkey" 
    FOREIGN KEY ("raceId") 
    REFERENCES "race_registry"(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Step 4: Create index on raceId for fast lookups
CREATE INDEX IF NOT EXISTS "TrainingPlan_raceId_idx" ON "TrainingPlan"("raceId");

-- Step 5: Drop the RaceTrainingPlan junction table
-- First drop foreign key constraints
ALTER TABLE "race_training_plans" DROP CONSTRAINT IF EXISTS "race_training_plans_raceRegistryId_fkey";
ALTER TABLE "race_training_plans" DROP CONSTRAINT IF EXISTS "race_training_plans_trainingPlanId_fkey";

-- Drop the table
DROP TABLE IF EXISTS "race_training_plans";

