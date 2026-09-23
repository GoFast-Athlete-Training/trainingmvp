import type { Prisma, training_plan_preset } from "@prisma/client";

/** Company HQ preset body fields stored on build_preset after modular split. */
export function planPresetBodyForBuild(
  p: Pick<
    training_plan_preset,
    | "longRunCycleWeeks"
    | "minWeeklyMiles"
    | "maxWeeklyMiles"
    | "baseLongRunPoolMiles"
    | "peakLongRunPoolMiles"
    | "taperLongRunPoolMiles"
    | "tempoIdealDow"
    | "intervalIdealDow"
    | "longRunDefaultDow"
    | "longRunConfigId"
    | "intervalsConfigId"
    | "tempoConfigId"
    | "easyConfigId"
    | "easyRunConfig"
    | "coachPlanOverview"
    | "workoutStructure"
  >,
): Prisma.build_presetUncheckedUpdateInput {
  return {
    longRunCycleWeeks: p.longRunCycleWeeks,
    minWeeklyMiles: p.minWeeklyMiles,
    maxWeeklyMiles: p.maxWeeklyMiles,
    baseLongRunPoolMiles: p.baseLongRunPoolMiles,
    peakLongRunPoolMiles: p.peakLongRunPoolMiles,
    taperLongRunPoolMiles: p.taperLongRunPoolMiles,
    tempoIdealDow: p.tempoIdealDow,
    intervalIdealDow: p.intervalIdealDow,
    longRunDefaultDow: p.longRunDefaultDow,
    longRunConfigId: p.longRunConfigId,
    intervalsConfigId: p.intervalsConfigId,
    tempoConfigId: p.tempoConfigId,
    easyConfigId: p.easyConfigId,
    easyRunConfig: p.easyRunConfig ?? undefined,
    coachPlanOverview: p.coachPlanOverview ?? undefined,
    workoutStructure: p.workoutStructure ?? undefined,
  };
}

export function planPresetBodyForTaper(
  p: Pick<
    training_plan_preset,
    | "taperLongRunPoolMiles"
    | "tempoIdealDow"
    | "intervalIdealDow"
    | "longRunDefaultDow"
    | "longRunConfigId"
    | "intervalsConfigId"
    | "tempoConfigId"
    | "easyConfigId"
    | "easyRunConfig"
  >,
): Prisma.taper_presetUncheckedUpdateInput {
  return {
    taperLongRunPoolMiles: p.taperLongRunPoolMiles,
    tempoIdealDow: p.tempoIdealDow,
    intervalIdealDow: p.intervalIdealDow,
    longRunDefaultDow: p.longRunDefaultDow,
    longRunConfigId: p.longRunConfigId,
    intervalsConfigId: p.intervalsConfigId,
    tempoConfigId: p.tempoConfigId,
    easyConfigId: p.easyConfigId,
    easyRunConfig: p.easyRunConfig ?? undefined,
  };
}
