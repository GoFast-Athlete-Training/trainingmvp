export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { forwardProdPresetStaffRequest } from "@/lib/training/prod-preset-staff-proxy";
import { resolvePlanPresetProdStaff } from "@/lib/training/plan-preset-prod-forward";
import { loadPresetValidateRow } from "@/lib/training/preset-validate-load";
import {
  buildPresetValidateLlmPacket,
  buildPresetValidateLlmPacketFromProdJson,
} from "@/lib/training/preset-validate-llm-packet";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const ctx = await resolvePlanPresetProdStaff(request);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const local = await loadPresetValidateRow(id);
  if (local) {
    return NextResponse.json({
      success: true,
      source: "training_manage",
      promptText: buildPresetValidateLlmPacket(local),
    });
  }

  const prodRes = await forwardProdPresetStaffRequest({
    authorization: ctx.authorization,
    staffId: ctx.staffId,
    path: `/api/training/plan-preset/${encodeURIComponent(id)}`,
    method: "GET",
  });
  const json = (await prodRes.json().catch(() => ({}))) as {
    preset?: Record<string, unknown>;
    success?: boolean;
  };
  if (!prodRes.ok || !json.preset) {
    return NextResponse.json(
      { success: false, error: "Preset not found" },
      { status: prodRes.status === 404 ? 404 : 502 },
    );
  }

  return NextResponse.json({
    success: true,
    source: "prod_only",
    promptText: buildPresetValidateLlmPacketFromProdJson(json.preset),
  });
}
