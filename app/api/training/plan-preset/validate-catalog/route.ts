export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { forwardProdPresetStaffRequest } from "@/lib/training/prod-preset-staff-proxy";
import { resolvePlanPresetProdStaff } from "@/lib/training/plan-preset-prod-forward";
import {
  loadAllPresetValidateRows,
  loadPresetValidateRow,
} from "@/lib/training/preset-validate-load";
import {
  buildPresetCatalogValidateLlmPacket,
  buildPresetValidateLlmPacket,
  buildPresetValidateLlmPacketFromProdJson,
} from "@/lib/training/preset-validate-llm-packet";

export async function GET(request: NextRequest) {
  const ctx = await resolvePlanPresetProdStaff(request);
  if (ctx instanceof NextResponse) return ctx;

  const localRows = await loadAllPresetValidateRows();
  const localIds = new Set(localRows.map((r) => r.id));
  let promptText = buildPresetCatalogValidateLlmPacket(localRows);

  const prodRes = await forwardProdPresetStaffRequest({
    authorization: ctx.authorization,
    staffId: ctx.staffId,
    path: "/api/training/plan-preset",
    method: "GET",
  });
  const json = (await prodRes.json().catch(() => ({}))) as {
    presets?: { id: string; title?: string }[];
  };

  if (prodRes.ok && Array.isArray(json.presets)) {
    const prodOnly: string[] = [];
    for (const p of json.presets) {
      if (!p.id || localIds.has(p.id)) continue;
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
        prodOnly.push(buildPresetValidateLlmPacketFromProdJson(detail.preset));
      } else {
        const tm = await loadPresetValidateRow(p.id);
        if (tm) prodOnly.push(buildPresetValidateLlmPacket(tm));
      }
    }
    if (prodOnly.length > 0) {
      promptText = [
        promptText,
        "",
        `========== Prod-only (no TM mirror): ${prodOnly.length} ==========`,
        ...prodOnly.map((body, i) => `\n--- Prod preset ${i + 1} ---\n${body}`),
      ].join("\n");
    }
  }

  return NextResponse.json({ success: true, promptText });
}
