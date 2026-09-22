-- CreateEnum
CREATE TYPE "WorkoutType" AS ENUM ('Easy', 'Tempo', 'Intervals', 'LongRun', 'Race');

-- CreateEnum
CREATE TYPE "AthletePersonaCapability" AS ENUM ('NON_RUNNER', 'BEGINNER', 'RECREATIONAL', 'COMPETITIVE', 'ELITE');

-- CreateEnum
CREATE TYPE "AthletePersonaDedication" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'ELITE');

-- CreateEnum
CREATE TYPE "FitnessDelta" AS ENUM ('SMALL', 'MODERATE', 'LARGE');

-- CreateEnum
CREATE TYPE "ProgressionAggressiveness" AS ENUM ('CONSERVATIVE', 'MODERATE', 'AMBITIOUS');

-- CreateEnum
CREATE TYPE "TrainingPlanGoalKind" AS ENUM ('RACE', 'TRAINING_BLOCK');

-- CreateEnum
CREATE TYPE "TrainingPlanGoalType" AS ENUM ('RACE', 'GENERAL_FITNESS', 'MORE_ENDURANCE');

-- CreateEnum
CREATE TYPE "RaceWeekSlotType" AS ENUM ('Easy', 'Tempo', 'Intervals', 'Rest', 'Shakeout', 'Race');

-- CreateTable
CREATE TABLE "gofast_companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "about" TEXT,
    "whatWeDo" TEXT,
    "companyUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gofast_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_managers" (
    "id" TEXT NOT NULL,
    "gofastCompanyId" TEXT,
    "firebaseUid" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plan_persona" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "capability" "AthletePersonaCapability",
    "dedication" "AthletePersonaDedication",
    "personaGoalLabel" TEXT,
    "workoutFrequencyCap" INTEGER,
    "intentSummary" TEXT,
    "runningHistory" TEXT,
    "runningHistorySummary" TEXT,
    "currentCapability" TEXT,
    "currentCapabilitySummary" TEXT,
    "injuryAssessment" TEXT,
    "injuryAssessmentSummary" TEXT,
    "dedicationText" TEXT,
    "dedicationSummary" TEXT,
    "abilityToTrain" TEXT,
    "abilityToTrainSummary" TEXT,
    "estimated5kTimeSeconds" INTEGER,
    "estimated5kPerformanceSummary" TEXT,
    "estimated5kPerformanceRationale" TEXT,
    "athletePersonaSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_plan_persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plan_goal" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "targetDistanceLabel" TEXT,
    "objectiveOfPlan" TEXT,
    "planDurationWeeks" INTEGER NOT NULL,
    "timeHorizonLabel" TEXT,
    "fitnessDelta" "FitnessDelta",
    "progressionAggressiveness" "ProgressionAggressiveness",
    "intensityReasoning" TEXT,
    "goalKind" "TrainingPlanGoalKind",
    "goalType" "TrainingPlanGoalType",
    "coachIntent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_plan_goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plan_preset" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "publicDescription" TEXT,
    "targetDistanceLabel" TEXT,
    "personaId" TEXT,
    "goalId" TEXT,
    "coachIntent" TEXT,
    "objectiveOfPlan" TEXT,
    "athletePersonaCapability" "AthletePersonaCapability",
    "athletePersonaGoal" TEXT,
    "athletePersonaDedication" "AthletePersonaDedication",
    "coachPlanOverview" JSONB,
    "workoutStructure" JSONB,
    "longRunCycleWeeks" INTEGER NOT NULL DEFAULT 4,
    "minWeeklyMiles" INTEGER NOT NULL DEFAULT 40,
    "maxWeeklyMiles" INTEGER,
    "baseLongRunPoolMiles" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "peakLongRunPoolMiles" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taperLongRunPoolMiles" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tempoIdealDow" INTEGER NOT NULL DEFAULT 2,
    "intervalIdealDow" INTEGER NOT NULL DEFAULT 4,
    "longRunDefaultDow" INTEGER NOT NULL DEFAULT 6,
    "longRunConfigId" TEXT,
    "intervalsConfigId" TEXT,
    "tempoConfigId" TEXT,
    "easyConfigId" TEXT,
    "easyRunConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_plan_preset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plan_preset_parent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "buildPresetId" TEXT NOT NULL,
    "taperPresetId" TEXT,
    "raceWeekPresetId" TEXT,
    "peakWeeklyMiles" INTEGER,
    "peakLongRunMiles" DOUBLE PRECISION,
    "buildLongRunWeekends" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_plan_preset_parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shakeout_run_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalMiles" DOUBLE PRECISION NOT NULL,
    "paceOffsetSecPerMile" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shakeout_run_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "race_week_preset" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shakeoutRunConfigId" TEXT,
    "shakeoutDaysPriorToRace" INTEGER NOT NULL DEFAULT 2,
    "slots" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_week_preset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_catalogue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "runSubType" TEXT,
    "slug" TEXT,
    "description" TEXT,
    "workoutType" "WorkoutType" NOT NULL,
    "segmentPaceDist" JSONB,
    "warmupFraction" DOUBLE PRECISION,
    "workFraction" DOUBLE PRECISION,
    "cooldownFraction" DOUBLE PRECISION,
    "workBaseReps" INTEGER,
    "workBaseRepMeters" INTEGER,
    "recoveryDistanceMeters" INTEGER,
    "recoveryDurationSeconds" INTEGER,
    "warmupMiles" DOUBLE PRECISION,
    "warmupPaceOffsetSecPerMile" INTEGER,
    "cooldownMiles" DOUBLE PRECISION,
    "cooldownPaceOffsetSecPerMile" INTEGER,
    "workBaseMiles" DOUBLE PRECISION,
    "workPaceOffsetSecPerMile" INTEGER,
    "workBasePaceOffsetSecPerMile" INTEGER,
    "recoveryPaceOffsetSecPerMile" INTEGER,
    "paceAnchor" TEXT NOT NULL DEFAULT 'currentBuildup',
    "mpFraction" DOUBLE PRECISION,
    "mpBlockPosition" TEXT,
    "mpBlockProgression" TEXT NOT NULL DEFAULT 'flat',
    "mpTotalMiles" DOUBLE PRECISION,
    "mpPaceOffsetSecPerMile" INTEGER,
    "intendedHeartRateZone" TEXT,
    "intendedHRBpmLow" INTEGER,
    "intendedHRBpmHigh" INTEGER,
    "notes" TEXT,
    "trainingIntent" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_catalogue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "long_run_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "long_run_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "long_run_config_position" (
    "id" TEXT NOT NULL,
    "longRunConfigId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "distributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "catalogueWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "long_run_config_position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intervals_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intervals_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intervals_config_position" (
    "id" TEXT NOT NULL,
    "intervalsConfigId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "distributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "catalogueWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intervals_config_position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tempo_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tempo_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tempo_config_position" (
    "id" TEXT NOT NULL,
    "tempoConfigId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "distributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "catalogueWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tempo_config_position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "easy_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "easy_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "easy_config_position" (
    "id" TEXT NOT NULL,
    "easyConfigId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "distributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "catalogueWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "easy_config_position_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gofast_companies_slug_key" ON "gofast_companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "training_managers_firebaseUid_key" ON "training_managers"("firebaseUid");

-- CreateIndex
CREATE INDEX "training_managers_email_idx" ON "training_managers"("email");

-- CreateIndex
CREATE INDEX "training_managers_gofastCompanyId_idx" ON "training_managers"("gofastCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "training_plan_persona_slug_key" ON "training_plan_persona"("slug");

-- CreateIndex
CREATE INDEX "training_plan_persona_capability_idx" ON "training_plan_persona"("capability");

-- CreateIndex
CREATE UNIQUE INDEX "training_plan_goal_slug_key" ON "training_plan_goal"("slug");

-- CreateIndex
CREATE INDEX "training_plan_goal_personaId_idx" ON "training_plan_goal"("personaId");

-- CreateIndex
CREATE INDEX "training_plan_goal_planDurationWeeks_idx" ON "training_plan_goal"("planDurationWeeks");

-- CreateIndex
CREATE UNIQUE INDEX "training_plan_preset_slug_key" ON "training_plan_preset"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "training_plan_preset_parent_slug_key" ON "training_plan_preset_parent"("slug");

-- CreateIndex
CREATE INDEX "training_plan_preset_parent_buildPresetId_idx" ON "training_plan_preset_parent"("buildPresetId");

-- CreateIndex
CREATE INDEX "training_plan_preset_parent_taperPresetId_idx" ON "training_plan_preset_parent"("taperPresetId");

-- CreateIndex
CREATE INDEX "training_plan_preset_parent_raceWeekPresetId_idx" ON "training_plan_preset_parent"("raceWeekPresetId");

-- CreateIndex
CREATE INDEX "shakeout_run_config_name_idx" ON "shakeout_run_config"("name");

-- CreateIndex
CREATE UNIQUE INDEX "workout_catalogue_slug_key" ON "workout_catalogue"("slug");

-- CreateIndex
CREATE INDEX "workout_catalogue_workoutType_idx" ON "workout_catalogue"("workoutType");

-- CreateIndex
CREATE INDEX "long_run_config_name_idx" ON "long_run_config"("name");

-- CreateIndex
CREATE INDEX "long_run_config_position_longRunConfigId_idx" ON "long_run_config_position"("longRunConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "long_run_config_position_longRunConfigId_cyclePosition_key" ON "long_run_config_position"("longRunConfigId", "cyclePosition");

-- CreateIndex
CREATE INDEX "intervals_config_name_idx" ON "intervals_config"("name");

-- CreateIndex
CREATE INDEX "intervals_config_position_intervalsConfigId_idx" ON "intervals_config_position"("intervalsConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "intervals_config_position_intervalsConfigId_cyclePosition_key" ON "intervals_config_position"("intervalsConfigId", "cyclePosition");

-- CreateIndex
CREATE INDEX "tempo_config_name_idx" ON "tempo_config"("name");

-- CreateIndex
CREATE INDEX "tempo_config_position_tempoConfigId_idx" ON "tempo_config_position"("tempoConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "tempo_config_position_tempoConfigId_cyclePosition_key" ON "tempo_config_position"("tempoConfigId", "cyclePosition");

-- CreateIndex
CREATE INDEX "easy_config_name_idx" ON "easy_config"("name");

-- CreateIndex
CREATE INDEX "easy_config_position_easyConfigId_idx" ON "easy_config_position"("easyConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "easy_config_position_easyConfigId_cyclePosition_key" ON "easy_config_position"("easyConfigId", "cyclePosition");

-- AddForeignKey
ALTER TABLE "training_managers" ADD CONSTRAINT "training_managers_gofastCompanyId_fkey" FOREIGN KEY ("gofastCompanyId") REFERENCES "gofast_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_goal" ADD CONSTRAINT "training_plan_goal_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "training_plan_persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "training_plan_persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "training_plan_goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_longRunConfigId_fkey" FOREIGN KEY ("longRunConfigId") REFERENCES "long_run_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_intervalsConfigId_fkey" FOREIGN KEY ("intervalsConfigId") REFERENCES "intervals_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_tempoConfigId_fkey" FOREIGN KEY ("tempoConfigId") REFERENCES "tempo_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_easyConfigId_fkey" FOREIGN KEY ("easyConfigId") REFERENCES "easy_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_preset_parent" ADD CONSTRAINT "training_plan_preset_parent_buildPresetId_fkey" FOREIGN KEY ("buildPresetId") REFERENCES "training_plan_preset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_preset_parent" ADD CONSTRAINT "training_plan_preset_parent_taperPresetId_fkey" FOREIGN KEY ("taperPresetId") REFERENCES "training_plan_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_preset_parent" ADD CONSTRAINT "training_plan_preset_parent_raceWeekPresetId_fkey" FOREIGN KEY ("raceWeekPresetId") REFERENCES "race_week_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_week_preset" ADD CONSTRAINT "race_week_preset_shakeoutRunConfigId_fkey" FOREIGN KEY ("shakeoutRunConfigId") REFERENCES "shakeout_run_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "long_run_config_position" ADD CONSTRAINT "long_run_config_position_longRunConfigId_fkey" FOREIGN KEY ("longRunConfigId") REFERENCES "long_run_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "long_run_config_position" ADD CONSTRAINT "long_run_config_position_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervals_config_position" ADD CONSTRAINT "intervals_config_position_intervalsConfigId_fkey" FOREIGN KEY ("intervalsConfigId") REFERENCES "intervals_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervals_config_position" ADD CONSTRAINT "intervals_config_position_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tempo_config_position" ADD CONSTRAINT "tempo_config_position_tempoConfigId_fkey" FOREIGN KEY ("tempoConfigId") REFERENCES "tempo_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tempo_config_position" ADD CONSTRAINT "tempo_config_position_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "easy_config_position" ADD CONSTRAINT "easy_config_position_easyConfigId_fkey" FOREIGN KEY ("easyConfigId") REFERENCES "easy_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "easy_config_position" ADD CONSTRAINT "easy_config_position_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

