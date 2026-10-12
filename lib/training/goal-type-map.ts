import type { TrainingPlanGoalKind } from "@prisma/client";

export type TrainingPlanGoalType = "RACE" | "GENERAL_FITNESS" | "MORE_ENDURANCE";

export function goalTypeToPrismaKind(
  goalType: TrainingPlanGoalType | null | undefined,
): TrainingPlanGoalKind | null {
  if (!goalType) return null;
  if (goalType === "RACE") return "RACE";
  return "TRAINING_BLOCK";
}

export function prismaKindToGoalType(
  kind: TrainingPlanGoalKind | null | undefined,
  goalTypeRaw?: string | null,
): TrainingPlanGoalType {
  if (goalTypeRaw === "GENERAL_FITNESS" || goalTypeRaw === "MORE_ENDURANCE") {
    return goalTypeRaw;
  }
  if (goalTypeRaw === "RACE") return "RACE";
  if (kind === "RACE") return "RACE";
  return "GENERAL_FITNESS";
}
