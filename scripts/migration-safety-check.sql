-- Migration Safety Check Script
-- Run this BEFORE any migration to check for data that could be affected

-- 1. Check athlete count
SELECT 'athletes' as table_name, COUNT(*) as row_count FROM "athletes";
SELECT 'Athlete' as table_name, COUNT(*) as row_count FROM "Athlete";

-- 2. Check if both tables exist (one should be empty/non-existent)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('athletes', 'Athlete');

-- 3. Check for athletes with missing companyId (would fail if companyId is required)
SELECT COUNT(*) as athletes_without_company 
FROM "athletes" 
WHERE "companyId" IS NULL;

-- 4. Check for orphaned training plans (plans without athletes)
SELECT COUNT(*) as orphaned_plans
FROM "TrainingPlan" tp
WHERE NOT EXISTS (
  SELECT 1 FROM "athletes" a WHERE a.id = tp."athleteId"
);

-- 5. Check for cascade delete risks
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'athletes'
  AND rc.delete_rule = 'CASCADE';

