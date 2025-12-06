-- Fix Athlete_companyId_fkey foreign key constraint
-- Ensure it points to go_fast_companies table

-- Drop existing constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Athlete_companyId_fkey'
  ) THEN
    ALTER TABLE "Athlete" DROP CONSTRAINT "Athlete_companyId_fkey";
    RAISE NOTICE 'Dropped existing Athlete_companyId_fkey constraint';
  END IF;
END $$;

-- Recreate the constraint pointing to go_fast_companies
ALTER TABLE "Athlete" 
ADD CONSTRAINT "Athlete_companyId_fkey" 
FOREIGN KEY ("companyId") 
REFERENCES "go_fast_companies"("id") 
ON DELETE RESTRICT 
ON UPDATE CASCADE;

