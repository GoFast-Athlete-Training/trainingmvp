import { getCompanyAppUrl } from "@/lib/app-urls";
import { STAFF_ID_HEADER } from "@/lib/auth/training-manager-auth";
import { NextRequest, NextResponse } from "next/server";

const ASSIGN_ROLES = new Set(["FOUNDER", "SENIOR_EXEC"]);

export type AdminAssignActor = {
  id: string;
  cockpitRole: string;
};

export async function assertAdminAssignActor(
  request: NextRequest,
): Promise<
  { ok: true; actor: AdminAssignActor } | { ok: false; response: NextResponse }
> {
  const authorization = request.headers.get("authorization");
  const staffId = request.headers.get(STAFF_ID_HEADER)?.trim();
  if (!authorization?.startsWith("Bearer ") || !staffId) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }

  try {
    const response = await fetch(`${getCompanyAppUrl()}/api/staff/me`, {
      headers: {
        Authorization: authorization,
        Accept: "application/json",
        [STAFF_ID_HEADER]: staffId,
      },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      cockpitRole?: string;
      staff?: { id?: string };
      error?: string;
    };

    if (!response.ok || !payload.success || !payload.staff?.id) {
      const status = response.status === 401 ? 401 : response.status >= 400 ? response.status : 502;
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: payload.error ?? "Staff verification failed" },
          { status },
        ),
      };
    }

    if (payload.staff.id !== staffId) {
      return {
        ok: false,
        response: NextResponse.json({ success: false, error: "Staff id mismatch" }, { status: 401 }),
      };
    }

    const role = payload.cockpitRole ?? "";
    if (!ASSIGN_ROLES.has(role)) {
      return {
        ok: false,
        response: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }),
      };
    }

    return { ok: true, actor: { id: staffId, cockpitRole: role } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Staff verification failed";
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: msg }, { status: 502 }),
    };
  }
}
