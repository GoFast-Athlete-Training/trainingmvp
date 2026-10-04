import type { TrainingManager } from "@/lib/auth/training-manager-auth";
import { verifyFirebaseBearer } from "@/lib/auth/verify-firebase-bearer";
import { prisma } from "@/lib/prisma";

export type ManagerClaimFailure =
  | "missing_token"
  | "invalid_token"
  | "no_manager_seat"
  | "seat_account_mismatch";

export type ManagerClaimResult =
  | { ok: true; manager: TrainingManager }
  | { ok: false; reason: ManagerClaimFailure; detail?: string };

const managerInclude = {
  gofast_company: { select: { name: true } },
} as const;

const activeSeat = {
  isActive: true,
  gofastCompanyId: { not: null },
} as const;

type ManagerRow = {
  id: string;
  email: string;
  name: string | null;
  firebaseUid: string | null;
  gofastCompanyId: string | null;
  isActive: boolean;
  gofast_company?: { name: string } | null;
};

function toManager(row: ManagerRow): TrainingManager | null {
  if (!row.gofastCompanyId) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    firebaseUid: row.firebaseUid,
    gofastCompanyId: row.gofastCompanyId,
    gofastCompanyName: row.gofast_company?.name ?? null,
  };
}

function managerHasSeat(manager: { gofastCompanyId: string | null; isActive: boolean }) {
  return manager.isActive && Boolean(manager.gofastCompanyId);
}

async function findActiveTrainingManagerRow(uid: string): Promise<ManagerRow | null> {
  return prisma.training_managers.findFirst({
    where: { firebaseUid: uid, ...activeSeat },
    include: managerInclude,
  });
}

async function resolveTrainingManagerSeatForFirebaseUser(
  uid: string,
): Promise<
  | { ok: true; manager: TrainingManager }
  | {
      ok: false;
      reason: Exclude<ManagerClaimFailure, "missing_token" | "invalid_token">;
      detail?: string;
    }
> {
  const row = await findActiveTrainingManagerRow(uid);

  if (!row || !managerHasSeat(row)) {
    return {
      ok: false,
      reason: "no_manager_seat",
      detail: "No Training Manager seat for this Firebase account",
    };
  }

  const manager = toManager(row);
  if (!manager) {
    return {
      ok: false,
      reason: "no_manager_seat",
      detail: "Training Manager seat is missing company assignment",
    };
  }

  return { ok: true, manager };
}

/** Local training_managers seat lookup by firebaseUid only. */
export async function findOrClaimTrainingManager(
  request: Pick<Request, "headers">,
): Promise<ManagerClaimResult> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  const firebase = await verifyFirebaseBearer(token);
  if (!firebase.ok) {
    return { ok: false, reason: "invalid_token", detail: firebase.detail };
  }

  const { uid } = firebase.user;
  const seat = await resolveTrainingManagerSeatForFirebaseUser(uid);

  if (!seat.ok) {
    return { ok: false, reason: seat.reason, detail: seat.detail };
  }

  return seat;
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
      return (
        detail ??
        "No Training Manager seat assigned — ask a founder to assign you from Company Admin → Manage → Training Manage"
      );
    case "seat_account_mismatch":
      return detail ?? "This Training Manager seat belongs to a different account";
    default:
      return detail ?? "No Training Manage access";
  }
}
