-- This migration fixes the schema to match the actual database table name
-- The database already has the table "Athlete" (PascalCase, Prisma default)
-- TrainingMVP was incorrectly using @@map("athletes") which caused queries to fail
-- No database changes needed - only schema alignment

-- Note: This is a schema-only fix. The actual database table "Athlete" already exists
-- and matches GoFast MVP's schema (no @@map directive).

