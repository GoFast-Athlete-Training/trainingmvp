-- Production fix for Athlete_companyId_fkey
-- This script fixes the foreign key constraint and any invalid data

-- Step 1: Fix any athletes with invalid companyIds
-- Update them to use the first valid company
UPDATE "Athlete" 
SET "companyId" = (SELECT id FROM "go_fast_companies" LIMIT 1)
WHERE "companyId" NOT IN (SELECT id FROM "go_fast_companies");

-- Step 2: Drop the incorrect constraint (if it exists)
ALTER TABLE "Athlete" DROP CONSTRAINT IF EXISTS "Athlete_companyId_fkey";

-- Step 3: Recreate the constraint pointing to go_fast_companies
ALTER TABLE "Athlete" 
ADD CONSTRAINT "Athlete_companyId_fkey" 
FOREIGN KEY ("companyId") 
REFERENCES "go_fast_companies"("id") 
ON DELETE RESTRICT 
ON UPDATE CASCADE;

