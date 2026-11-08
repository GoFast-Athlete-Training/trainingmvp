export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import {
  proxyPlanPresetResponse,
  resolvePlanPresetProdStaff,
} from "@/lib/training/plan-preset-prod-forward";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const ctx = await resolvePlanPresetProdStaff(request);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  return proxyPlanPresetResponse(ctx, {
    path: `/api/training/plan-preset/${encodeURIComponent(id)}`,
    method: "GET",
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = await resolvePlanPresetProdStaff(request);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return proxyPlanPresetResponse(ctx, {
    path: `/api/training/plan-preset/${encodeURIComponent(id)}`,
    method: "PATCH",
    body,
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const ctx = await resolvePlanPresetProdStaff(request);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const prodRes = await (
    await import("@/lib/training/prod-preset-staff-proxy")
  ).forwardProdPresetStaffRequest({
    authorization: ctx.authorization,
    staffId: ctx.staffId,
    path: `/api/training/plan-preset/${encodeURIComponent(id)}`,
    method: "DELETE",
  });

  if (prodRes.ok) {
    await prisma.training_plan_preset.deleteMany({ where: { id } }).catch(() => undefined);
  }

  const text = await prodRes.text();
  return new NextResponse(text || JSON.stringify({ success: prodRes.ok }), {
    status: prodRes.status,
    headers: { "Content-Type": "application/json" },
  });
}
