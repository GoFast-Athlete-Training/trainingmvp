import type { TrainingManager } from "@/lib/auth/training-manager-auth";
import { resolveTrainingManagerFromRequest } from "@/lib/auth/training-manager-me";

export type ManagerClaimFailure =
  | "missing_token"
  | "invalid_token"
  | "no_manager_seat"
  | "seat_account_mismatch";

export type ManagerClaimResult =
  | { ok: true; manager: TrainingManager }
  | { ok: false; reason: ManagerClaimFailure; detail?: string };

export async function findOrClaimTrainingManager(
  request: Pick<Request, "headers">,
): Promise<ManagerClaimResult> {
  const result = await resolveTrainingManagerFromRequest(request);
  if (result.ok) {
    return { ok: true, manager: result.manager };
  }

  if (result.status === 401) {
    const missing = result.error.includes("Missing");
    return {
      ok: false,
      reason: missing ? "missing_token" : "invalid_token",
      detail: result.error,
    };
  }

  if (result.error.includes("Staff id does not match")) {
    return { ok: false, reason: "seat_account_mismatch", detail: result.error };
  }

  return { ok: false, reason: "no_manager_seat", detail: result.error };
}

export function claimFailureStatus(reason: ManagerClaimFailure): number {
  switch (reason) {
    case "missing_token":
    case "invalid_token":
      return 401;
    default:
      return 403;
  }
}

export function claimFailureMessage(reason: ManagerClaimFailure, detail?: string): string {
  switch (reason) {
    case "missing_token":
      return "Missing Authorization bearer token";
    case "invalid_token":
      return detail ?? "Invalid or expired sign-in token";
    case "no_manager_seat":
      return detail ?? "No Training Manager seat for this Firebase account";
    case "seat_account_mismatch":
      return detail ?? "This Training Manager seat belongs to a different account";
    default:
      return detail ?? "No Training Manage access";
  }
}
