import { normalizeOperatorFirebaseUid } from "@/lib/auth/firebase-uid-normalize";
import { prisma } from "@/lib/prisma";

export type TrainingManagerSeatRow = {
  id: string;
  email: string;
  name: string | null;
  firebaseUid: string | null;
  isActive: boolean;
  gofastCompanyId: string | null;
};

const managerSelect = {
  id: true,
  email: true,
  name: true,
  firebaseUid: true,
  isActive: true,
  gofastCompanyId: true,
} as const;

function isActiveSeat(row: TrainingManagerSeatRow | null): row is TrainingManagerSeatRow {
  return Boolean(row?.isActive && row.gofastCompanyId);
}

export async function listActiveTrainingManagerSeats(): Promise<TrainingManagerSeatRow[]> {
  return prisma.training_managers.findMany({
    where: { isActive: true, gofastCompanyId: { not: null } },
    select: managerSelect,
    orderBy: [{ email: "asc" }],
  });
}

export async function findActiveTrainingManagerSeat(input: {
  staffId?: string;
  email?: string;
  firebaseUid?: string;
}): Promise<TrainingManagerSeatRow | null> {
  const staffId = input.staffId?.trim();
  const email = input.email?.trim();
  const firebaseUid = input.firebaseUid ? normalizeOperatorFirebaseUid(input.firebaseUid) : null;

  if (staffId) {
    const byId = await prisma.training_managers.findUnique({
      where: { id: staffId },
      select: managerSelect,
    });
    if (isActiveSeat(byId)) return byId;
  }

  if (email) {
    const byEmail = await prisma.training_managers.findFirst({
      where: {
        isActive: true,
        gofastCompanyId: { not: null },
        email: { equals: email, mode: "insensitive" },
      },
      select: managerSelect,
    });
    if (isActiveSeat(byEmail)) return byEmail;
  }

  if (firebaseUid) {
    const byUid = await prisma.training_managers.findFirst({
      where: {
        isActive: true,
        gofastCompanyId: { not: null },
        firebaseUid,
      },
      select: managerSelect,
    });
    if (isActiveSeat(byUid)) return byUid;
  }

  return null;
}

export type FindOrCreateManagerResult =
  | { ok: true; manager: TrainingManagerSeatRow; created: boolean; alreadyAssigned: boolean }
  | { ok: false; status: number; error: string };

export async function findOrCreateTrainingManagerSeat(input: {
  staffId: string;
  gofastCompanyId: string;
  email: string;
  name?: string | null;
  firebaseUid: string;
}): Promise<FindOrCreateManagerResult> {
  const staffId = input.staffId.trim();
  const gofastCompanyId = input.gofastCompanyId.trim();
  const email = input.email.trim();
  const name = input.name?.trim() || null;
  const firebaseUid = normalizeOperatorFirebaseUid(input.firebaseUid);

  if (!firebaseUid) {
    return {
      ok: false,
      status: 409,
      error: "firebaseUid is required for Training Manager seat assign",
    };
  }

  const existing = await findActiveTrainingManagerSeat({ staffId, email, firebaseUid });
  if (existing) {
    if (existing.firebaseUid && existing.firebaseUid !== firebaseUid) {
      return {
        ok: false,
        status: 409,
        error: "This seat is linked to a different Firebase account — use Refresh Firebase ID",
      };
    }
    if (existing.id !== staffId && existing.email.toLowerCase() === email.toLowerCase()) {
      return {
        ok: false,
        status: 409,
        error: `Already assigned as Training Manager (${existing.email})`,
      };
    }
    return { ok: true, manager: existing, created: false, alreadyAssigned: true };
  }

  const company = await prisma.gofast_companies.findUnique({
    where: { id: gofastCompanyId },
    select: { id: true },
  });
  if (!company) {
    return { ok: false, status: 400, error: `GoFast company copy not found: ${gofastCompanyId}` };
  }

  const uidConflict = await prisma.training_managers.findFirst({
    where: { firebaseUid, id: { not: staffId } },
    select: { email: true },
  });
  if (uidConflict) {
    return {
      ok: false,
      status: 409,
      error: `Firebase account already assigned to ${uidConflict.email}`,
    };
  }

  const manager = await prisma.training_managers.create({
    data: {
      id: staffId,
      gofastCompanyId,
      email,
      name,
      firebaseUid,
      isActive: true,
    },
    select: managerSelect,
  });

  return { ok: true, manager, created: true, alreadyAssigned: false };
}
