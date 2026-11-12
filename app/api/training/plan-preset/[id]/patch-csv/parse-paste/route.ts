export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolvePlanPresetProdStaff } from "@/lib/training/plan-preset-prod-forward";
import { loadPresetValidateRow } from "@/lib/training/preset-validate-load";
import { buildPresetValidateLlmPacketFromProdJson } from "@/lib/training/preset-validate-llm-packet";
import { parsePresetPatchPaste } from "@/lib/training/preset-patch-csv";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const ctx = await resolvePlanPresetProdStaff(request);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { pasteText?: string };
  const pasteText = typeof body.pasteText === "string" ? body.pasteText : "";
  if (!pasteText.trim()) {
    return NextResponse.json({ success: false, error: "pasteText is required" }, { status: 400 });
  }

  const row = await loadPresetValidateRow(id, {
    authorization: ctx.authorization,
    staffId: ctx.staffId,
  });
  if (!row) {
    return NextResponse.json({ success: false, error: "Preset not found on prod" }, { status: 404 });
  }

  const packet = buildPresetValidateLlmPacketFromProdJson(row);
  const { csvText, parseErrors } = await parsePresetPatchPaste({ pasteText, snapshotPacket: packet });
  if (parseErrors.length > 0) {
    return NextResponse.json({ success: false, errors: parseErrors }, { status: 400 });
  }

  return NextResponse.json({ success: true, csvText });
}
