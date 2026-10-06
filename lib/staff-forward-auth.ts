import { verifyFirebaseBearer } from "@/lib/auth/verify-firebase-bearer";
import { NextRequest, NextResponse } from "next/server";

export const STAFF_ID_HEADER = "x-gofast-staff-id";

export type StaffForwardActor = {
  staffId: string;
};

/** Inbound cross-app lane: Firebase Bearer + x-gofast-staff-id (company staff id). No HQ lookup. */
export async function assertStaffForward(
  request: NextRequest,
): Promise<
  | { ok: true; actor: StaffForwardActor }
  | { ok: false; response: NextResponse }
> {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }

  const staffId = request.headers.get(STAFF_ID_HEADER)?.trim();
  if (!staffId) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }

  const token = authorization.slice("Bearer ".length).trim();
  const firebase = await verifyFirebaseBearer(token);
  if (!firebase.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: firebase.detail ?? "Invalid or expired sign-in token" },
        { status: 401 },
      ),
    };
  }

  return { ok: true, actor: { staffId } };
}
