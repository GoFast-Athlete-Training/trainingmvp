-- CreateTable
CREATE TABLE "athlete_training_plans" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "trainingPlanId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_training_plans_athleteId_trainingPlanId_key" ON "athlete_training_plans"("athleteId", "trainingPlanId");

-- CreateIndex
CREATE INDEX "athlete_training_plans_athleteId_isPrimary_isActive_idx" ON "athlete_training_plans"("athleteId", "isPrimary", "isActive");

-- CreateIndex
CREATE INDEX "athlete_training_plans_athleteId_isActive_idx" ON "athlete_training_plans"("athleteId", "isActive");

-- AddForeignKey
ALTER TABLE "athlete_training_plans" ADD CONSTRAINT "athlete_training_plans_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_training_plans" ADD CONSTRAINT "athlete_training_plans_trainingPlanId_fkey" FOREIGN KEY ("trainingPlanId") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

