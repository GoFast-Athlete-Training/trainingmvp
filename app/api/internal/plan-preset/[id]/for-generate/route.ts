export const dynamic = "force-dynamic";

import { verifyInternalApiKey } from "@/lib/internal-api-auth";
import { loadPresetForGenerate } from "@/lib/training/preset-for-generate";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

/** Machine lane — prod plan generate loads phase rows from Training Manage. */
export async function GET(request: NextRequest, { params }: Params) {
  const denied = verifyInternalApiKey(request);
  if (denied) return denied;

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
