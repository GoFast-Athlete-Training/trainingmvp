export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { mergeCoachPlanOverviewForCore } from "@/lib/training/preset-core";
import { serializeBuildPreset } from "@/lib/training/preset-serialize";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

const presetLinkInclude = {
  longRunConfig: { include: { positions: { orderBy: { cyclePosition: "asc" as const } } } },
  easyConfig: true,
  tempoConfig: true,
  intervalsConfig: true,
  buildConfig: { select: { id: true, name: true } },
  taperConfig: { select: { id: true, name: true } },
  raceWeekPreset: { select: { id: true, title: true } },
} as const;

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const row = await prisma.training_plan_preset.findUnique({
    where: { id },
    include: presetLinkInclude,
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

  if ("buildConfigId" in body) {
    if (typeof body.buildConfigId !== "string" || !body.buildConfigId) {
      data.buildConfigId = null;
      data.snapPeakLongRunMiles = null;
      data.snapPeakWeeklyMiles = null;
    } else {
      const build = await prisma.build_config.findUnique({ where: { id: body.buildConfigId } });
      if (!build) {
        return NextResponse.json({ success: false, error: "Build not found" }, { status: 404 });
      }
      data.buildConfigId = build.id;
      data.snapPeakLongRunMiles = build.peakLongRunMiles;
      data.snapPeakWeeklyMiles = build.peakWeeklyMiles;
    }
  }

  if ("taperConfigId" in body) {
    if (typeof body.taperConfigId !== "string" || !body.taperConfigId) {
      data.taperConfigId = null;
      data.snapTaperWeek1TotalMiles = null;
      data.snapTaperWeek1LongRunMiles = null;
      data.snapTaperWeek2TotalMiles = null;
      data.snapTaperWeek2LongRunMiles = null;
    } else {
      const taper = await prisma.taper_config.findUnique({ where: { id: body.taperConfigId } });
      if (!taper) {
        return NextResponse.json({ success: false, error: "Taper not found" }, { status: 404 });
      }
      data.taperConfigId = taper.id;
      data.snapTaperWeek1TotalMiles = taper.week1TotalMiles;
      data.snapTaperWeek1LongRunMiles = taper.week1LongRunMiles;
      data.snapTaperWeek2TotalMiles = taper.week2TotalMiles;
      data.snapTaperWeek2LongRunMiles = taper.week2LongRunMiles;
    }
  }

  if ("raceWeekPresetId" in body) {
    if (typeof body.raceWeekPresetId !== "string" || !body.raceWeekPresetId) {
      data.raceWeekPresetId = null;
    } else {
      const raceWeek = await prisma.race_week_preset.findUnique({
        where: { id: body.raceWeekPresetId },
      });
      if (!raceWeek) {
        return NextResponse.json({ success: false, error: "Race week not found" }, { status: 404 });
      }
      data.raceWeekPresetId = raceWeek.id;
    }
  }

  const row = await prisma.training_plan_preset.update({
    where: { id },
    data,
    include: presetLinkInclude,
  });

  return NextResponse.json({ success: true, preset: serializeBuildPreset(row) });
}
