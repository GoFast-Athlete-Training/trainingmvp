-- Mutable build and taper configs. Preset stores snaps plus references.
-- Race week already exists; the preset only gains a foreign key to it.

CREATE TABLE "build_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "peakLongRunMiles" DOUBLE PRECISION,
    "peakWeeklyMiles" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "build_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "build_config_workout" (
    "buildConfigId" TEXT NOT NULL,
    "catalogueWorkoutId" TEXT NOT NULL,

    CONSTRAINT "build_config_workout_pkey" PRIMARY KEY ("buildConfigId","catalogueWorkoutId")
);

CREATE TABLE "taper_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "week1TotalMiles" DOUBLE PRECISION,
    "week1LongRunMiles" DOUBLE PRECISION,
    "week2TotalMiles" DOUBLE PRECISION,
    "week2LongRunMiles" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taper_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "taper_config_workout" (
    "taperConfigId" TEXT NOT NULL,
    "catalogueWorkoutId" TEXT NOT NULL,

    CONSTRAINT "taper_config_workout_pkey" PRIMARY KEY ("taperConfigId","catalogueWorkoutId")
);

ALTER TABLE "training_plan_preset"
ADD COLUMN "buildConfigId" TEXT,
ADD COLUMN "taperConfigId" TEXT,
ADD COLUMN "raceWeekPresetId" TEXT,
ADD COLUMN "snapPeakLongRunMiles" DOUBLE PRECISION,
ADD COLUMN "snapPeakWeeklyMiles" INTEGER,
ADD COLUMN "snapTaperWeek1TotalMiles" DOUBLE PRECISION,
ADD COLUMN "snapTaperWeek1LongRunMiles" DOUBLE PRECISION,
ADD COLUMN "snapTaperWeek2TotalMiles" DOUBLE PRECISION,
ADD COLUMN "snapTaperWeek2LongRunMiles" DOUBLE PRECISION;

CREATE INDEX "training_plan_preset_buildConfigId_idx" ON "training_plan_preset"("buildConfigId");
CREATE INDEX "training_plan_preset_taperConfigId_idx" ON "training_plan_preset"("taperConfigId");
CREATE INDEX "training_plan_preset_raceWeekPresetId_idx" ON "training_plan_preset"("raceWeekPresetId");
CREATE INDEX "build_config_workout_catalogueWorkoutId_idx" ON "build_config_workout"("catalogueWorkoutId");
CREATE INDEX "taper_config_workout_catalogueWorkoutId_idx" ON "taper_config_workout"("catalogueWorkoutId");

ALTER TABLE "build_config_workout"
ADD CONSTRAINT "build_config_workout_buildConfigId_fkey"
FOREIGN KEY ("buildConfigId") REFERENCES "build_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "build_config_workout"
ADD CONSTRAINT "build_config_workout_catalogueWorkoutId_fkey"
FOREIGN KEY ("catalogueWorkoutId") REFERENCES "workout_catalogue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "taper_config_workout"
ADD CONSTRAINT "taper_config_workout_taperConfigId_fkey"
FOREIGN KEY ("taperConfigId") REFERENCES "taper_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "taper_config_workout"
ADD CONSTRAINT "taper_config_workout_catalogueWorkoutId_fkey"
FOREIGN KEY ("catalogueWorkoutId") REFERENCES "workout_catalogue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "training_plan_preset"
ADD CONSTRAINT "training_plan_preset_buildConfigId_fkey"
FOREIGN KEY ("buildConfigId") REFERENCES "build_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "training_plan_preset"
ADD CONSTRAINT "training_plan_preset_taperConfigId_fkey"
FOREIGN KEY ("taperConfigId") REFERENCES "taper_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "training_plan_preset"
ADD CONSTRAINT "training_plan_preset_raceWeekPresetId_fkey"
FOREIGN KEY ("raceWeekPresetId") REFERENCES "race_week_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
