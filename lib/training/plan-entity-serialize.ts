import {
  prismaKindToGoalType,
  type TrainingPlanGoalKind,
  type TrainingPlanGoalType,
} from "@/lib/training/goal-type-map";

export type AthletePersonaCapability =
  | "NON_RUNNER"
  | "BEGINNER"
  | "RECREATIONAL"
  | "COMPETITIVE"
  | "ELITE";

export type PlanPersonaApi = {
  id: string;
  slug: string;
  title: string;
  capability: AthletePersonaCapability | null;
  dedication: string | null;
  personaGoalLabel: string | null;
  athletePersonaGoal: string | null;
  workoutFrequencyCap: number | null;
  intentSummary: string | null;
  athletePersonaSummary: string | null;
  runningHistory: string | null;
  runningHistorySummary: string | null;
  currentCapability: string | null;
  currentCapabilitySummary: string | null;
  injuryAssessment: string | null;
  injuryAssessmentSummary: string | null;
  dedicationText: string | null;
  dedicationSummary: string | null;
  abilityToTrain: string | null;
  abilityToTrainSummary: string | null;
  estimated5kTimeSeconds: number | null;
  estimated5kPerformanceSummary: string | null;
  estimated5kPerformanceRationale: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlanGoalApi = {
  id: string;
  slug: string;
  personaId: string;
  targetDistanceLabel: string | null;
  objectiveOfPlan: string | null;
  planDurationWeeks: number;
  timeHorizonLabel: string | null;
  fitnessDelta: string | null;
  progressionAggressiveness: string | null;
  intensityReasoning: string | null;
  goalKind: TrainingPlanGoalKind | null;
  goalType: TrainingPlanGoalType | null;
  coachIntent: string | null;
  createdAt: string;
  updatedAt: string;
  persona?: PlanPersonaApi | null;
};

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return value;
  return new Date(0).toISOString();
}

type PersonaRow = Record<string, unknown> & Partial<PlanPersonaApi>;
type GoalRow = Record<string, unknown> & Partial<PlanGoalApi> & { persona?: PersonaRow | null };

export function serializePlanPersona(row: PersonaRow): PlanPersonaApi {
  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    capability: (row.capability as AthletePersonaCapability | null) ?? null,
    dedication: (row.dedication as string | null) ?? null,
    personaGoalLabel: (row.personaGoalLabel as string | null) ?? null,
    athletePersonaGoal: (row.personaGoalLabel as string | null) ?? (row.athletePersonaGoal as string | null),
    workoutFrequencyCap: (row.workoutFrequencyCap as number | null) ?? null,
    intentSummary: (row.intentSummary as string | null) ?? null,
    athletePersonaSummary: (row.athletePersonaSummary as string | null) ?? (row.intentSummary as string | null),
    runningHistory: (row.runningHistory as string | null) ?? null,
    runningHistorySummary: (row.runningHistorySummary as string | null) ?? null,
    currentCapability: (row.currentCapability as string | null) ?? null,
    currentCapabilitySummary: (row.currentCapabilitySummary as string | null) ?? null,
    injuryAssessment: (row.injuryAssessment as string | null) ?? null,
    injuryAssessmentSummary: (row.injuryAssessmentSummary as string | null) ?? null,
    dedicationText: (row.dedicationText as string | null) ?? null,
    dedicationSummary: (row.dedicationSummary as string | null) ?? null,
    abilityToTrain: (row.abilityToTrain as string | null) ?? null,
    abilityToTrainSummary: (row.abilityToTrainSummary as string | null) ?? null,
    estimated5kTimeSeconds: (row.estimated5kTimeSeconds as number | null) ?? null,
    estimated5kPerformanceSummary: (row.estimated5kPerformanceSummary as string | null) ?? null,
    estimated5kPerformanceRationale: (row.estimated5kPerformanceRationale as string | null) ?? null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export function serializePlanGoal(row: GoalRow): PlanGoalApi {
  const goalKind = (row.goalKind as TrainingPlanGoalKind | null) ?? null;
  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    personaId: String(row.personaId ?? ""),
    targetDistanceLabel: (row.targetDistanceLabel as string | null) ?? null,
    objectiveOfPlan: (row.objectiveOfPlan as string | null) ?? null,
    planDurationWeeks: Number(row.planDurationWeeks ?? 0),
    timeHorizonLabel: (row.timeHorizonLabel as string | null) ?? null,
    fitnessDelta: (row.fitnessDelta as string | null) ?? null,
    progressionAggressiveness: (row.progressionAggressiveness as string | null) ?? null,
    intensityReasoning: (row.intensityReasoning as string | null) ?? null,
    goalKind,
    goalType: prismaKindToGoalType(goalKind, row.goalType as string | null),
    coachIntent: (row.coachIntent as string | null) ?? null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    persona: row.persona ? serializePlanPersona(row.persona) : undefined,
  };
}
