import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { PlanGoalApi, PlanPersonaApi } from "@/lib/training/plan-entity-serialize";
import { goalTypeToPrismaKind } from "@/lib/training/goal-type-map";

type Tx = Prisma.TransactionClient;

async function uniqueSlug(
  tx: Tx,
  model: "training_plan_persona" | "training_plan_goal",
  id: string,
  slug: string,
): Promise<string> {
  async function findBySlug(candidate: string) {
    if (model === "training_plan_persona") {
      return tx.training_plan_persona.findUnique({ where: { slug: candidate }, select: { id: true } });
    }
    return tx.training_plan_goal.findUnique({ where: { slug: candidate }, select: { id: true } });
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

async function upsertPersonaRow(tx: Tx, p: PlanPersonaApi): Promise<void> {
  const slug = await uniqueSlug(tx, "training_plan_persona", p.id, p.slug);
  const data = {
    slug,
    title: p.title,
    capability: p.capability,
    dedication: p.dedication,
    personaGoalLabel: p.personaGoalLabel ?? p.athletePersonaGoal,
    workoutFrequencyCap: p.workoutFrequencyCap,
    intentSummary: p.intentSummary,
    runningHistory: p.runningHistory,
    runningHistorySummary: p.runningHistorySummary,
    currentCapability: p.currentCapability,
    currentCapabilitySummary: p.currentCapabilitySummary,
    injuryAssessment: p.injuryAssessment,
    injuryAssessmentSummary: p.injuryAssessmentSummary,
    dedicationText: p.dedicationText,
    dedicationSummary: p.dedicationSummary,
    abilityToTrain: p.abilityToTrain,
    abilityToTrainSummary: p.abilityToTrainSummary,
    estimated5kTimeSeconds: p.estimated5kTimeSeconds,
    estimated5kPerformanceSummary: p.estimated5kPerformanceSummary,
    estimated5kPerformanceRationale: p.estimated5kPerformanceRationale,
    athletePersonaSummary: p.athletePersonaSummary,
  };

  await tx.training_plan_persona.upsert({
    where: { id: p.id },
    create: { id: p.id, ...data },
    update: data,
  });
}

async function upsertGoalRow(tx: Tx, g: PlanGoalApi): Promise<void> {
  const slug = await uniqueSlug(tx, "training_plan_goal", g.id, g.slug);
  const goalKind =
    g.goalKind ?? (g.goalType ? goalTypeToPrismaKind(g.goalType) : null);
  const goalType: Prisma.training_plan_goalUncheckedCreateInput["goalType"] =
    g.goalType === "RACE" || g.goalType === "GENERAL_FITNESS" || g.goalType === "MORE_ENDURANCE"
      ? g.goalType
      : null;

  const data: Prisma.training_plan_goalUncheckedCreateInput = {
    slug,
    personaId: g.personaId,
    targetDistanceLabel: g.targetDistanceLabel,
    objectiveOfPlan: g.objectiveOfPlan,
    planDurationWeeks: Math.max(1, Math.round(g.planDurationWeeks)),
    timeHorizonLabel: g.timeHorizonLabel,
    fitnessDelta: g.fitnessDelta,
    progressionAggressiveness: g.progressionAggressiveness,
    intensityReasoning: g.intensityReasoning,
    goalKind,
    goalType,
    coachIntent: g.coachIntent,
  };

  await tx.training_plan_goal.upsert({
    where: { id: g.id },
    create: { id: g.id, ...data },
    update: { ...data },
  });
}

export type PlanCatalogImportResult = {
  personasUpserted: number;
  goalsUpserted: number;
  skippedGoalsMissingPersona: number;
};

/** Preserve prod ids so preset personaId/goalId FKs stay valid after copy. */
export async function importPlanCatalogFromProd(opts: {
  personas: PlanPersonaApi[];
  goals: PlanGoalApi[];
}): Promise<PlanCatalogImportResult> {
  const personaIds = new Set(opts.personas.map((p) => p.id));
  let skippedGoalsMissingPersona = 0;

  await prisma.$transaction(async (tx) => {
    for (const p of opts.personas) {
      await upsertPersonaRow(tx, p);
    }
    for (const g of opts.goals) {
      if (!personaIds.has(g.personaId)) {
        const exists = await tx.training_plan_persona.findUnique({
          where: { id: g.personaId },
          select: { id: true },
        });
        if (!exists) {
          skippedGoalsMissingPersona += 1;
          continue;
        }
      }
      await upsertGoalRow(tx, g);
    }
  });

  return {
    personasUpserted: opts.personas.length,
    goalsUpserted: opts.goals.length - skippedGoalsMissingPersona,
    skippedGoalsMissingPersona,
  };
}
