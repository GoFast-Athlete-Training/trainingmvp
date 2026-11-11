export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolvePlanPresetProdStaff } from "@/lib/training/plan-preset-prod-forward";
import { applyPresetPatch } from "@/lib/training/preset-patch-csv";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const ctx = await resolvePlanPresetProdStaff(request);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { csvText?: string };
  const csvText = typeof body.csvText === "string" ? body.csvText : "";
  if (!csvText.trim()) {
    return NextResponse.json({ success: false, error: "csvText is required" }, { status: 400 });
  }

  const result = await applyPresetPatch({
    presetId: id,
    csvText,
    authorization: ctx.authorization,
    staffId: ctx.staffId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, preview: result.preview },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, preview: result.preview });
}
