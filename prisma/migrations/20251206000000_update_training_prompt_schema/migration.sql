-- Update training prompt models to match new schema requirements

-- Update ai_roles: rename title -> name, rename systemRole -> content
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_roles' AND column_name = 'title') THEN
    ALTER TABLE "ai_roles" RENAME COLUMN "title" TO "name";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_roles' AND column_name = 'systemRole') THEN
    ALTER TABLE "ai_roles" RENAME COLUMN "systemRole" TO "content";
  END IF;
END $$;

-- Update rule_sets: remove description column if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rule_sets' AND column_name = 'description') THEN
    ALTER TABLE "rule_sets" DROP COLUMN "description";
  END IF;
END $$;

-- Update must_haves: add name column, rename requiredPaths -> fields
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'must_haves' AND column_name = 'name') THEN
    ALTER TABLE "must_haves" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'must_haves' AND column_name = 'requiredPaths') THEN
    ALTER TABLE "must_haves" RENAME COLUMN "requiredPaths" TO "fields";
  END IF;
  
  -- Remove default after adding column
  ALTER TABLE "must_haves" ALTER COLUMN "name" DROP DEFAULT;
END $$;

-- Update return_json_formats: add name column
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_json_formats' AND column_name = 'name') THEN
    ALTER TABLE "return_json_formats" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
    -- Remove default after adding column
    ALTER TABLE "return_json_formats" ALTER COLUMN "name" DROP DEFAULT;
  END IF;
END $$;

-- Update training_gen_prompts: remove description, make foreign keys NOT NULL, update constraints
DO $$ 
BEGIN
  -- Remove description column if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'training_gen_prompts' AND column_name = 'description') THEN
    ALTER TABLE "training_gen_prompts" DROP COLUMN "description";
  END IF;
  
  -- Drop existing foreign key constraints
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'training_gen_prompts_aiRoleId_fkey') THEN
    ALTER TABLE "training_gen_prompts" DROP CONSTRAINT "training_gen_prompts_aiRoleId_fkey";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'training_gen_prompts_ruleSetId_fkey') THEN
    ALTER TABLE "training_gen_prompts" DROP CONSTRAINT "training_gen_prompts_ruleSetId_fkey";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'training_gen_prompts_mustHavesId_fkey') THEN
    ALTER TABLE "training_gen_prompts" DROP CONSTRAINT "training_gen_prompts_mustHavesId_fkey";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'training_gen_prompts_returnFormatId_fkey') THEN
    ALTER TABLE "training_gen_prompts" DROP CONSTRAINT "training_gen_prompts_returnFormatId_fkey";
  END IF;
  
  -- Make foreign key columns NOT NULL (first need to ensure no NULL values exist)
  -- Delete any rows with NULL foreign keys (they're invalid anyway)
  DELETE FROM "training_gen_prompts" WHERE "aiRoleId" IS NULL OR "ruleSetId" IS NULL OR "mustHavesId" IS NULL OR "returnFormatId" IS NULL;
  
  -- Now make columns NOT NULL
  ALTER TABLE "training_gen_prompts" ALTER COLUMN "aiRoleId" SET NOT NULL;
  ALTER TABLE "training_gen_prompts" ALTER COLUMN "ruleSetId" SET NOT NULL;
  ALTER TABLE "training_gen_prompts" ALTER COLUMN "mustHavesId" SET NOT NULL;
  ALTER TABLE "training_gen_prompts" ALTER COLUMN "returnFormatId" SET NOT NULL;
  
  -- Recreate foreign key constraints with CASCADE (no SET NULL)
  ALTER TABLE "training_gen_prompts" ADD CONSTRAINT "training_gen_prompts_aiRoleId_fkey" FOREIGN KEY ("aiRoleId") REFERENCES "ai_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "training_gen_prompts" ADD CONSTRAINT "training_gen_prompts_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "rule_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "training_gen_prompts" ADD CONSTRAINT "training_gen_prompts_mustHavesId_fkey" FOREIGN KEY ("mustHavesId") REFERENCES "must_haves"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "training_gen_prompts" ADD CONSTRAINT "training_gen_prompts_returnFormatId_fkey" FOREIGN KEY ("returnFormatId") REFERENCES "return_json_formats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END $$;

