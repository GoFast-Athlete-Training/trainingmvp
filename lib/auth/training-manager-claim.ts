import type { TrainingManager } from "@/lib/auth/training-manager-auth";
import { verifyStaffViaCompanyFindOrCreate } from "@/lib/company-staff-verify";
import { prisma } from "@/lib/prisma";

export type ManagerClaimFailure =
  | "missing_token"
  | "invalid_token"
  | "not_company_staff"
  | "no_manager_seat"
  | "seat_account_mismatch";

export type ManagerClaimResult =
  | { ok: true; manager: TrainingManager }
  | { ok: false; reason: ManagerClaimFailure; detail?: string };

const managerInclude = {
  gofast_company: { select: { name: true } },
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

export async function findOrClaimTrainingManager(
  request: Pick<Request, "headers">,
  options?: { requiredStaffId?: string },
): Promise<ManagerClaimResult> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  const companyStaff = await verifyStaffViaCompanyFindOrCreate(token);
  if (!companyStaff.ok) {
    return {
      ok: false,
      reason:
        companyStaff.error === "not_company_staff" ? "not_company_staff" : "invalid_token",
      detail: companyStaff.detail,
    };
  }

  const { staff } = companyStaff;
  const requiredStaffId = options?.requiredStaffId?.trim();

  if (requiredStaffId && requiredStaffId !== staff.id) {
    return {
      ok: false,
      reason: "seat_account_mismatch",
      detail: "Staff header does not match Company session",
    };
  }

  let row =
    (await prisma.training_managers.findFirst({
      where: { id: staff.id, isActive: true },
      include: managerInclude,
    })) ??
    (await prisma.training_managers.findFirst({
      where: {
        isActive: true,
        gofastCompanyId: { not: null },
        OR: [
          { firebaseUid: staff.firebaseUid },
          ...(staff.email
            ? [{ email: { equals: staff.email, mode: "insensitive" as const } }]
            : []),
        ],
      },
      include: managerInclude,
    }));

  if (!row || !managerHasSeat(row)) {
    return {
      ok: false,
      reason: "no_manager_seat",
      detail: "No Training Manage seat assigned for this Company staff member",
    };
  }

  if (!seatMatchesIdentity(row, staff.firebaseUid, staff.email)) {
    return {
      ok: false,
      reason: "seat_account_mismatch",
      detail: "This Training Manage seat is bound to a different Firebase account",
    };
  }

  const claimed = await claimSeatIfNeeded(row, staff.firebaseUid);

  const manager = toManager(claimed);
  if (!manager) {
    return { ok: false, reason: "no_manager_seat" };
  }

  return { ok: true, manager };
}

export function claimFailureStatus(reason: ManagerClaimFailure): number {
  switch (reason) {
    case "missing_token":
    case "invalid_token":
    case "not_company_staff":
    case "seat_account_mismatch":
      return 401;
    case "no_manager_seat":
      return 403;
    default:
      return 401;
  }
}

export function claimFailureMessage(reason: ManagerClaimFailure, detail?: string): string {
  switch (reason) {
    case "missing_token":
      return "Missing authorization token";
    case "invalid_token":
      return detail ?? "Invalid token";
    case "not_company_staff":
      return detail ?? "Not a Company staff account";
    case "no_manager_seat":
      return detail ?? "No Training Manage seat assigned for this staff account";
    case "seat_account_mismatch":
      return detail ?? "Staff id does not match this session";
    default:
      return "Unauthorized";
  }
}
