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
  const row = await prisma.taper_config.findUnique({ where: { id }, include });
  if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, taper: row });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  for (const key of [
    "week1TotalMiles",
    "week1LongRunMiles",
    "week2TotalMiles",
    "week2LongRunMiles",
  ] as const) {
    const n = numOrNull(body[key]);
    if (n !== undefined) data[key] = n;
  }

  if (Array.isArray(body.catalogueWorkoutIds)) {
    const ids = body.catalogueWorkoutIds.filter((x): x is string => typeof x === "string");
    await prisma.taper_config_workout.deleteMany({ where: { taperConfigId: id } });
    if (ids.length) {
      await prisma.taper_config_workout.createMany({
        data: ids.map((catalogueWorkoutId) => ({ taperConfigId: id, catalogueWorkoutId })),
        skipDuplicates: true,
      });
    }
  }

  const row = await prisma.taper_config.update({ where: { id }, data, include });
  return NextResponse.json({ success: true, taper: row });
}
