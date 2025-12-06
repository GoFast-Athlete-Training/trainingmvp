-- Create training prompt configuration models
CREATE TABLE IF NOT EXISTS "ai_roles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "systemRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "rule_sets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rule_sets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "must_haves" (
    "id" TEXT NOT NULL,
    "requiredPaths" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "must_haves_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "return_json_formats" (
    "id" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "return_json_formats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "training_gen_prompts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "aiRoleId" TEXT,
    "ruleSetId" TEXT,
    "mustHavesId" TEXT,
    "returnFormatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_gen_prompts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "training_gen_prompts" ADD CONSTRAINT "training_gen_prompts_aiRoleId_fkey" FOREIGN KEY ("aiRoleId") REFERENCES "ai_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_gen_prompts" ADD CONSTRAINT "training_gen_prompts_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_gen_prompts" ADD CONSTRAINT "training_gen_prompts_mustHavesId_fkey" FOREIGN KEY ("mustHavesId") REFERENCES "must_haves"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_gen_prompts" ADD CONSTRAINT "training_gen_prompts_returnFormatId_fkey" FOREIGN KEY ("returnFormatId") REFERENCES "return_json_formats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
