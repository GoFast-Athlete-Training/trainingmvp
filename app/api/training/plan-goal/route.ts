export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { assertPlanCatalogAuth } from "@/lib/training/plan-catalog-auth";
import { serializePlanGoal } from "@/lib/training/plan-entity-serialize";
import { NextRequest, NextResponse } from "next/server";

/** Stub catalog — list/read goals stored on Training Manage (post prod copy). */
export async function GET(request: NextRequest) {
  const authError = await assertPlanCatalogAuth(request);
  if (authError) return authError;

  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (slug) {
    const row = await prisma.training_plan_goal.findUnique({
      where: { slug },
      include: { persona: true },
    });
    if (!row) {
      return NextResponse.json({ success: true, goal: null, matched: false });
    }
    return NextResponse.json({
      success: true,
      goal: serializePlanGoal(row),
      matched: true,
    });
  }

  const personaId = request.nextUrl.searchParams.get("personaId")?.trim();
  const all = request.nextUrl.searchParams.get("all") === "1";

  const goals = await prisma.training_plan_goal.findMany({
    where: personaId ? { personaId } : undefined,
    orderBy: { updatedAt: "desc" },
    ...(all ? {} : { take: 200 }),
    include: { persona: true },
  });

  return NextResponse.json({
    success: true,
    goals: goals.map(serializePlanGoal),
  });
}

export async function PATCH(request: NextRequest) {
  const authError = await assertPlanCatalogAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const existing = await prisma.training_plan_goal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "goal not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if ("fitnessDelta" in body) {
      data.fitnessDelta =
        body.fitnessDelta == null
          ? null
          : typeof body.fitnessDelta === "string"
            ? body.fitnessDelta.toUpperCase()
            : null;
    }
    if ("progressionAggressiveness" in body) {
      data.progressionAggressiveness =
        body.progressionAggressiveness == null
          ? null
          : typeof body.progressionAggressiveness === "string"
            ? body.progressionAggressiveness.toUpperCase()
            : null;
    }
    if ("intensityReasoning" in body) {
      data.intensityReasoning =
        typeof body.intensityReasoning === "string" ? body.intensityReasoning.trim() : null;
    }
    if ("planDurationWeeks" in body && typeof body.planDurationWeeks === "number") {
      data.planDurationWeeks = Math.max(1, Math.round(body.planDurationWeeks));
    }

    const row = await prisma.training_plan_goal.update({
      where: { id },
      data,
      include: { persona: true },
    });

    return NextResponse.json({ success: true, goal: serializePlanGoal(row) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Goal create is not enabled — copy catalog from prod on Training Manage.",
    },
    { status: 501 },
  );
}
