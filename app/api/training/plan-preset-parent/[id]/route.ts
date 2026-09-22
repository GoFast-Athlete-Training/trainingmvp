export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { serializeParentPreset } from "@/lib/training/preset-serialize";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const row = await prisma.training_plan_preset_parent.findUnique({
    where: { id },
    include: {
      buildPreset: {
        include: {
          longRunConfig: { include: { positions: { orderBy: { cyclePosition: "asc" } } } },
        },
      },
      taperPreset: {
        include: {
          longRunConfig: { include: { positions: { orderBy: { cyclePosition: "asc" } } } },
        },
      },
      raceWeekPreset: { include: { shakeoutRunConfig: true } },
    },
  });

  if (!row) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, parent: serializeParentPreset(row) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.buildPresetId === "string") data.buildPresetId = body.buildPresetId;
  if (body.taperPresetId === null) data.taperPresetId = null;
  if (typeof body.taperPresetId === "string") data.taperPresetId = body.taperPresetId;
  if (body.raceWeekPresetId === null) data.raceWeekPresetId = null;
  if (typeof body.raceWeekPresetId === "string") data.raceWeekPresetId = body.raceWeekPresetId;
  if (typeof body.peakWeeklyMiles === "number") data.peakWeeklyMiles = Math.round(body.peakWeeklyMiles);
  if (typeof body.peakLongRunMiles === "number") data.peakLongRunMiles = body.peakLongRunMiles;
  if (typeof body.buildLongRunWeekends === "number") {
    data.buildLongRunWeekends = Math.round(body.buildLongRunWeekends);
  }

  const row = await prisma.training_plan_preset_parent.update({
    where: { id },
    data,
    include: {
      buildPreset: true,
      taperPreset: true,
      raceWeekPreset: { include: { shakeoutRunConfig: true } },
    },
  });

  return NextResponse.json({ success: true, parent: serializeParentPreset(row) });
}
