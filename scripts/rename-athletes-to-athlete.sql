-- Rename athletes table to Athlete (PascalCase) to match Prisma default
-- This preserves all data - just renames the table

-- Check if both tables exist
DO $$
BEGIN
  -- If athletes exists and Athlete doesn't, rename it
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'athletes')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Athlete') THEN
    ALTER TABLE "athletes" RENAME TO "Athlete";
    RAISE NOTICE 'Table renamed from "athletes" to "Athlete"';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Athlete') THEN
    RAISE NOTICE 'Table "Athlete" already exists';
  ELSE
    RAISE NOTICE 'Table "athletes" does not exist';
  END IF;
END $$;

-- Rename indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'Athlete' AND indexname = 'athletes_firebaseId_key') THEN
    ALTER INDEX "athletes_firebaseId_key" RENAME TO "Athlete_firebaseId_key";
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'Athlete' AND indexname = 'athletes_gofastHandle_key') THEN
    ALTER INDEX "athletes_gofastHandle_key" RENAME TO "Athlete_gofastHandle_key";
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'Athlete' AND indexname = 'athletes_garmin_user_id_key') THEN
    ALTER INDEX "athletes_garmin_user_id_key" RENAME TO "Athlete_garmin_user_id_key";
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'Athlete' AND indexname = 'athletes_strava_id_key') THEN
    ALTER INDEX "athletes_strava_id_key" RENAME TO "Athlete_strava_id_key";
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'Athlete' AND indexname = 'athletes_companyId_idx') THEN
    ALTER INDEX "athletes_companyId_idx" RENAME TO "Athlete_companyId_idx";
  END IF;
END $$;

-- Rename constraints
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'athletes_pkey') THEN
    ALTER TABLE "Athlete" RENAME CONSTRAINT "athletes_pkey" TO "Athlete_pkey";
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'athletes_companyId_fkey') THEN
    ALTER TABLE "Athlete" RENAME CONSTRAINT "athletes_companyId_fkey" TO "Athlete_companyId_fkey";
  END IF;
END $$;

