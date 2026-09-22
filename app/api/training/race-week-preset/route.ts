export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { serializeRaceWeekPreset } from "@/lib/training/preset-serialize";
import { defaultRaceWeekSlots } from "@/lib/training/race-week-slots";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const rows = await prisma.race_week_preset.findMany({
    orderBy: { updatedAt: "desc" },
    include: { shakeoutRunConfig: true },
  });

  return NextResponse.json({
    success: true,
    presets: rows.map(serializeRaceWeekPreset),
  });
}

export async function POST(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    shakeoutRunConfigId?: string | null;
    shakeoutDaysPriorToRace?: number;
    slots?: unknown;
  };

  const row = await prisma.race_week_preset.create({
    data: {
      title: body.title?.trim() || "Marathon race week",
      shakeoutRunConfigId: body.shakeoutRunConfigId ?? null,
      shakeoutDaysPriorToRace: body.shakeoutDaysPriorToRace ?? 2,
      slots: body.slots ?? defaultRaceWeekSlots(),
    },
    include: { shakeoutRunConfig: true },
  });

  return NextResponse.json({ success: true, preset: serializeRaceWeekPreset(row) });
}
