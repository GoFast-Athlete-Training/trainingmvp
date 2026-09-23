export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { serializeCatalogueWorkout } from "@/lib/training/catalogue-serialize";
import { prisma } from "@/lib/prisma";
import { WorkoutType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

const WORKOUT_TYPES = new Set<string>(["LongRun", "Easy", "Tempo", "Intervals"]);

function numOrNull(v: unknown): number | null | undefined {
  if (v === null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

function intOrNull(v: unknown): number | null | undefined {
  const n = numOrNull(v);
  if (n === undefined) return undefined;
  if (n === null) return null;
  return Math.round(n);
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const row = await prisma.workout_catalogue.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, item: serializeCatalogueWorkout(row) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.description === "string") data.description = body.description.trim();
  if (body.description === null) data.description = null;
  if (typeof body.runSubType === "string") data.runSubType = body.runSubType.trim();
  if (body.runSubType === null) data.runSubType = null;
  if (typeof body.slug === "string") data.slug = body.slug.trim() || null;
  if (body.slug === null) data.slug = null;
  if (typeof body.workoutType === "string" && WORKOUT_TYPES.has(body.workoutType)) {
    data.workoutType = body.workoutType as WorkoutType;
  }
  if (typeof body.notes === "string") data.notes = body.notes.trim();
  if (body.notes === null) data.notes = null;
  if (typeof body.paceAnchor === "string") data.paceAnchor = body.paceAnchor.trim();

  for (const key of [
    "warmupMiles",
    "cooldownMiles",
    "workBaseMiles",
    "mpTotalMiles",
    "warmupFraction",
    "workFraction",
    "cooldownFraction",
    "mpFraction",
  ] as const) {
    const n = numOrNull(body[key]);
    if (n !== undefined) data[key] = n;
  }

  for (const key of [
    "workBaseReps",
    "workBaseRepMeters",
    "recoveryDistanceMeters",
    "recoveryDurationSeconds",
    "warmupPaceOffsetSecPerMile",
    "cooldownPaceOffsetSecPerMile",
    "workPaceOffsetSecPerMile",
    "workBasePaceOffsetSecPerMile",
    "recoveryPaceOffsetSecPerMile",
    "mpPaceOffsetSecPerMile",
    "intendedHRBpmLow",
    "intendedHRBpmHigh",
  ] as const) {
    const n = intOrNull(body[key]);
    if (n !== undefined) data[key] = n;
  }

  const row = await prisma.workout_catalogue.update({ where: { id }, data });
  return NextResponse.json({ success: true, item: serializeCatalogueWorkout(row) });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    await prisma.workout_catalogue.delete({ where: { id } });
  } catch {
    return NextResponse.json(
      { success: false, error: "Cannot delete — workout is referenced elsewhere" },
      { status: 409 },
    );
  }
  return NextResponse.json({ success: true });
}
