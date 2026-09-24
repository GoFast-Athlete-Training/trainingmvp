import type { Prisma, training_plan_preset } from "@prisma/client";

/** Rotation FKs copied from import onto phase rows when Company still sends monolithic preset. */
export function rotationIdsFromPlan(
  p: Pick<
    training_plan_preset,
    "longRunConfigId" | "intervalsConfigId" | "tempoConfigId" | "easyConfigId"
  >,
): Pick<
  Prisma.build_presetUncheckedCreateInput,
  "longRunConfigId" | "intervalsConfigId" | "tempoConfigId" | "easyConfigId"
> {
  return {
    longRunConfigId: p.longRunConfigId,
    intervalsConfigId: p.intervalsConfigId,
    tempoConfigId: p.tempoConfigId,
    easyConfigId: p.easyConfigId,
  };
}

export function rotationIdsForTaper(
  p: Pick<
    training_plan_preset,
    "longRunConfigId" | "intervalsConfigId" | "tempoConfigId" | "easyConfigId"
  >,
): Pick<
  Prisma.taper_presetUncheckedCreateInput,
  "longRunConfigId" | "intervalsConfigId" | "tempoConfigId" | "easyConfigId"
> {
  return rotationIdsFromPlan(p);
}

/** @deprecated use rotationIdsFromPlan — pools removed */
export function planPresetBodyForBuild(): Prisma.build_presetUncheckedUpdateInput {
  return {};
}

/** @deprecated */
export function planPresetBodyForTaper(): Prisma.taper_presetUncheckedUpdateInput {
  return {};
}
