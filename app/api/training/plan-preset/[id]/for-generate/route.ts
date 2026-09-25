export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { loadPresetForGenerate } from "@/lib/training/preset-for-generate";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const payload = await loadPresetForGenerate(id);
  if (!payload) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  if (!payload.build) {
    return NextResponse.json(
      { success: false, error: "Preset has no build phase linked" },
      { status: 422 },
    );
  }

  return NextResponse.json({ success: true, preset: payload });
}
