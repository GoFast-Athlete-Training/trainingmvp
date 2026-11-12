-- Training Manage: catalog / presets live on prod. Keep operator tables only.

DROP TABLE IF EXISTS "training_plan_preset" CASCADE;
DROP TABLE IF EXISTS "training_plan_goal" CASCADE;
DROP TABLE IF EXISTS "training_plan_persona" CASCADE;
DROP TABLE IF EXISTS "phase_preset" CASCADE;
DROP TABLE IF EXISTS "build_preset" CASCADE;
DROP TABLE IF EXISTS "taper_preset" CASCADE;
DROP TABLE IF EXISTS "race_week_preset" CASCADE;
DROP TABLE IF EXISTS "shakeout_run_config" CASCADE;
DROP TABLE IF EXISTS "workout_catalogue" CASCADE;
DROP TABLE IF EXISTS "long_run_config_position" CASCADE;
DROP TABLE IF EXISTS "long_run_config" CASCADE;
DROP TABLE IF EXISTS "intervals_config_position" CASCADE;
DROP TABLE IF EXISTS "intervals_config" CASCADE;
DROP TABLE IF EXISTS "tempo_config_position" CASCADE;
DROP TABLE IF EXISTS "tempo_config" CASCADE;
DROP TABLE IF EXISTS "easy_config_position" CASCADE;
DROP TABLE IF EXISTS "easy_config" CASCADE;
DROP TABLE IF EXISTS "training_plan_preset_parent" CASCADE;
DROP TABLE IF EXISTS "build_preset_workout" CASCADE;
DROP TABLE IF EXISTS "taper_preset_workout" CASCADE;
DROP TABLE IF EXISTS "build_config_workout" CASCADE;
DROP TABLE IF EXISTS "build_config" CASCADE;
DROP TABLE IF EXISTS "taper_config_workout" CASCADE;
DROP TABLE IF EXISTS "taper_config" CASCADE;

DROP TYPE IF EXISTS "WorkoutType" CASCADE;
DROP TYPE IF EXISTS "AthletePersonaCapability" CASCADE;
DROP TYPE IF EXISTS "AthletePersonaDedication" CASCADE;
DROP TYPE IF EXISTS "FitnessDelta" CASCADE;
DROP TYPE IF EXISTS "ProgressionAggressiveness" CASCADE;
DROP TYPE IF EXISTS "TrainingPlanGoalKind" CASCADE;
DROP TYPE IF EXISTS "TrainingPlanGoalType" CASCADE;
DROP TYPE IF EXISTS "RaceWeekSlotType" CASCADE;
