-- Check which athlete table actually exists in the database
-- This helps diagnose table name mapping issues

SELECT 
  'Table Name Check' as check_type,
  table_name,
  table_type,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND (table_name = 'athletes' OR table_name = 'Athlete')
ORDER BY table_name;

-- Check row counts (if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'athletes') THEN
    RAISE NOTICE 'athletes table exists with % rows', (SELECT COUNT(*) FROM "athletes");
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Athlete') THEN
    RAISE NOTICE 'Athlete table exists with % rows', (SELECT COUNT(*) FROM "Athlete");
  END IF;
END $$;

