import {
  claimFailureMessage,
  claimFailureStatus,
  findOrClaimTrainingManager,
} from "@/lib/auth/training-manager-claim";
import { resolveTrainingManagerFromRequest } from "@/lib/auth/training-manager-me";
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
  const result = await resolveTrainingManagerFromRequest(request);
  return result.ok ? result.manager : null;
}

export async function assertTrainingManagerAuth(
  request: NextRequest,
): Promise<{ manager: TrainingManager; error: null } | { manager: null; error: NextResponse }> {
  const result = await resolveTrainingManagerFromRequest(request);
  if (!result.ok) {
    return {
      manager: null,
      error: NextResponse.json({ success: false, error: result.error }, { status: result.status }),
    };
  }
  return { manager: result.manager, error: null };
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

export async function assertTrainingManagerForward(
  request: Pick<Request, "headers">,
): Promise<
  | { ok: true; manager: TrainingManager; authorization: string }
  | { ok: false; response: NextResponse }
> {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }

  const result = await resolveTrainingManagerFromRequest(request);
  if (!result.ok) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: result.error }, { status: result.status }),
    };
  }

  return { ok: true, manager: result.manager, authorization };
}
