import { verifyFirebaseBearer } from "@/lib/auth/verify-firebase-bearer";
import { normalizeOperatorFirebaseUid } from "@/lib/auth/firebase-uid-normalize";
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

function isActiveManager(row: ManagerRow | null): row is ManagerRow {
  return Boolean(row?.isActive);
}

async function findLocalTrainingManagerByFirebaseUid(uid: string): Promise<ManagerRow | null> {
  const firebaseUid = normalizeOperatorFirebaseUid(uid);
  if (!firebaseUid) return null;

  const row = await prisma.training_managers.findUnique({
    where: { firebaseUid },
    include: managerInclude,
  });
  return isActiveManager(row) ? row : null;
}

async function findLocalTrainingManagerByEmail(email: string): Promise<ManagerRow | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;

  const row = await prisma.training_managers.findFirst({
    where: {
      isActive: true,
      email: { equals: trimmed, mode: "insensitive" },
    },
    include: managerInclude,
  });
  return isActiveManager(row) ? row : null;
}

async function backfillFirebaseUidIfNeeded(
  row: ManagerRow,
  signedInUid: string,
): Promise<ManagerRow> {
  const firebaseUid = normalizeOperatorFirebaseUid(signedInUid);
  if (!firebaseUid) return row;

  const existing = normalizeOperatorFirebaseUid(row.firebaseUid);
  if (existing === firebaseUid) return row;
  if (existing) return row;

  return prisma.training_managers.update({
    where: { id: row.id },
    data: { firebaseUid },
    include: managerInclude,
  });
}

export type TrainingManagerMeResult =
  | { ok: true; manager: TrainingManager }
  | { ok: false; status: number; error: string };

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

  let row = await findLocalTrainingManagerByFirebaseUid(firebase.user.uid);
  if (!row && firebase.user.email) {
    row = await findLocalTrainingManagerByEmail(firebase.user.email);
    if (row) {
      row = await backfillFirebaseUidIfNeeded(row, firebase.user.uid);
    }
  }

  if (!row) {
    return { ok: false, status: 403, error: "Not a Training Manager" };
  }

  return { ok: true, manager: toManager(row) };
}
