export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { serializeCatalogueWorkout } from "@/lib/training/catalogue-serialize";
import {
  catalogueDataToPrismaWrite,
  parseCatalogueBody,
} from "@/lib/training/catalogue-prisma-write";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const workoutType = request.nextUrl.searchParams.get("workoutType")?.trim();
  const items = await prisma.workout_catalogue.findMany({
    where: workoutType
      ? { workoutType: workoutType as import("@prisma/client").WorkoutType }
      : undefined,
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

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseCatalogueBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  }

  try {
    const row = await prisma.workout_catalogue.create({
      data: catalogueDataToPrismaWrite(parsed.data),
    });
    return NextResponse.json({ success: true, item: serializeCatalogueWorkout(row) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
