-- CreateTable: TrainingPlanPhase
CREATE TABLE IF NOT EXISTS "training_plan_phases" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekCount" INTEGER NOT NULL,
    "totalMiles" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_plan_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TrainingPlanWeek
CREATE TABLE IF NOT EXISTS "training_plan_weeks" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "miles" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_plan_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TrainingPlanDay (NEW DATE-DRIVEN MODEL)
CREATE TABLE IF NOT EXISTS "training_plan_days" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "warmup" JSONB NOT NULL,
    "workout" JSONB NOT NULL,
    "cooldown" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_plan_days_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "training_plan_phases_planId_name_key" ON "training_plan_phases"("planId", "name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "training_plan_weeks_planId_weekNumber_key" ON "training_plan_weeks"("planId", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "training_plan_days_planId_date_key" ON "training_plan_days"("planId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "training_plan_days_date_idx" ON "training_plan_days"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "training_plan_days_planId_date_idx" ON "training_plan_days"("planId", "date");

-- AddForeignKey
ALTER TABLE "training_plan_phases" ADD CONSTRAINT "training_plan_phases_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_weeks" ADD CONSTRAINT "training_plan_weeks_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_weeks" ADD CONSTRAINT "training_plan_weeks_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "training_plan_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_days" ADD CONSTRAINT "training_plan_days_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_days" ADD CONSTRAINT "training_plan_days_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "training_plan_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_days" ADD CONSTRAINT "training_plan_days_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "training_plan_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Update TrainingPlan field names
ALTER TABLE "TrainingPlan" 
    RENAME COLUMN "trainingPlanName" TO "name";
ALTER TABLE "TrainingPlan" 
    RENAME COLUMN "trainingPlanGoalTime" TO "goalTime";
ALTER TABLE "TrainingPlan" 
    RENAME COLUMN "goalFiveKPace" TO "goalPace5K";
ALTER TABLE "TrainingPlan" 
    RENAME COLUMN "trainingPlanStartDate" TO "startDate";
ALTER TABLE "TrainingPlan" 
    RENAME COLUMN "trainingPlanTotalWeeks" TO "totalWeeks";

-- Note: We are NOT dropping training_days_planned table yet
-- It will be dropped in a future migration after data migration

