-- Fix Athlete_companyId_fkey to point to go_fast_companies (not GoFastCompany)
-- The constraint was incorrectly created pointing to "GoFastCompany" table which doesn't exist

-- Drop the incorrect constraint
ALTER TABLE "Athlete" DROP CONSTRAINT IF EXISTS "Athlete_companyId_fkey";

-- Recreate pointing to the correct table: go_fast_companies
ALTER TABLE "Athlete" 
ADD CONSTRAINT "Athlete_companyId_fkey" 
FOREIGN KEY ("companyId") 
REFERENCES "go_fast_companies"("id") 
ON DELETE RESTRICT 
ON UPDATE CASCADE;

