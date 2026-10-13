import { prisma } from "@/lib/prisma";
import { loadPresetForGenerate } from "@/lib/training/preset-for-generate";

const rotationInclude = {
  include: {
    positions: {
      orderBy: { cyclePosition: "asc" as const },
      include: {
        workout_catalogue: true,
      },
    },
  },
} as const;

function collectCatalogues(
  config: { positions?: { workout_catalogue: unknown }[] } | null | undefined,
  out: Map<string, Record<string, unknown>>,
) {
  if (!config?.positions) return;
  for (const p of config.positions) {
    const cat = p.workout_catalogue;
    if (cat != null && typeof cat === "object" && !Array.isArray(cat)) {
      const row = cat as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : null;
      if (id) out.set(id, row);
    }
  }
}

function collectFromPhase(
  phase: Record<string, unknown> | null | undefined,
  catalogues: Map<string, Record<string, unknown>>,
) {
  if (!phase) return;
  for (const key of ["longRunConfig", "intervalsConfig", "tempoConfig", "easyConfig"] as const) {
    const cfg = phase[key];
    if (cfg && typeof cfg === "object" && !Array.isArray(cfg)) {
      collectCatalogues(cfg as { positions?: { workout_catalogue: unknown }[] }, catalogues);
    }
  }
}

function serializeRotationConfig(
  config: {
    id: string;
    name: string;
    description?: string | null;
    positions: {
      id: string;
      cyclePosition: number;
      distributionWeight: number;
      catalogueWorkoutId: string | null;
      workout_catalogue: unknown;
    }[];
  } | null,
) {
  if (!config) return null;
  return {
    id: config.id,
    name: config.name,
    description: config.description ?? null,
    positions: config.positions.map((p) => ({
      id: p.id,
      cyclePosition: p.cyclePosition,
      distributionWeight: p.distributionWeight,
      catalogueWorkoutId: p.catalogueWorkoutId,
      workout_catalogue: p.workout_catalogue,
    })),
  };
}

export async function buildPresetProdPushPayload(presetId: string) {
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
      taperPreset: {
        include: {
          longRunConfig: rotationInclude,
          easyConfig: rotationInclude,
          tempoConfig: rotationInclude,
          intervalsConfig: rotationInclude,
        },
      },
      raceWeekPreset: true,
    },
  });
  if (!row) {
    throw new Error(`Preset ${presetId} not found`);
  }

  const phaseGenerate = await loadPresetForGenerate(presetId);
  if (!phaseGenerate?.build && !row.buildPresetId) {
    throw new Error(`Preset ${presetId} has no build phase — cannot mirror to prod`);
  }

  const build = row.buildPreset;
  const buildPreset = build
    ? {
        id: build.id,
        name: build.name,
        startLongRunMiles: build.startLongRunMiles,
        peakLongRunMiles: build.peakLongRunMiles,
        longRunCutback: build.longRunCutback,
        maxWeeklyMiles: build.maxWeeklyMiles,
        longRunConfigId: build.longRunConfigId,
        easyConfigId: build.easyConfigId,
        tempoConfigId: build.tempoConfigId,
        intervalsConfigId: build.intervalsConfigId,
        longRunConfig: serializeRotationConfig(build.longRunConfig),
        easyConfig: serializeRotationConfig(build.easyConfig),
        tempoConfig: serializeRotationConfig(build.tempoConfig),
        intervalsConfig: serializeRotationConfig(build.intervalsConfig),
      }
    : null;

  const taper = row.taperPreset;
  const taperPreset = taper
    ? {
        id: taper.id,
        name: taper.name,
        week1TotalMiles: taper.week1TotalMiles,
        week1LongRunMiles: taper.week1LongRunMiles,
        week2TotalMiles: taper.week2TotalMiles,
        week2LongRunMiles: taper.week2LongRunMiles,
        weekPins: taper.weekPins,
        longRunConfigId: taper.longRunConfigId,
        easyConfigId: taper.easyConfigId,
        tempoConfigId: taper.tempoConfigId,
        intervalsConfigId: taper.intervalsConfigId,
        longRunConfig: serializeRotationConfig(taper.longRunConfig),
        easyConfig: serializeRotationConfig(taper.easyConfig),
        tempoConfig: serializeRotationConfig(taper.tempoConfig),
        intervalsConfig: serializeRotationConfig(taper.intervalsConfig),
      }
    : null;

  const raceWeekPreset = row.raceWeekPreset
    ? {
        id: row.raceWeekPreset.id,
        title: row.raceWeekPreset.title,
        slots: row.raceWeekPreset.slots,
      }
    : null;

  const catalogues = new Map<string, Record<string, unknown>>();
  collectFromPhase(buildPreset, catalogues);
  collectFromPhase(taperPreset, catalogues);

  const shakeoutIds = new Set<string>();
  if (Array.isArray(raceWeekPreset?.slots)) {
    for (const slot of raceWeekPreset.slots) {
      if (slot && typeof slot === "object") {
        const sid = (slot as Record<string, unknown>).shakeoutRunConfigId;
        if (typeof sid === "string" && sid) shakeoutIds.add(sid);
      }
    }
  }

  const shakeoutRunConfigs =
    shakeoutIds.size > 0
      ? await prisma.shakeout_run_config.findMany({
          where: { id: { in: [...shakeoutIds] } },
        })
      : [];

  const peakPool =
    build?.peakLongRunMiles != null && Number.isFinite(build.peakLongRunMiles)
      ? build.peakLongRunMiles * 4
      : 32;

  const plan = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    publicDescription: row.publicDescription,
    targetDistanceLabel: row.targetDistanceLabel,
    personaId: row.personaId,
    goalId: row.goalId,
    coachIntent: row.coachIntent,
    objectiveOfPlan: row.objectiveOfPlan,
    athletePersonaCapability: row.athletePersonaCapability,
    athletePersonaGoal: row.athletePersonaGoal,
    athletePersonaDedication: row.athletePersonaDedication,
    coachPlanOverview: row.coachPlanOverview,
    workoutStructure: row.workoutStructure,
    easyRunConfig: row.easyRunConfig,
    longRunCycleWeeks: row.longRunCycleWeeks,
    minWeeklyMiles: row.minWeeklyMiles,
    maxWeeklyMiles: row.maxWeeklyMiles,
    tempoIdealDow: row.tempoIdealDow,
    intervalIdealDow: row.intervalIdealDow,
    longRunDefaultDow: row.longRunDefaultDow,
    baseLongRunPoolMiles: peakPool > 0 ? peakPool * 0.6 : 24,
    peakLongRunPoolMiles: peakPool > 0 ? peakPool : 32,
    taperLongRunPoolMiles: peakPool > 0 ? peakPool * 0.5 : 16,
    buildPresetId: row.buildPresetId,
    taperPresetId: row.taperPresetId,
    raceWeekPresetId: row.raceWeekPresetId,
    snapPeakLongRunMiles: row.snapPeakLongRunMiles,
    snapPeakWeeklyMiles: row.snapPeakWeeklyMiles,
    snapTaperWeek1TotalMiles: row.snapTaperWeek1TotalMiles,
    snapTaperWeek1LongRunMiles: row.snapTaperWeek1LongRunMiles,
    snapTaperWeek2TotalMiles: row.snapTaperWeek2TotalMiles,
    snapTaperWeek2LongRunMiles: row.snapTaperWeek2LongRunMiles,
  };

  return {
    plan,
    buildPreset,
    taperPreset,
    raceWeekPreset,
    workoutCatalogues: [...catalogues.values()],
    shakeoutRunConfigs,
    phaseGenerate,
  };
}
