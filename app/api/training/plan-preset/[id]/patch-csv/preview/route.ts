export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolvePlanPresetProdStaff } from "@/lib/training/plan-preset-prod-forward";
import { loadPresetValidateRow } from "@/lib/training/preset-validate-load";
import { previewPresetPatch } from "@/lib/training/preset-patch-csv";

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

  const row = await loadPresetValidateRow(id);
  if (!row) {
    return NextResponse.json({ success: false, error: "Preset not found in Training Manage" }, { status: 404 });
  }

  const preview = await previewPresetPatch(row, csvText);
  return NextResponse.json({
    success: preview.errors.length === 0,
    preview,
  });
}
