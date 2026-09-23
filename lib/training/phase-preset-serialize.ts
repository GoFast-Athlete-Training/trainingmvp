import type { build_preset, taper_preset } from "@prisma/client";
import { buildPresetInclude, taperPresetInclude } from "@/lib/training/phase-preset-include";

type BuildWithConfigs = build_preset & {
  longRunConfig?: { id: string; name: string } | null;
  easyConfig?: { id: string; name: string } | null;
  tempoConfig?: { id: string; name: string } | null;
  intervalsConfig?: { id: string; name: string } | null;
};

type TaperWithConfigs = taper_preset & {
  longRunConfig?: { id: string; name: string } | null;
  easyConfig?: { id: string; name: string } | null;
  tempoConfig?: { id: string; name: string } | null;
  intervalsConfig?: { id: string; name: string } | null;
};

export function serializeBuildPhasePreset(row: BuildWithConfigs) {
  return {
    id: row.id,
    name: row.name,
    longRunCycleWeeks: row.longRunCycleWeeks,
    minWeeklyMiles: row.minWeeklyMiles,
    maxWeeklyMiles: row.maxWeeklyMiles,
    baseLongRunPoolMiles: row.baseLongRunPoolMiles,
    peakLongRunPoolMiles: row.peakLongRunPoolMiles,
    taperLongRunPoolMiles: row.taperLongRunPoolMiles,
    tempoIdealDow: row.tempoIdealDow,
    intervalIdealDow: row.intervalIdealDow,
    longRunDefaultDow: row.longRunDefaultDow,
    longRunConfigId: row.longRunConfigId,
    easyConfigId: row.easyConfigId,
    tempoConfigId: row.tempoConfigId,
    intervalsConfigId: row.intervalsConfigId,
    easyRunConfig: row.easyRunConfig,
    coachPlanOverview: row.coachPlanOverview,
    workoutStructure: row.workoutStructure,
    longRunConfig: row.longRunConfig ?? null,
    easyConfig: row.easyConfig ?? null,
    tempoConfig: row.tempoConfig ?? null,
    intervalsConfig: row.intervalsConfig ?? null,
  };
}

export function serializeTaperPhasePreset(row: TaperWithConfigs) {
  return {
    id: row.id,
    name: row.name,
    week1TotalMiles: row.week1TotalMiles,
    week1LongRunMiles: row.week1LongRunMiles,
    week2TotalMiles: row.week2TotalMiles,
    week2LongRunMiles: row.week2LongRunMiles,
    taperLongRunPoolMiles: row.taperLongRunPoolMiles,
    tempoIdealDow: row.tempoIdealDow,
    intervalIdealDow: row.intervalIdealDow,
    longRunDefaultDow: row.longRunDefaultDow,
    longRunConfigId: row.longRunConfigId,
    easyConfigId: row.easyConfigId,
    tempoConfigId: row.tempoConfigId,
    intervalsConfigId: row.intervalsConfigId,
    easyRunConfig: row.easyRunConfig,
    longRunConfig: row.longRunConfig ?? null,
    easyConfig: row.easyConfig ?? null,
    tempoConfig: row.tempoConfig ?? null,
    intervalsConfig: row.intervalsConfig ?? null,
  };
}

export { buildPresetInclude, taperPresetInclude };
