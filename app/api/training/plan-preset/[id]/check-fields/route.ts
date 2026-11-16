export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { checkPresetFields } from "@/lib/training/preset-check-fields";
import { resolvePlanPresetProdStaff } from "@/lib/training/plan-preset-prod-forward";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const ctx = await resolvePlanPresetProdStaff(request);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  try {
    const result = await checkPresetFields({
      presetId: id,
      auth: { authorization: ctx.authorization, staffId: ctx.staffId },
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not check the fields";
    const status = msg.includes("not found") ? 400 : 502;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
