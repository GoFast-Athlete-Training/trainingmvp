-- Add description field to training_gen_prompts table
ALTER TABLE "training_gen_prompts" ADD COLUMN IF NOT EXISTS "description" TEXT;

