import type { PlanGoalApi, PlanPersonaApi } from "@/lib/training/plan-entity-serialize";

/** Training Manage no longer mirrors persona/goal rows locally. */
export async function importPlanCatalogFromProd(_opts: {
  personas: PlanPersonaApi[];
  goals: PlanGoalApi[];
}): Promise<{ personas: number; goals: number }> {
  return { personas: 0, goals: 0 };
}
