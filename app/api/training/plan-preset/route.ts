export const dynamic = "force-dynamic";

import {
  proxyPlanPresetResponse,
  resolvePlanPresetProdStaff,
} from "@/lib/training/plan-preset-prod-forward";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const ctx = await resolvePlanPresetProdStaff(request);
  if (ctx instanceof NextResponse) return ctx;

  return proxyPlanPresetResponse(ctx, { path: "/api/training/plan-preset", method: "GET" });
}

/** Create minimal plan preset on prod (prod SOT). */
export async function POST(request: NextRequest) {
  const ctx = await resolvePlanPresetProdStaff(request);
  if (ctx instanceof NextResponse) return ctx;

  const body = await request.json().catch(() => ({}));
  return proxyPlanPresetResponse(ctx, {
    path: "/api/training/plan-preset",
    method: "POST",
    body,
  });
}
