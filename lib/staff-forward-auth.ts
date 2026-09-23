import { NextRequest, NextResponse } from "next/server";

export const STAFF_ID_HEADER = "x-gofast-staff-id";

export type StaffForwardActor = {
  staffId: string;
};

/** Human lane — Bearer + x-gofast-staff-id (Company send / import). */
export function assertStaffForward(
  request: NextRequest,
):
  | { ok: true; actor: StaffForwardActor }
  | { ok: false; response: NextResponse } {
  const authorization = request.headers.get("authorization");
  const staffId = request.headers.get(STAFF_ID_HEADER)?.trim();
  if (!authorization?.startsWith("Bearer ") || !staffId) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, actor: { staffId } };
}
