export const dynamic = "force-dynamic";

import { assertPlanCatalogAuth } from "@/lib/training/plan-catalog-auth";
import { suggestGoals } from "@/lib/training/plan-goal-suggest";
import type { TrainingPlanGoalType } from "@/lib/training/goal-type-map";
import { NextRequest, NextResponse } from "next/server";

function parseGoalType(v: string | null): TrainingPlanGoalType | null {
  if (v === "RACE" || v === "GENERAL_FITNESS" || v === "MORE_ENDURANCE") return v;
  return null;
}

export async function GET(request: NextRequest) {
  const authError = await assertPlanCatalogAuth(request);
  if (authError) return authError;

  const sp = request.nextUrl.searchParams;
  const weeksRaw = sp.get("planDurationWeeks");
  const planDurationWeeks =
    weeksRaw != null && Number.isFinite(Number(weeksRaw)) ? Number(weeksRaw) : null;

  const result = await suggestGoals({
    personaSlug: sp.get("personaSlug"),
    personaId: sp.get("personaId"),
    targetDistanceLabel: sp.get("targetDistanceLabel"),
    planDurationWeeks,
    goalType: parseGoalType(sp.get("goalType")?.trim().toUpperCase() ?? null),
    suggestedSlug: sp.get("suggestedSlug"),
  });

  return NextResponse.json({ success: true, result });
}
