-- Pre-Migration Backup Script
-- Run this BEFORE any migration that could affect user data

-- Create backup tables with timestamp
DO $$
DECLARE
  backup_suffix TEXT := TO_CHAR(NOW(), 'YYYYMMDD_HH24MISS');
BEGIN
  -- Backup athletes table
  EXECUTE format('CREATE TABLE IF NOT EXISTS athletes_backup_%s AS SELECT * FROM "athletes"', backup_suffix);
  EXECUTE format('CREATE TABLE IF NOT EXISTS Athlete_backup_%s AS SELECT * FROM "Athlete"', backup_suffix);
  
  -- Backup training plans
  EXECUTE format('CREATE TABLE IF NOT EXISTS TrainingPlan_backup_%s AS SELECT * FROM "TrainingPlan"', backup_suffix);
  
  RAISE NOTICE 'Backup created with suffix: %', backup_suffix;
END $$;

-- Verify backup
SELECT 
  'athletes_backup' as backup_type,
  COUNT(*) as row_count 
FROM information_schema.tables 
WHERE table_name LIKE 'athletes_backup_%'
ORDER BY table_name DESC 
LIMIT 1;

