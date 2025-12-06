-- Create go_fast_companies table if it doesn't exist
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

-- Create unique constraint on slug
CREATE UNIQUE INDEX IF NOT EXISTS "go_fast_companies_slug_key" ON "go_fast_companies"("slug");

