import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { assertStaffForward } from "@/lib/staff-forward-auth";
import { forwardProdPresetStaffRequest } from "@/lib/training/prod-preset-staff-proxy";
import { NextRequest, NextResponse } from "next/server";

export type ProdStaffContext = {
  authorization: string;
  staffId: string;
};

export async function resolveProdStaffContext(
  request: NextRequest,
): Promise<ProdStaffContext | NextResponse> {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!authorization) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const forward = await assertStaffForward(request);
  if (forward.ok) {
    return { authorization, staffId: forward.actor.staffId };
  }

  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  return { authorization, staffId: auth.manager.id };
}

export async function proxyProdTrainingRoute(
  request: NextRequest,
  prodPath: string,
  opts?: { method?: string; body?: unknown },
): Promise<NextResponse> {
  const ctx = await resolveProdStaffContext(request);
  if (ctx instanceof NextResponse) return ctx;

  const method = opts?.method ?? request.method;
  let path = prodPath;
  const search = request.nextUrl.search;
  if (search && !path.includes("?")) path += search;

  let body = opts?.body;
  if (body === undefined && method !== "GET" && method !== "HEAD") {
    body = await request.json().catch(() => undefined);
  }

  const prodRes = await forwardProdPresetStaffRequest({
    authorization: ctx.authorization,
    staffId: ctx.staffId,
    path,
    method,
    body,
  });

  const text = await prodRes.text();
  return new NextResponse(text || JSON.stringify({ success: prodRes.ok }), {
    status: prodRes.status,
    headers: { "Content-Type": "application/json" },
  });
}
