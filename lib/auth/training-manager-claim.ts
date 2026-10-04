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

function seatMatchesIdentity(
  manager: { firebaseUid: string | null; email: string },
  uid: string,
  email: string,
): boolean {
  if (manager.firebaseUid && manager.firebaseUid !== uid) return false;
  if (!manager.firebaseUid && email && manager.email.toLowerCase() !== email) return false;
  return true;
}

async function claimSeatIfNeeded(row: ManagerRow, uid: string): Promise<ManagerRow> {
  if (row.firebaseUid) return row;
  return prisma.training_managers.update({
    where: { id: row.id },
    data: { firebaseUid: uid },
    include: managerInclude,
  });
}

async function resolveTrainingManagerSeatForFirebaseUser(
  uid: string,
  email: string,
  options?: { preferredStaffId?: string },
): Promise<
  | { ok: true; manager: TrainingManager }
  | {
      ok: false;
      reason: Exclude<ManagerClaimFailure, "missing_token" | "invalid_token">;
      detail?: string;
    }
> {
  const preferredStaffId = options?.preferredStaffId?.trim();

  let row: ManagerRow | null =
    preferredStaffId != null
      ? await prisma.training_managers.findFirst({
          where: { id: preferredStaffId, ...activeSeat },
          include: managerInclude,
        })
      : null;

  if (!row) {
    row =
      (await prisma.training_managers.findFirst({
        where: { firebaseUid: uid, ...activeSeat },
        include: managerInclude,
      })) ??
      (email
        ? await prisma.training_managers.findFirst({
            where: {
              ...activeSeat,
              email: { equals: email, mode: "insensitive" },
            },
            include: managerInclude,
          })
        : null);
  }

  if (!row || !managerHasSeat(row)) {
    return {
      ok: false,
      reason: "no_manager_seat",
      detail: "No Training Manager seat for this account",
    };
  }

  if (!seatMatchesIdentity(row, uid, email)) {
    return {
      ok: false,
      reason: "seat_account_mismatch",
      detail: "This Training Manager seat is bound to a different Firebase account",
    };
  }

  const claimed = await claimSeatIfNeeded(row, uid);
  const manager = toManager(claimed);
  if (!manager) {
    return {
      ok: false,
      reason: "no_manager_seat",
      detail: "Training Manager seat is missing company assignment",
    };
  }

  return { ok: true, manager };
}

/** Find active training_managers seat locally; bind Firebase on first claim. No Company call. */
export async function findOrClaimTrainingManager(
  request: Pick<Request, "headers">,
  options?: { requiredStaffId?: string },
): Promise<ManagerClaimResult> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  const firebase = await verifyFirebaseBearer(token);
  if (!firebase.ok) {
    return { ok: false, reason: "invalid_token", detail: firebase.detail };
  }

  const { uid, email } = firebase.user;
  const seat = await resolveTrainingManagerSeatForFirebaseUser(uid, email, {
    preferredStaffId: options?.requiredStaffId,
  });

  if (!seat.ok) {
    return { ok: false, reason: seat.reason, detail: seat.detail };
  }

  const requiredStaffId = options?.requiredStaffId?.trim();
  if (requiredStaffId && seat.manager.id !== requiredStaffId) {
    return {
      ok: false,
      reason: "invalid_token",
      detail: "Staff header does not match this Training Manager",
    };
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
      return "Missing authorization token";
    case "invalid_token":
      return detail ?? "Invalid or expired sign-in token";
    case "no_manager_seat":
      return detail ?? "No Training Manage seat assigned for this account";
    case "seat_account_mismatch":
      return detail ?? "This Training Manage seat belongs to a different account";
    default:
      return detail ?? "Unauthorized";
  }
}
