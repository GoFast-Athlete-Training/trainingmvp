export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { assertStaffForward } from "@/lib/staff-forward-auth";
import { prisma } from "@/lib/prisma";
import { serializeBuildPreset } from "@/lib/training/preset-serialize";
import { NextRequest, NextResponse } from "next/server";

async function assertListPresetAuth(request: NextRequest) {
  const forward = assertStaffForward(request);
  if (forward.ok) return null;
  const auth = await assertTrainingManagerAuth(request);
  return auth.error;
}

export async function GET(request: NextRequest) {
  const authError = await assertListPresetAuth(request);
  if (authError) return authError;

  const rows = await prisma.training_plan_preset.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      longRunConfig: { include: { positions: { orderBy: { cyclePosition: "asc" } } } },
      easyConfig: true,
      tempoConfig: true,
      intervalsConfig: true,
      buildPreset: { select: { id: true, name: true } },
      taperPreset: { select: { id: true, name: true } },
      raceWeekPreset: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json({
    success: true,
    presets: rows.map(serializeBuildPreset),
  });
}
