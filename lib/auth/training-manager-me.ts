import { verifyFirebaseBearer } from "@/lib/auth/verify-firebase-bearer";
import { prisma } from "@/lib/prisma";
import type { TrainingManager } from "@/lib/auth/training-manager-auth";

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

function toManager(row: ManagerRow): TrainingManager {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    firebaseUid: row.firebaseUid,
    gofastCompanyId: row.gofastCompanyId ?? "",
    gofastCompanyName: row.gofast_company?.name ?? null,
  };
}

function isActiveSeat(row: ManagerRow | null): row is ManagerRow {
  return Boolean(row?.isActive && row.gofastCompanyId);
}

export type TrainingManagerMeResult =
  | { ok: true; manager: TrainingManager }
  | { ok: false; status: number; error: string };

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeName(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

async function findLocalTrainingManager(input: {
  uid: string;
  email: string;
  displayName: string;
}): Promise<ManagerRow | null> {
  const uid = input.uid.trim();
  if (uid) {
    const byUid = await prisma.training_managers.findFirst({
      where: { firebaseUid: uid, isActive: true, gofastCompanyId: { not: null } },
      include: managerInclude,
    });
    if (isActiveSeat(byUid)) return byUid;
  }

  const email = normalizeEmail(input.email);
  if (email) {
    const byEmail = await prisma.training_managers.findFirst({
      where: {
        isActive: true,
        gofastCompanyId: { not: null },
        email: { equals: email, mode: "insensitive" },
      },
      include: managerInclude,
    });
    if (isActiveSeat(byEmail)) return byEmail;
  }

  const name = normalizeName(input.displayName);
  if (name) {
    const candidates = await prisma.training_managers.findMany({
      where: { isActive: true, gofastCompanyId: { not: null }, name: { not: null } },
      include: managerInclude,
    });
    const byName = candidates.find((row) => normalizeName(row.name) === name);
    if (isActiveSeat(byName ?? null)) return byName ?? null;
  }

  return null;
}

export async function resolveTrainingManagerFromRequest(
  request: Pick<Request, "headers">,
): Promise<TrainingManagerMeResult> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { ok: false, status: 401, error: "Missing Authorization bearer token" };
  }

  const firebase = await verifyFirebaseBearer(token);
  if (!firebase.ok) {
    return {
      ok: false,
      status: 401,
      error: firebase.detail ?? "Invalid or expired sign-in token",
    };
  }

  const row = await findLocalTrainingManager({
    uid: firebase.user.uid,
    email: firebase.user.email,
    displayName: firebase.user.name ?? "",
  });

  if (!row) {
    return { ok: false, status: 403, error: "Not a Training Manager" };
  }

  return { ok: true, manager: toManager(row) };
}
