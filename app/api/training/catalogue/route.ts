export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { serializeCatalogueWorkout } from "@/lib/training/catalogue-serialize";
import { prisma } from "@/lib/prisma";
import { WorkoutType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const WORKOUT_TYPES = new Set<string>(["LongRun", "Easy", "Tempo", "Intervals"]);

export async function GET(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const items = await prisma.workout_catalogue.findMany({
    orderBy: [{ workoutType: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    success: true,
    items: items.map(serializeCatalogueWorkout),
  });
}

export async function POST(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    workoutType?: string;
  };

  const name = body.name?.trim() || "New workout";
  const workoutTypeRaw = body.workoutType?.trim() || "Easy";
  if (!WORKOUT_TYPES.has(workoutTypeRaw)) {
    return NextResponse.json({ success: false, error: "Invalid workoutType" }, { status: 400 });
  }

  const row = await prisma.workout_catalogue.create({
    data: {
      name,
      workoutType: workoutTypeRaw as WorkoutType,
    },
  });

  return NextResponse.json({ success: true, item: serializeCatalogueWorkout(row) });
}
