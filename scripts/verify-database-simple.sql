-- Simple Database State Verification
-- Check which athlete table exists

-- 1. Check table existence
SELECT 
  'athletes' as table_name,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'athletes') as exists,
  (SELECT COUNT(*) FROM "athletes" WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'athletes')) as row_count;

SELECT 
  'Athlete' as table_name,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Athlete') as exists,
  (SELECT COUNT(*) FROM "Athlete" WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Athlete')) as row_count;

-- 2. Check backup tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND (table_name LIKE '%backup%' OR table_name LIKE '%_backup_%')
ORDER BY table_name;

-- 3. Check training plans count
SELECT COUNT(*) as total_training_plans FROM "TrainingPlan";

-- 4. Recent migrations
SELECT name, applied_at
FROM _prisma_migrations
ORDER BY applied_at DESC
LIMIT 5;

