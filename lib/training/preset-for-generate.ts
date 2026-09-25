import { prisma } from "@/lib/prisma";
import { parsePhaseWeekRows, phaseWeekRowsFromLegacyTaper } from "@/lib/training/phase-week-pins";

const rotationInclude = {
  include: {
    positions: {
      orderBy: { cyclePosition: "asc" as const },
      select: {
        cyclePosition: true,
        catalogueWorkoutId: true,
        distributionWeight: true,
      },
    },
  },
} as const;

function mapRotation(config: {
  id: string;
  name: string;
  positions: {
    cyclePosition: number;
    catalogueWorkoutId: string | null;
    distributionWeight: number;
  }[];
} | null) {
  if (!config) return null;
  return {
    id: config.id,
    name: config.name,
    positions: config.positions.map((p) => ({
      cyclePosition: p.cyclePosition,
      catalogueWorkoutId: p.catalogueWorkoutId,
      distributionWeight: p.distributionWeight,
    })),
  };
}

export type TrainingManagePresetForGenerate = {
  id: string;
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
  publicDescription: string | null;
  targetDistanceLabel: string | null;
  build: {
    startLongRunMiles: number | null;
    peakLongRunMiles: number | null;
    peakWeeklyMiles: number | null;
    longRunConfigId: string | null;
    easyConfigId: string | null;
    tempoConfigId: string | null;
    intervalsConfigId: string | null;
    longRunConfig: ReturnType<typeof mapRotation>;
    easyConfig: ReturnType<typeof mapRotation>;
    tempoConfig: ReturnType<typeof mapRotation>;
    intervalsConfig: ReturnType<typeof mapRotation>;
  } | null;
  taper: {
    name: string;
    weeks: ReturnType<typeof phaseWeekRowsFromLegacyTaper>;
  } | null;
  raceWeek: {
    title: string;
    shakeoutRunConfigId: string | null;
    shakeoutDaysPriorToRace: number;
    weeks: ReturnType<typeof parsePhaseWeekRows>;
  } | null;
};

export async function loadPresetForGenerate(
  presetId: string,
): Promise<TrainingManagePresetForGenerate | null> {
  const row = await prisma.training_plan_preset.findUnique({
    where: { id: presetId },
    include: {
      buildPreset: {
        include: {
          longRunConfig: rotationInclude,
          easyConfig: rotationInclude,
          tempoConfig: rotationInclude,
          intervalsConfig: rotationInclude,
        },
      },
      taperPreset: true,
      raceWeekPreset: true,
    },
  });
  if (!row) return null;

  const build = row.buildPreset;
  return {
    id: row.id,
    minWeeklyMiles: row.minWeeklyMiles,
    maxWeeklyMiles: row.maxWeeklyMiles,
    publicDescription: row.publicDescription,
    targetDistanceLabel: row.targetDistanceLabel,
    build: build
      ? {
          startLongRunMiles: build.startLongRunMiles,
          peakLongRunMiles: build.peakLongRunMiles,
          peakWeeklyMiles: build.maxWeeklyMiles,
          longRunConfigId: build.longRunConfigId,
          easyConfigId: build.easyConfigId,
          tempoConfigId: build.tempoConfigId,
          intervalsConfigId: build.intervalsConfigId,
          longRunConfig: mapRotation(build.longRunConfig),
          easyConfig: mapRotation(build.easyConfig),
          tempoConfig: mapRotation(build.tempoConfig),
          intervalsConfig: mapRotation(build.intervalsConfig),
        }
      : null,
    taper: row.taperPreset
      ? {
          name: row.taperPreset.name,
          weeks: phaseWeekRowsFromLegacyTaper(row.taperPreset),
        }
      : null,
    raceWeek: row.raceWeekPreset
      ? {
          title: row.raceWeekPreset.title,
          shakeoutRunConfigId: row.raceWeekPreset.shakeoutRunConfigId,
          shakeoutDaysPriorToRace: row.raceWeekPreset.shakeoutDaysPriorToRace,
          weeks: parsePhaseWeekRows(row.raceWeekPreset.weekPins),
        }
      : null,
  };
}
