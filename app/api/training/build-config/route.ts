export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const include = {
  workouts: { include: { workout: { select: { id: true, name: true, workoutType: true } } } },
} as const;

export async function GET(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const rows = await prisma.build_config.findMany({ orderBy: { updatedAt: "desc" }, include });
  return NextResponse.json({ success: true, builds: rows });
}

export async function POST(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const row = await prisma.build_config.create({
    data: { name: body.name?.trim() || "New build" },
    include,
  });
  return NextResponse.json({ success: true, build: row });
}
