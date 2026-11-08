import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { assertStaffForward } from "@/lib/staff-forward-auth";
import { forwardProdPresetStaffRequest } from "@/lib/training/prod-preset-staff-proxy";
import { NextRequest, NextResponse } from "next/server";

export type ProdStaffProxyContext = {
  authorization: string;
  staffId: string;
};

export async function resolvePlanPresetProdStaff(
  request: NextRequest,
): Promise<ProdStaffProxyContext | NextResponse> {
  const forward = await assertStaffForward(request);
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!authorization) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (forward.ok) {
    return { authorization, staffId: forward.actor.staffId };
  }

  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  return { authorization, staffId: auth.manager.id };
}

export async function proxyPlanPresetResponse(
  ctx: ProdStaffProxyContext,
  opts: { path: string; method: string; body?: unknown },
): Promise<NextResponse> {
  const prodRes = await forwardProdPresetStaffRequest({
    authorization: ctx.authorization,
    staffId: ctx.staffId,
    path: opts.path,
    method: opts.method,
    body: opts.body,
  });
  const text = await prodRes.text();
  return new NextResponse(text || JSON.stringify({ success: prodRes.ok }), {
    status: prodRes.status,
    headers: { "Content-Type": "application/json" },
  });
}
