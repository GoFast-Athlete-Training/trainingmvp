-- Add raceType and miles columns to race_registry table
-- Migration: Add raceType and miles fields

-- Step 1: Add new columns (nullable initially)
ALTER TABLE "race_registry" 
ADD COLUMN IF NOT EXISTS "raceType" TEXT,
ADD COLUMN IF NOT EXISTS "miles" DOUBLE PRECISION;

-- Step 2: Migrate existing data from distance to raceType and calculate miles
-- Map distance values to raceType and miles
UPDATE "race_registry"
SET 
  "raceType" = CASE 
    WHEN LOWER("distance") = 'marathon' THEN 'marathon'
    WHEN LOWER("distance") = 'half' OR LOWER("distance") = 'half marathon' THEN 'half'
    WHEN LOWER("distance") = '10k' OR "distance" = '10' THEN '10k'
    WHEN LOWER("distance") = '5k' OR "distance" = '5' THEN '5k'
    WHEN LOWER("distance") = '10m' OR LOWER("distance") = '10 mile' OR LOWER("distance") = '10 miles' THEN '10m'
    ELSE LOWER("distance")
  END,
  "miles" = CASE 
    WHEN LOWER("distance") = 'marathon' THEN 26.2
    WHEN LOWER("distance") = 'half' OR LOWER("distance") = 'half marathon' THEN 13.1
    WHEN LOWER("distance") = '10k' OR "distance" = '10' THEN 6.2
    WHEN LOWER("distance") = '5k' OR "distance" = '5' THEN 3.1
    WHEN LOWER("distance") = '10m' OR LOWER("distance") = '10 mile' OR LOWER("distance") = '10 miles' THEN 10.0
    ELSE 3.1 -- Default to 5k if unknown
  END
WHERE "raceType" IS NULL OR "miles" IS NULL;

-- Step 3: Make raceType NOT NULL (after data migration)
ALTER TABLE "race_registry"
ALTER COLUMN "raceType" SET NOT NULL,
ALTER COLUMN "miles" SET NOT NULL;
