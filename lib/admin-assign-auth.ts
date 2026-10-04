import { getAdminAuth } from "@/lib/firebaseAdmin";
import { NextRequest, NextResponse } from "next/server";

export type AdminAssignActor = {
  id: string;
};

/**
 * Admin already validated hq_staff + gofast_companies before POST.
 * This route only requires a valid Firebase token. It does not call Company.
 */
export async function assertAdminAssignActor(
  request: NextRequest,
): Promise<{ ok: true; actor: AdminAssignActor } | { ok: false; response: NextResponse }> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(authorization.slice("Bearer ".length).trim());
    return { ok: true, actor: { id: decoded.uid } };
  } catch (err) {
    console.error("assertAdminAssignActor:", err);
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
}
