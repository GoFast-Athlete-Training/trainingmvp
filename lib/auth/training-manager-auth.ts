import {
  claimFailureMessage,
  claimFailureStatus,
  findOrClaimTrainingManager,
} from "@/lib/auth/training-manager-claim";
import { NextRequest, NextResponse } from "next/server";

export const STAFF_ID_HEADER = "x-gofast-staff-id";

export type TrainingManager = {
  id: string;
  email: string;
  name: string | null;
  firebaseUid: string | null;
  gofastCompanyId: string;
  gofastCompanyName: string | null;
};

export async function requireTrainingManagerFromRequest(
  request: Pick<Request, "headers">,
): Promise<TrainingManager | null> {
  const staffId = request.headers.get(STAFF_ID_HEADER)?.trim();
  if (!staffId) return null;

  const result = await findOrClaimTrainingManager(request, { requiredStaffId: staffId });
  return result.ok ? result.manager : null;
}

export async function assertTrainingManagerAuth(
  request: NextRequest,
): Promise<{ manager: TrainingManager; error: null } | { manager: null; error: NextResponse }> {
  const manager = await requireTrainingManagerFromRequest(request);
  if (!manager) {
    return {
      manager: null,
      error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { manager, error: null };
}

export async function requireTrainingManagerByTokenOnlyWithDetail(
  request: Pick<Request, "headers">,
): Promise<
  | { ok: true; manager: TrainingManager }
  | { ok: false; status: number; error: string }
> {
  const result = await findOrClaimTrainingManager(request);
  if (result.ok) {
    return { ok: true, manager: result.manager };
  }
  return {
    ok: false,
    status: claimFailureStatus(result.reason),
    error: claimFailureMessage(result.reason, result.detail),
  };
}
