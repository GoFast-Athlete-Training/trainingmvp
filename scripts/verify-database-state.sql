-- Database State Verification Script
-- Run this to check the current state of user data

-- 1. Check which athlete table exists and row count
SELECT 
  'Table Existence Check' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'athletes') THEN 'athletes (lowercase) EXISTS'
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Athlete') THEN 'Athlete (PascalCase) EXISTS'
    ELSE 'NO ATHLETE TABLE FOUND'
  END as table_status;

-- 2. Count rows in each possible table
DO $$
DECLARE
  athletes_count INTEGER := 0;
  Athlete_count INTEGER := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'athletes') THEN
    EXECUTE 'SELECT COUNT(*) FROM "athletes"' INTO athletes_count;
    RAISE NOTICE 'athletes table: % rows', athletes_count;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Athlete') THEN
    EXECUTE 'SELECT COUNT(*) FROM "Athlete"' INTO Athlete_count;
    RAISE NOTICE 'Athlete table: % rows', Athlete_count;
  END IF;
  
  IF athletes_count = 0 AND Athlete_count = 0 THEN
    RAISE WARNING '⚠️  NO ATHLETE DATA FOUND IN EITHER TABLE!';
  END IF;
END $$;

-- 3. Check for backup tables
SELECT 
  'Backup Tables' as check_type,
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND (table_name LIKE '%backup%' OR table_name LIKE '%_backup_%')
ORDER BY table_name;

-- 4. Check recent athlete creation dates (if data exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'athletes') THEN
    RAISE NOTICE 'Recent athletes in "athletes" table:';
    FOR r IN EXECUTE 'SELECT id, "firebaseId", email, "createdAt" FROM "athletes" ORDER BY "createdAt" DESC LIMIT 10'
    LOOP
      RAISE NOTICE '  ID: %, Firebase: %, Email: %, Created: %', r.id, r."firebaseId", r.email, r."createdAt";
    END LOOP;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Athlete') THEN
    RAISE NOTICE 'Recent athletes in "Athlete" table:';
    FOR r IN EXECUTE 'SELECT id, "firebaseId", email, "createdAt" FROM "Athlete" ORDER BY "createdAt" DESC LIMIT 10'
    LOOP
      RAISE NOTICE '  ID: %, Firebase: %, Email: %, Created: %', r.id, r."firebaseId", r.email, r."createdAt";
    END LOOP;
  END IF;
END $$;

-- 5. Check for training plans (should exist if athletes exist)
SELECT 
  'Training Plans' as check_type,
  COUNT(*) as total_plans,
  COUNT(DISTINCT "athleteId") as unique_athletes_with_plans
FROM "TrainingPlan";

-- 6. Check for orphaned data (plans without athletes)
SELECT 
  'Orphaned Data Check' as check_type,
  COUNT(*) as orphaned_plans
FROM "TrainingPlan" tp
WHERE NOT EXISTS (
  SELECT 1 FROM "athletes" a WHERE a.id = tp."athleteId"
)
AND NOT EXISTS (
  SELECT 1 FROM "Athlete" a WHERE a.id = tp."athleteId"
);

-- 7. Check migration history
SELECT 
  'Migration History' as check_type,
  name,
  applied_at
FROM _prisma_migrations
ORDER BY applied_at DESC
LIMIT 10;

