import type {
  easy_config,
  intervals_config,
  long_run_config,
  long_run_config_position,
  race_week_preset,
  shakeout_run_config,
  tempo_config,
  training_plan_preset,
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
    buildPreset?: { id: string; name: string } | null;
    taperPreset?: { id: string; name: string } | null;
    raceWeekPreset?: { id: string; title: string } | null;
  },
) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    publicDescription: row.publicDescription,
    targetDistanceLabel: row.targetDistanceLabel,
    coachIntent: row.coachIntent,
    personaId: row.personaId,
    minWeeklyMiles: row.minWeeklyMiles,
    maxWeeklyMiles: row.maxWeeklyMiles,
    longRunConfigId: row.longRunConfigId,
    easyConfigId: row.easyConfigId,
    tempoConfigId: row.tempoConfigId,
    intervalsConfigId: row.intervalsConfigId,
    buildPresetId: row.buildPresetId,
    taperPresetId: row.taperPresetId,
    raceWeekPresetId: row.raceWeekPresetId,
    snapPeakLongRunMiles: row.snapPeakLongRunMiles,
    snapPeakWeeklyMiles: row.snapPeakWeeklyMiles,
    snapTaperWeek1TotalMiles: row.snapTaperWeek1TotalMiles,
    snapTaperWeek1LongRunMiles: row.snapTaperWeek1LongRunMiles,
    snapTaperWeek2TotalMiles: row.snapTaperWeek2TotalMiles,
    snapTaperWeek2LongRunMiles: row.snapTaperWeek2LongRunMiles,
    buildPreset:
      "buildPreset" in row && row.buildPreset
        ? { id: row.buildPreset.id, name: row.buildPreset.name }
        : null,
    taperPreset:
      "taperPreset" in row && row.taperPreset
        ? { id: row.taperPreset.id, name: row.taperPreset.name }
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

export function serializeRaceWeekPreset(row: race_week_preset & { shakeoutRunConfig?: shakeout_run_config | null }) {
  return {
    id: row.id,
    title: row.title,
    shakeoutRunConfigId: row.shakeoutRunConfigId,
    shakeoutDaysPriorToRace: row.shakeoutDaysPriorToRace,
    slots: row.slots,
    weekPins: row.weekPins,
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
