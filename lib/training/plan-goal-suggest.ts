import { fetchProdPlanGoals } from "@/lib/training/fetch-prod-plan-catalog";
import { buildGoalSlug, normalizeSlug } from "@/lib/training/plan-entity-slugs";
import { serializePlanGoal, type PlanGoalApi } from "@/lib/training/plan-entity-serialize";
import type { TrainingPlanGoalType } from "@/lib/training/goal-type-map";

export type GoalSuggestResult = {
  suggestedSlug: string;
  suggestedLabel: string;
  exactMatch: PlanGoalApi | null;
  similar: PlanGoalApi[];
};

export function buildSuggestedGoalLabel(opts: {
  targetDistanceLabel?: string | null;
  planDurationWeeks?: number | null;
  goalType?: TrainingPlanGoalType | null;
}): string {
  const dist = opts.targetDistanceLabel?.trim() || "General";
  const weeks = opts.planDurationWeeks ?? 12;
  const type =
    opts.goalType === "GENERAL_FITNESS"
      ? "fitness"
      : opts.goalType === "MORE_ENDURANCE"
        ? "endurance"
        : "race";
  return `${dist} · ${weeks}w ${type}`;
}

export async function suggestGoals(opts: {
  personaSlug?: string | null;
  personaId?: string | null;
  targetDistanceLabel?: string | null;
  planDurationWeeks?: number | null;
  goalType?: TrainingPlanGoalType | null;
  suggestedSlug?: string | null;
  authorization: string;
  staffId: string;
}): Promise<GoalSuggestResult> {
  const weeks = Math.max(1, Math.round(opts.planDurationWeeks ?? 12));
  const personaSlug = normalizeSlug(opts.personaSlug ?? "");
  const suggestedSlug =
    normalizeSlug(opts.suggestedSlug ?? "") ||
    (personaSlug ? buildGoalSlug(personaSlug, weeks) : "");

  const suggestedLabel = buildSuggestedGoalLabel({
    targetDistanceLabel: opts.targetDistanceLabel,
    planDurationWeeks: weeks,
    goalType: opts.goalType,
  });

  const goals = await fetchProdPlanGoals({
    authorization: opts.authorization,
    staffId: opts.staffId,
  });

  const exactRow = suggestedSlug ? goals.find((g) => g.slug === suggestedSlug) ?? null : null;
  const exactMatch = exactRow ? serializePlanGoal(exactRow) : null;

  const similarRows = goals
    .filter((g) => (exactRow ? g.id !== exactRow.id : true))
    .filter((g) => (opts.personaId ? g.personaId === opts.personaId : true))
    .slice(0, 5);

  return {
    suggestedSlug,
    suggestedLabel,
    exactMatch,
    similar: similarRows.map(serializePlanGoal),
  };
}
