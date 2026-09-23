import { presetCoreFromPreset } from "@/lib/training/preset-core";
import type {
  easy_config,
  intervals_config,
  long_run_config,
  long_run_config_position,
  race_week_preset,
  shakeout_run_config,
  tempo_config,
  training_plan_preset,
  training_plan_preset_parent,
} from "@prisma/client";

type ConfigWithPositions = long_run_config & {
  positions: long_run_config_position[];
};

export function serializeBuildPreset(
  row: training_plan_preset & {
    longRunConfig?: ConfigWithPositions | null;
    easyConfig?: easy_config | null;
    tempoConfig?: tempo_config | null;
    intervalsConfig?: intervals_config | null;
    buildConfig?: { id: string; name: string } | null;
    taperConfig?: { id: string; name: string } | null;
    raceWeekPreset?: { id: string; title: string } | null;
  },
) {
  const presetCore = presetCoreFromPreset({
    minWeeklyMiles: row.minWeeklyMiles,
    maxWeeklyMiles: row.maxWeeklyMiles,
    coachPlanOverview: row.coachPlanOverview,
    peakLongRunPoolMiles: row.peakLongRunPoolMiles,
  });

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    presetCore,
    minWeeklyMiles: row.minWeeklyMiles,
    maxWeeklyMiles: row.maxWeeklyMiles,
    longRunCycleWeeks: row.longRunCycleWeeks,
    longRunDefaultDow: row.longRunDefaultDow,
    tempoIdealDow: row.tempoIdealDow,
    intervalIdealDow: row.intervalIdealDow,
    peakLongRunPoolMiles: row.peakLongRunPoolMiles,
    longRunConfigId: row.longRunConfigId,
    easyConfigId: row.easyConfigId,
    tempoConfigId: row.tempoConfigId,
    intervalsConfigId: row.intervalsConfigId,
    buildConfigId: row.buildConfigId,
    taperConfigId: row.taperConfigId,
    raceWeekPresetId: row.raceWeekPresetId,
    snapPeakLongRunMiles: row.snapPeakLongRunMiles,
    snapPeakWeeklyMiles: row.snapPeakWeeklyMiles,
    snapTaperWeek1TotalMiles: row.snapTaperWeek1TotalMiles,
    snapTaperWeek1LongRunMiles: row.snapTaperWeek1LongRunMiles,
    snapTaperWeek2TotalMiles: row.snapTaperWeek2TotalMiles,
    snapTaperWeek2LongRunMiles: row.snapTaperWeek2LongRunMiles,
    buildConfig:
      "buildConfig" in row && row.buildConfig
        ? { id: row.buildConfig.id, name: row.buildConfig.name }
        : null,
    taperConfig:
      "taperConfig" in row && row.taperConfig
        ? { id: row.taperConfig.id, name: row.taperConfig.name }
        : null,
    raceWeekPreset:
      "raceWeekPreset" in row && row.raceWeekPreset
        ? { id: row.raceWeekPreset.id, title: row.raceWeekPreset.title }
        : null,
    longRunConfig: row.longRunConfig
      ? {
          id: row.longRunConfig.id,
          name: row.longRunConfig.name,
          positions: row.longRunConfig.positions.map((p) => ({
            cyclePosition: p.cyclePosition,
            catalogueWorkoutId: p.catalogueWorkoutId,
            distributionWeight: p.distributionWeight,
          })),
        }
      : null,
    easyConfig: row.easyConfig ? { id: row.easyConfig.id, name: row.easyConfig.name } : null,
    tempoConfig: row.tempoConfig ? { id: row.tempoConfig.id, name: row.tempoConfig.name } : null,
    intervalsConfig: row.intervalsConfig
      ? { id: row.intervalsConfig.id, name: row.intervalsConfig.name }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeParentPreset(
  row: training_plan_preset_parent & {
    buildPreset: training_plan_preset;
    taperPreset?: training_plan_preset | null;
    raceWeekPreset?: race_week_preset | null;
  },
) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    buildPresetId: row.buildPresetId,
    taperPresetId: row.taperPresetId,
    raceWeekPresetId: row.raceWeekPresetId,
    peakWeeklyMiles: row.peakWeeklyMiles,
    peakLongRunMiles: row.peakLongRunMiles,
    buildLongRunWeekends: row.buildLongRunWeekends,
    buildPreset: { id: row.buildPreset.id, title: row.buildPreset.title, slug: row.buildPreset.slug },
    taperPreset: row.taperPreset
      ? { id: row.taperPreset.id, title: row.taperPreset.title, longRunConfigId: row.taperPreset.longRunConfigId }
      : null,
    raceWeekPreset: row.raceWeekPreset
      ? serializeRaceWeekPreset(row.raceWeekPreset)
      : null,
  };
}

export function serializeRaceWeekPreset(row: race_week_preset & { shakeoutRunConfig?: shakeout_run_config | null }) {
  return {
    id: row.id,
    title: row.title,
    shakeoutRunConfigId: row.shakeoutRunConfigId,
    shakeoutDaysPriorToRace: row.shakeoutDaysPriorToRace,
    slots: row.slots,
    shakeoutRunConfig: row.shakeoutRunConfig
      ? {
          id: row.shakeoutRunConfig.id,
          name: row.shakeoutRunConfig.name,
          totalMiles: row.shakeoutRunConfig.totalMiles,
          paceOffsetSecPerMile: row.shakeoutRunConfig.paceOffsetSecPerMile,
        }
      : null,
  };
}
