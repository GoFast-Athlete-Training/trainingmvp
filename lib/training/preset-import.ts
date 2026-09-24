import { prisma } from "@/lib/prisma";
import type { Prisma, WorkoutType } from "@prisma/client";

/** Product preset export shape from gofastapp-mvp plan-preset API. */
export type ProductPresetImportPayload = {
  preset: Record<string, unknown>;
};

type Tx = Prisma.TransactionClient;

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function int(v: unknown, fallback: number): number {
  const n = num(v);
  return n != null ? Math.round(n) : fallback;
}

function record(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function catalogueFromPosition(pos: Record<string, unknown>): Record<string, unknown> | null {
  return record(pos.workout_catalogue) ?? record(pos.workoutCatalogue);
}

async function uniqueSlug(
  tx: Tx,
  model: "training_plan_persona" | "training_plan_goal" | "training_plan_preset" | "workout_catalogue",
  id: string,
  slug: string,
): Promise<string> {
  async function findBySlug(candidate: string) {
    const q = { where: { slug: candidate }, select: { id: true } } as const;
    switch (model) {
      case "training_plan_persona":
        return tx.training_plan_persona.findUnique(q);
      case "training_plan_goal":
        return tx.training_plan_goal.findUnique(q);
      case "training_plan_preset":
        return tx.training_plan_preset.findUnique(q);
      case "workout_catalogue":
        return tx.workout_catalogue.findUnique(q);
    }
  }

  let candidate = slug;
  let n = 0;
  while (true) {
    const clash = await findBySlug(candidate);
    if (!clash || clash.id === id) return candidate;
    n += 1;
    candidate = n === 1 ? `${slug}-import` : `${slug}-import-${n}`;
  }
}

function workoutCatalogueScalars(raw: Record<string, unknown>, slug: string | null) {
  const workoutType = raw.workoutType as WorkoutType;
  if (!workoutType) {
    throw new Error("workout_catalogue.workoutType is required");
  }
  const trainingIntent = Array.isArray(raw.trainingIntent)
    ? raw.trainingIntent.filter((x): x is string => typeof x === "string")
    : [];

  return {
    name: str(raw.name) ?? "Workout",
    runSubType: str(raw.runSubType) ?? null,
    slug,
    description: str(raw.description) ?? null,
    workoutType,
    segmentPaceDist: (raw.segmentPaceDist as Prisma.InputJsonValue) ?? undefined,
    warmupFraction: num(raw.warmupFraction) ?? null,
    workFraction: num(raw.workFraction) ?? null,
    cooldownFraction: num(raw.cooldownFraction) ?? null,
    workBaseReps: num(raw.workBaseReps) ?? null,
    workBaseRepMeters: num(raw.workBaseRepMeters) ?? null,
    recoveryDistanceMeters: num(raw.recoveryDistanceMeters) ?? null,
    recoveryDurationSeconds: num(raw.recoveryDurationSeconds) ?? null,
    warmupMiles: num(raw.warmupMiles) ?? null,
    warmupPaceOffsetSecPerMile: num(raw.warmupPaceOffsetSecPerMile) ?? null,
    cooldownMiles: num(raw.cooldownMiles) ?? null,
    cooldownPaceOffsetSecPerMile: num(raw.cooldownPaceOffsetSecPerMile) ?? null,
    workBaseMiles: num(raw.workBaseMiles) ?? null,
    workPaceOffsetSecPerMile: num(raw.workPaceOffsetSecPerMile) ?? null,
    workBasePaceOffsetSecPerMile: num(raw.workBasePaceOffsetSecPerMile) ?? null,
    recoveryPaceOffsetSecPerMile: num(raw.recoveryPaceOffsetSecPerMile) ?? null,
    paceAnchor: str(raw.paceAnchor) ?? "currentBuildup",
    mpFraction: num(raw.mpFraction) ?? null,
    mpBlockPosition: str(raw.mpBlockPosition) ?? null,
    mpBlockProgression: str(raw.mpBlockProgression) ?? "flat",
    mpTotalMiles: num(raw.mpTotalMiles) ?? null,
    mpPaceOffsetSecPerMile: num(raw.mpPaceOffsetSecPerMile) ?? null,
    intendedHeartRateZone: str(raw.intendedHeartRateZone) ?? null,
    intendedHRBpmLow: num(raw.intendedHRBpmLow) ?? null,
    intendedHRBpmHigh: num(raw.intendedHRBpmHigh) ?? null,
    notes: str(raw.notes) ?? null,
    trainingIntent,
  };
}

async function upsertWorkoutCatalogue(tx: Tx, raw: Record<string, unknown>): Promise<string | null> {
  const id = str(raw.id);
  if (!id) return null;
  const baseSlug = str(raw.slug);
  let slug: string | null = baseSlug ?? null;
  if (slug) {
    slug = await uniqueSlug(tx, "workout_catalogue", id, slug);
  }
  const scalars = workoutCatalogueScalars(raw, slug);
  await tx.workout_catalogue.upsert({
    where: { id },
    create: { id, ...scalars },
    update: scalars,
  });
  return id;
}

async function upsertPersona(tx: Tx, raw: Record<string, unknown>): Promise<string | null> {
  const id = str(raw.id);
  const title = str(raw.title);
  const slugIn = str(raw.slug);
  if (!id || !title || !slugIn) return null;

  const slug = await uniqueSlug(tx, "training_plan_persona", id, slugIn);
  const data = {
    slug,
    title,
    capability:
      (raw.capability as Prisma.training_plan_personaUncheckedCreateInput["capability"]) ?? null,
    dedication:
      (raw.dedication as Prisma.training_plan_personaUncheckedCreateInput["dedication"]) ?? null,
    personaGoalLabel: str(raw.personaGoalLabel) ?? null,
    workoutFrequencyCap: num(raw.workoutFrequencyCap) ?? null,
    intentSummary: str(raw.intentSummary) ?? null,
    runningHistory: str(raw.runningHistory) ?? null,
    runningHistorySummary: str(raw.runningHistorySummary) ?? null,
    currentCapability: str(raw.currentCapability) ?? null,
    currentCapabilitySummary: str(raw.currentCapabilitySummary) ?? null,
    injuryAssessment: str(raw.injuryAssessment) ?? null,
    injuryAssessmentSummary: str(raw.injuryAssessmentSummary) ?? null,
    dedicationText: str(raw.dedicationText) ?? null,
    dedicationSummary: str(raw.dedicationSummary) ?? null,
    abilityToTrain: str(raw.abilityToTrain) ?? null,
    abilityToTrainSummary: str(raw.abilityToTrainSummary) ?? null,
    estimated5kTimeSeconds: num(raw.estimated5kTimeSeconds) ?? null,
    estimated5kPerformanceSummary: str(raw.estimated5kPerformanceSummary) ?? null,
    estimated5kPerformanceRationale: str(raw.estimated5kPerformanceRationale) ?? null,
    athletePersonaSummary: str(raw.athletePersonaSummary) ?? null,
  };

  await tx.training_plan_persona.upsert({
    where: { id },
    create: { id, ...data },
    update: data,
  });
  return id;
}

async function upsertGoal(tx: Tx, raw: Record<string, unknown>, personaId: string): Promise<string | null> {
  const id = str(raw.id);
  const slugIn = str(raw.slug);
  if (!id || !slugIn) return null;

  const slug = await uniqueSlug(tx, "training_plan_goal", id, slugIn);
  const data = {
    slug,
    personaId: str(raw.personaId) ?? personaId,
    targetDistanceLabel: str(raw.targetDistanceLabel) ?? null,
    objectiveOfPlan: str(raw.objectiveOfPlan) ?? null,
    planDurationWeeks: int(raw.planDurationWeeks, 12),
    timeHorizonLabel: str(raw.timeHorizonLabel) ?? null,
    fitnessDelta: (raw.fitnessDelta as Prisma.training_plan_goalUncheckedCreateInput["fitnessDelta"]) ?? null,
    progressionAggressiveness:
      (raw.progressionAggressiveness as Prisma.training_plan_goalUncheckedCreateInput["progressionAggressiveness"]) ??
      null,
    intensityReasoning: str(raw.intensityReasoning) ?? null,
    goalKind: (raw.goalKind as Prisma.training_plan_goalUncheckedCreateInput["goalKind"]) ?? null,
    goalType: (raw.goalType as Prisma.training_plan_goalUncheckedCreateInput["goalType"]) ?? null,
    coachIntent: str(raw.coachIntent) ?? null,
  };

  await tx.training_plan_goal.upsert({
    where: { id },
    create: { id, ...data },
    update: data,
  });
  return id;
}

type RotationKind = "longRun" | "intervals" | "tempo" | "easy";

async function upsertLongRunConfig(tx: Tx, raw: Record<string, unknown>): Promise<string | null> {
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;

  await tx.long_run_config.upsert({
    where: { id },
    create: { id, name, description: str(raw.description) ?? null },
    update: { name, description: str(raw.description) ?? null },
  });

  const positions = Array.isArray(raw.positions) ? raw.positions : [];
  for (const item of positions) {
    const pos = record(item);
    if (!pos) continue;
    const posId = str(pos.id);
    if (!posId) continue;
    const catRaw = catalogueFromPosition(pos);
    const catalogueWorkoutId = catRaw ? await upsertWorkoutCatalogue(tx, catRaw) : null;
    const cyclePosition = int(pos.cyclePosition, 0);
    const distributionWeight = num(pos.distributionWeight) ?? 0.25;
    await tx.long_run_config_position.upsert({
      where: { id: posId },
      create: {
        id: posId,
        longRunConfigId: id,
        cyclePosition,
        distributionWeight,
        catalogueWorkoutId,
      },
      update: { cyclePosition, distributionWeight, catalogueWorkoutId },
    });
  }
  return id;
}

async function upsertIntervalsConfig(tx: Tx, raw: Record<string, unknown>): Promise<string | null> {
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;

  await tx.intervals_config.upsert({
    where: { id },
    create: { id, name, description: str(raw.description) ?? null },
    update: { name, description: str(raw.description) ?? null },
  });

  const positions = Array.isArray(raw.positions) ? raw.positions : [];
  for (const item of positions) {
    const pos = record(item);
    if (!pos) continue;
    const posId = str(pos.id);
    if (!posId) continue;
    const catRaw = catalogueFromPosition(pos);
    const catalogueWorkoutId = catRaw ? await upsertWorkoutCatalogue(tx, catRaw) : null;
    await tx.intervals_config_position.upsert({
      where: { id: posId },
      create: {
        id: posId,
        intervalsConfigId: id,
        cyclePosition: int(pos.cyclePosition, 0),
        distributionWeight: num(pos.distributionWeight) ?? 0.25,
        catalogueWorkoutId,
      },
      update: {
        cyclePosition: int(pos.cyclePosition, 0),
        distributionWeight: num(pos.distributionWeight) ?? 0.25,
        catalogueWorkoutId,
      },
    });
  }
  return id;
}

async function upsertTempoConfig(tx: Tx, raw: Record<string, unknown>): Promise<string | null> {
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;

  await tx.tempo_config.upsert({
    where: { id },
    create: { id, name, description: str(raw.description) ?? null },
    update: { name, description: str(raw.description) ?? null },
  });

  const positions = Array.isArray(raw.positions) ? raw.positions : [];
  for (const item of positions) {
    const pos = record(item);
    if (!pos) continue;
    const posId = str(pos.id);
    if (!posId) continue;
    const catRaw = catalogueFromPosition(pos);
    const catalogueWorkoutId = catRaw ? await upsertWorkoutCatalogue(tx, catRaw) : null;
    await tx.tempo_config_position.upsert({
      where: { id: posId },
      create: {
        id: posId,
        tempoConfigId: id,
        cyclePosition: int(pos.cyclePosition, 0),
        distributionWeight: num(pos.distributionWeight) ?? 0.25,
        catalogueWorkoutId,
      },
      update: {
        cyclePosition: int(pos.cyclePosition, 0),
        distributionWeight: num(pos.distributionWeight) ?? 0.25,
        catalogueWorkoutId,
      },
    });
  }
  return id;
}

async function upsertEasyConfig(tx: Tx, raw: Record<string, unknown>): Promise<string | null> {
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;

  await tx.easy_config.upsert({
    where: { id },
    create: { id, name, description: str(raw.description) ?? null },
    update: { name, description: str(raw.description) ?? null },
  });

  const positions = Array.isArray(raw.positions) ? raw.positions : [];
  for (const item of positions) {
    const pos = record(item);
    if (!pos) continue;
    const posId = str(pos.id);
    if (!posId) continue;
    const catRaw = catalogueFromPosition(pos);
    const catalogueWorkoutId = catRaw ? await upsertWorkoutCatalogue(tx, catRaw) : null;
    await tx.easy_config_position.upsert({
      where: { id: posId },
      create: {
        id: posId,
        easyConfigId: id,
        cyclePosition: int(pos.cyclePosition, 0),
        distributionWeight: num(pos.distributionWeight) ?? 0.25,
        catalogueWorkoutId,
      },
      update: {
        cyclePosition: int(pos.cyclePosition, 0),
        distributionWeight: num(pos.distributionWeight) ?? 0.25,
        catalogueWorkoutId,
      },
    });
  }
  return id;
}

function configFromPreset(p: Record<string, unknown>, kind: RotationKind): Record<string, unknown> | null {
  const keys: Record<RotationKind, string[]> = {
    longRun: ["longRunConfig", "long_run_config"],
    intervals: ["intervalsConfig", "intervals_config"],
    tempo: ["tempoConfig", "tempo_config"],
    easy: ["easyConfig", "easy_config"],
  };
  for (const key of keys[kind]) {
    const r = record(p[key]);
    if (r) return r;
  }
  return null;
}

async function importGraph(tx: Tx, p: Record<string, unknown>) {
  let personaId: string | null = str(p.personaId) ?? null;
  const personaRaw = record(p.persona);
  if (personaRaw) {
    personaId = (await upsertPersona(tx, personaRaw)) ?? personaId;
  }

  let goalId: string | null = str(p.goalId) ?? null;
  const goalRaw = record(p.goal);
  if (goalRaw && personaId) {
    goalId = (await upsertGoal(tx, goalRaw, personaId)) ?? goalId;
  }

  const longRunNested = configFromPreset(p, "longRun");
  const intervalsNested = configFromPreset(p, "intervals");
  const tempoNested = configFromPreset(p, "tempo");
  const easyNested = configFromPreset(p, "easy");

  const longRunConfigId = longRunNested ? await upsertLongRunConfig(tx, longRunNested) : null;
  const intervalsConfigId = intervalsNested ? await upsertIntervalsConfig(tx, intervalsNested) : null;
  const tempoConfigId = tempoNested ? await upsertTempoConfig(tx, tempoNested) : null;
  const easyConfigId = easyNested ? await upsertEasyConfig(tx, easyNested) : null;

  const id = str(p.id)!;
  const title = str(p.title)!;
  let slug = str(p.slug)!;

  const existingPreset = await tx.training_plan_preset.findUnique({ where: { id }, select: { slug: true } });
  if (existingPreset) {
    const clash = await tx.training_plan_preset.findUnique({ where: { slug }, select: { id: true } });
    if (clash && clash.id !== id) {
      slug = existingPreset.slug;
    }
  } else {
    slug = await uniqueSlug(tx, "training_plan_preset", id, slug);
  }

  const data: Prisma.training_plan_presetUncheckedCreateInput = {
    id,
    slug,
    title,
    description: str(p.description) ?? null,
    publicDescription: str(p.publicDescription) ?? null,
    targetDistanceLabel: str(p.targetDistanceLabel) ?? null,
    personaId,
    goalId,
    coachIntent: str(p.coachIntent) ?? null,
    objectiveOfPlan: str(p.objectiveOfPlan) ?? null,
    athletePersonaCapability:
      (p.athletePersonaCapability as Prisma.training_plan_presetUncheckedCreateInput["athletePersonaCapability"]) ??
      null,
    athletePersonaGoal: str(p.athletePersonaGoal) ?? null,
    athletePersonaDedication:
      (p.athletePersonaDedication as Prisma.training_plan_presetUncheckedCreateInput["athletePersonaDedication"]) ??
      null,
    coachPlanOverview: (p.coachPlanOverview as Prisma.InputJsonValue) ?? undefined,
    workoutStructure: (p.workoutStructure as Prisma.InputJsonValue) ?? undefined,
    longRunCycleWeeks: num(p.longRunCycleWeeks) ?? 4,
    minWeeklyMiles: num(p.minWeeklyMiles) ?? 40,
    maxWeeklyMiles: num(p.maxWeeklyMiles) ?? null,
    tempoIdealDow: num(p.tempoIdealDow) ?? 2,
    intervalIdealDow: num(p.intervalIdealDow) ?? 4,
    longRunDefaultDow: num(p.longRunDefaultDow) ?? 6,
    longRunConfigId: null,
    intervalsConfigId,
    tempoConfigId,
    easyConfigId,
    easyRunConfig: (p.easyRunConfig as Prisma.InputJsonValue) ?? undefined,
  };

  const { id: _createId, slug: _createSlug, ...updateData } = data;
  await tx.training_plan_preset.upsert({
    where: { id },
    create: data,
    update: updateData,
  });

  const { syncPhaseRowsFromPlanPreset } = await import("@/lib/training/sync-plan-phase-rows");
  await syncPhaseRowsFromPlanPreset(tx, id);
}

export async function importBuildPreset(payload: ProductPresetImportPayload): Promise<{ presetId: string }> {
  const p = payload.preset;
  const id = str(p.id);
  const title = str(p.title);
  const slug = str(p.slug);
  if (!id || !title || !slug) {
    throw new Error("preset.id, preset.title, and preset.slug are required");
  }

  await prisma.$transaction(async (tx) => {
    await importGraph(tx, p);
  });

  return { presetId: id };
}
