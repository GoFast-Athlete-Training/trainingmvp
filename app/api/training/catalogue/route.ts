export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const items = await prisma.workout_catalogue.findMany({
    orderBy: [{ workoutType: "asc" }, { name: "asc" }],
    select: { id: true, name: true, workoutType: true, runSubType: true },
  });

  return NextResponse.json({ success: true, items });
}
