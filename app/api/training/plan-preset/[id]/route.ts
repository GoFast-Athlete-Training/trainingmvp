export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { mergeCoachPlanOverviewForCore } from "@/lib/training/preset-core";
import { serializeBuildPreset } from "@/lib/training/preset-serialize";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const row = await prisma.training_plan_preset.findUnique({
    where: { id },
    include: {
      longRunConfig: { include: { positions: { orderBy: { cyclePosition: "asc" } } } },
      easyConfig: true,
      tempoConfig: true,
      intervalsConfig: true,
    },
  });

  if (!row) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, preset: serializeBuildPreset(row) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const existing = await prisma.training_plan_preset.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.minWeeklyMiles === "number") data.minWeeklyMiles = Math.round(body.minWeeklyMiles);
  if (typeof body.maxWeeklyMiles === "number") data.maxWeeklyMiles = Math.round(body.maxWeeklyMiles);

  const presetCore = body.presetCore;
  if (presetCore != null && typeof presetCore === "object" && !Array.isArray(presetCore)) {
    const pc = presetCore as Record<string, unknown>;
    const merged = mergeCoachPlanOverviewForCore(existing.coachPlanOverview, {
      longRunPeakMiles:
        pc.longRunPeakMiles === null
          ? null
          : typeof pc.longRunPeakMiles === "number"
            ? pc.longRunPeakMiles
            : undefined,
      weeklyVolumePeakMiles:
        typeof pc.weeklyVolumePeakMiles === "number"
          ? Math.round(pc.weeklyVolumePeakMiles)
          : undefined,
      totalRunsPerWeek:
        typeof pc.totalRunsPerWeek === "number" ? Math.round(pc.totalRunsPerWeek) : undefined,
      totalQualitySessionsPerWeek:
        typeof pc.totalQualitySessionsPerWeek === "number"
          ? Math.round(pc.totalQualitySessionsPerWeek)
          : undefined,
    });
    data.coachPlanOverview = merged as Prisma.InputJsonValue;
    if (typeof pc.weeklyVolumePeakMiles === "number") {
      data.maxWeeklyMiles = Math.round(pc.weeklyVolumePeakMiles);
    }
  }
  if (body.longRunConfigId === null) data.longRunConfigId = null;
  if (typeof body.longRunConfigId === "string") data.longRunConfigId = body.longRunConfigId;
  if (body.easyConfigId === null) data.easyConfigId = null;
  if (typeof body.easyConfigId === "string") data.easyConfigId = body.easyConfigId;
  if (body.tempoConfigId === null) data.tempoConfigId = null;
  if (typeof body.tempoConfigId === "string") data.tempoConfigId = body.tempoConfigId;
  if (body.intervalsConfigId === null) data.intervalsConfigId = null;
  if (typeof body.intervalsConfigId === "string") data.intervalsConfigId = body.intervalsConfigId;

  const row = await prisma.training_plan_preset.update({
    where: { id },
    data,
    include: {
      longRunConfig: { include: { positions: { orderBy: { cyclePosition: "asc" } } } },
      easyConfig: true,
      tempoConfig: true,
      intervalsConfig: true,
    },
  });

  return NextResponse.json({ success: true, preset: serializeBuildPreset(row) });
}
