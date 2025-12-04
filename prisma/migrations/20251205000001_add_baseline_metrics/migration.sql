-- Migration: Add baseline metrics to TrainingPlan
-- These fields collect current fitness level before plan generation

-- Add current5KPace column (nullable, stores mm:ss format)
ALTER TABLE "TrainingPlan" ADD COLUMN IF NOT EXISTS "current5KPace" TEXT;

-- Add currentWeeklyMileage column (nullable, stores miles per week)
ALTER TABLE "TrainingPlan" ADD COLUMN IF NOT EXISTS "currentWeeklyMileage" INTEGER;

-- Note: These are collected during setup flow, before plan generation
-- They help the AI build up gradually from the athlete's current fitness level

