import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Product preset export shape from gofastapp-mvp plan-preset API. */
export type ProductPresetImportPayload = {
  preset: Record<string, unknown>;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/**
 * Product rotation / persona rows live in gofastapp-mvp — IDs must not be copied into Training Manage.
 * Staff link rotations on the preset detail page after send (same idea as race body copy without satellite FKs).
 */
export async function importBuildPreset(payload: ProductPresetImportPayload): Promise<{ presetId: string }> {
  const p = payload.preset;
  const id = str(p.id);
  const title = str(p.title);
  const slug = str(p.slug);
  if (!id || !title || !slug) {
    throw new Error("preset.id, preset.title, and preset.slug are required");
  }

  const data: Prisma.training_plan_presetUncheckedCreateInput = {
    id,
    slug,
    title,
    description: str(p.description) ?? null,
    publicDescription: str(p.publicDescription) ?? null,
    targetDistanceLabel: str(p.targetDistanceLabel) ?? null,
    personaId: null,
    goalId: null,
    coachIntent: str(p.coachIntent) ?? null,
    objectiveOfPlan: str(p.objectiveOfPlan) ?? null,
    athletePersonaCapability: (p.athletePersonaCapability as Prisma.training_plan_presetUncheckedCreateInput["athletePersonaCapability"]) ?? null,
    athletePersonaGoal: str(p.athletePersonaGoal) ?? null,
    athletePersonaDedication: (p.athletePersonaDedication as Prisma.training_plan_presetUncheckedCreateInput["athletePersonaDedication"]) ?? null,
    coachPlanOverview: (p.coachPlanOverview as Prisma.InputJsonValue) ?? undefined,
    workoutStructure: (p.workoutStructure as Prisma.InputJsonValue) ?? undefined,
    longRunCycleWeeks: num(p.longRunCycleWeeks) ?? 4,
    minWeeklyMiles: num(p.minWeeklyMiles) ?? 40,
    maxWeeklyMiles: num(p.maxWeeklyMiles) ?? null,
    baseLongRunPoolMiles: num(p.baseLongRunPoolMiles) ?? 0,
    peakLongRunPoolMiles: num(p.peakLongRunPoolMiles) ?? 0,
    taperLongRunPoolMiles: num(p.taperLongRunPoolMiles) ?? 0,
    tempoIdealDow: num(p.tempoIdealDow) ?? 2,
    intervalIdealDow: num(p.intervalIdealDow) ?? 4,
    longRunDefaultDow: num(p.longRunDefaultDow) ?? 6,
    longRunConfigId: null,
    intervalsConfigId: null,
    tempoConfigId: null,
    easyConfigId: null,
    easyRunConfig: (p.easyRunConfig as Prisma.InputJsonValue) ?? undefined,
  };

  const { id: _createId, slug: _createSlug, ...updateData } = data;
  await prisma.training_plan_preset.upsert({
    where: { id },
    create: data,
    update: updateData,
  });

  return { presetId: id };
}
