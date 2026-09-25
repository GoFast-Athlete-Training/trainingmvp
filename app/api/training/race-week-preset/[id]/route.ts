export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { serializeRaceWeekPreset } from "@/lib/training/preset-serialize";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const row = await prisma.race_week_preset.findUnique({
    where: { id },
    include: { shakeoutRunConfig: true },
  });

  if (!row) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, preset: serializeRaceWeekPreset(row) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title.trim();
  if (body.shakeoutRunConfigId === null) data.shakeoutRunConfigId = null;
  if (typeof body.shakeoutRunConfigId === "string") data.shakeoutRunConfigId = body.shakeoutRunConfigId;
  if (typeof body.shakeoutDaysPriorToRace === "number") {
    data.shakeoutDaysPriorToRace = Math.round(body.shakeoutDaysPriorToRace);
  }
  if (body.slots !== undefined) data.slots = body.slots;
  if (body.weekPins !== undefined) data.weekPins = body.weekPins;

  const row = await prisma.race_week_preset.update({
    where: { id },
    data,
    include: { shakeoutRunConfig: true },
  });

  return NextResponse.json({ success: true, preset: serializeRaceWeekPreset(row) });
}
