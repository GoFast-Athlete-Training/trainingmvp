export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { parseCatalogueDescriptionWithAi } from "@/lib/training/catalogue-ai-parse";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    description?: string;
    workoutType?: string;
  };
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) {
    return NextResponse.json({ success: false, error: "Description is required" }, { status: 400 });
  }

  try {
    const wt = body.workoutType;
    const forceType =
      wt === "LongRun" || wt === "Easy" || wt === "Tempo" || wt === "Intervals" || wt === "Race"
        ? wt
        : undefined;
    const fields = await parseCatalogueDescriptionWithAi(
      description,
      forceType ? { forceWorkoutType: forceType } : undefined,
    );
    return NextResponse.json({ success: true, fields });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI parse failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
