export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

const include = {
  workouts: { include: { workout: { select: { id: true, name: true, workoutType: true } } } },
} as const;

function numOrNull(v: unknown): number | null | undefined {
  if (v === null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const row = await prisma.build_config.findUnique({ where: { id }, include });
  if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, build: row });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  const peakLong = numOrNull(body.peakLongRunMiles);
  const peakWeekly = numOrNull(body.peakWeeklyMiles);
  if (peakLong !== undefined) data.peakLongRunMiles = peakLong;
  if (peakWeekly !== undefined) data.peakWeeklyMiles = peakWeekly == null ? null : Math.round(peakWeekly);

  if (Array.isArray(body.catalogueWorkoutIds)) {
    const ids = body.catalogueWorkoutIds.filter((x): x is string => typeof x === "string");
    await prisma.build_config_workout.deleteMany({ where: { buildConfigId: id } });
    if (ids.length) {
      await prisma.build_config_workout.createMany({
        data: ids.map((catalogueWorkoutId) => ({ buildConfigId: id, catalogueWorkoutId })),
        skipDuplicates: true,
      });
    }
  }

  const row = await prisma.build_config.update({ where: { id }, data, include });
  return NextResponse.json({ success: true, build: row });
}
