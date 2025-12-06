-- Ensure go_fast_companies table exists
-- This migration ensures the table is created if it doesn't exist

CREATE TABLE IF NOT EXISTS "go_fast_companies" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "address" TEXT,
  "city" TEXT,
  "state" TEXT,
  "zip" TEXT,
  "domain" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "go_fast_companies_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on slug if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'go_fast_companies_slug_key'
  ) THEN
    CREATE UNIQUE INDEX "go_fast_companies_slug_key" ON "go_fast_companies"("slug");
  END IF;
END $$;

