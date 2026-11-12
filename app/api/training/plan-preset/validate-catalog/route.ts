export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { forwardProdPresetStaffRequest } from "@/lib/training/prod-preset-staff-proxy";
import { resolvePlanPresetProdStaff } from "@/lib/training/plan-preset-prod-forward";
import { buildPresetValidateLlmPacketFromProdJson } from "@/lib/training/preset-validate-llm-packet";

export async function GET(request: NextRequest) {
  const ctx = await resolvePlanPresetProdStaff(request);
  if (ctx instanceof NextResponse) return ctx;

  const prodRes = await forwardProdPresetStaffRequest({
    authorization: ctx.authorization,
    staffId: ctx.staffId,
    path: "/api/training/plan-preset",
    method: "GET",
  });
  const json = (await prodRes.json().catch(() => ({}))) as {
    presets?: { id: string; title?: string }[];
  };

  if (!prodRes.ok || !Array.isArray(json.presets)) {
    return NextResponse.json(
      { success: false, error: "Failed to load prod preset list" },
      { status: prodRes.status || 502 },
    );
  }

  const bodies: string[] = [];
  for (const p of json.presets) {
    if (!p.id) continue;
    const detailRes = await forwardProdPresetStaffRequest({
      authorization: ctx.authorization,
      staffId: ctx.staffId,
      path: `/api/training/plan-preset/${encodeURIComponent(p.id)}`,
      method: "GET",
    });
    const detail = (await detailRes.json().catch(() => ({}))) as {
      preset?: Record<string, unknown>;
    };
    if (detail.preset) {
      bodies.push(buildPresetValidateLlmPacketFromProdJson(detail.preset));
    }
  }

  const sections = bodies.map((body, i) => `========== Preset ${i + 1} / ${bodies.length} ==========\n${body}`);
  const promptText = [
    "TRAINING PLAN PRESET CATALOG CHECK (prod)",
    `Count: ${bodies.length}`,
    "",
    ...sections,
    "",
    "---",
    "For each preset above, note persona fit, missing fields, and deprecated data. Do not batch-edit ids.",
  ].join("\n");
  return NextResponse.json({ success: true, promptText });
}
