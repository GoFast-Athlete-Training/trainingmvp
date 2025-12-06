-- Recreate Athlete table from trainingmvp schema
-- This restores the table structure (data will be empty, users need to re-signup)

-- Drop existing table if it exists (CAREFUL - this deletes data!)
-- Only run this if you're sure you want to recreate the structure
-- DROP TABLE IF EXISTS "Athlete" CASCADE;

-- Create Athlete table with full schema from trainingmvp (PascalCase - Prisma default)
CREATE TABLE IF NOT EXISTS "Athlete" (
  "id" TEXT NOT NULL,
  "firebaseId" TEXT NOT NULL,
  "email" TEXT,
  "companyId" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "gofastHandle" TEXT,
  "photoURL" TEXT,
  "phoneNumber" TEXT,
  "birthday" TIMESTAMP(3),
  "gender" TEXT,
  "city" TEXT,
  "state" TEXT,
  "primarySport" TEXT,
  "bio" TEXT,
  "instagram" TEXT,
  "fiveKPace" TEXT,
  "myCurrentPace" TEXT,
  "myWeeklyMileage" INTEGER,
  "myTrainingGoal" TEXT,
  "myTrainingStartDate" TIMESTAMP(3),
  "myTargetRace" TEXT,
  "preferredDistance" TEXT,
  "myPaceRange" TEXT,
  "timePreference" TEXT,
  "myRunningGoals" TEXT,
  "garmin_user_id" TEXT,
  "garmin_access_token" TEXT,
  "garmin_refresh_token" TEXT,
  "garmin_expires_in" INTEGER,
  "garmin_scope" TEXT,
  "garmin_connected_at" TIMESTAMP(3),
  "garmin_last_sync_at" TIMESTAMP(3),
  "garmin_is_connected" BOOLEAN NOT NULL DEFAULT false,
  "garmin_disconnected_at" TIMESTAMP(3),
  "garmin_permissions" JSONB,
  "garmin_user_profile" JSONB,
  "garmin_user_sleep" JSONB,
  "garmin_user_preferences" JSONB,
  "strava_id" INTEGER,
  "strava_access_token" TEXT,
  "strava_refresh_token" TEXT,
  "strava_expires_at" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Athlete_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "Athlete_firebaseId_key" ON "Athlete"("firebaseId");
CREATE UNIQUE INDEX IF NOT EXISTS "Athlete_gofastHandle_key" ON "Athlete"("gofastHandle");
CREATE UNIQUE INDEX IF NOT EXISTS "Athlete_garmin_user_id_key" ON "Athlete"("garmin_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "Athlete_strava_id_key" ON "Athlete"("strava_id");

-- Create indexes
CREATE INDEX IF NOT EXISTS "Athlete_companyId_idx" ON "Athlete"("companyId");

-- Add foreign key constraint to GoFastCompany
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Athlete_companyId_fkey'
  ) THEN
    ALTER TABLE "Athlete" 
    ADD CONSTRAINT "Athlete_companyId_fkey" 
    FOREIGN KEY ("companyId") 
    REFERENCES "go_fast_companies"("id") 
    ON DELETE RESTRICT 
    ON UPDATE CASCADE;
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE "Athlete" IS 'Athlete/user table - SHARED across all GoFast projects';
COMMENT ON COLUMN "Athlete"."fiveKPace" IS '5K pace in mm:ss format - THE SOURCE OF TRUTH for CURRENT 5K pace (TrainingMVP specific)';

