import { getCompanyAppUrl } from "@/lib/app-urls";

export type VerifiedCompanyStaff = {
  id: string;
  email: string;
  name: string | null;
  firebaseUid: string;
};

function isRealFirebaseUid(firebaseId: string | null | undefined): firebaseId is string {
  const id = firebaseId?.trim();
  return Boolean(id && !id.startsWith("temp-"));
}

export async function verifyStaffViaCompanyFindOrCreate(
  token: string,
): Promise<
  | { ok: true; staff: VerifiedCompanyStaff }
  | { ok: false; error: string; detail?: string }
> {
  const companyUrl = getCompanyAppUrl();

  const response = await fetch(`${companyUrl}/api/staff/find-or-create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    staff?: {
      id?: string;
      email?: string | null;
      name?: string | null;
      firebaseId?: string;
    };
    error?: string;
    message?: string;
  };

  if (!response.ok || !payload.success || !payload.staff?.id) {
    return {
      ok: false,
      error: "not_company_staff",
      detail: payload.message ?? payload.error ?? "Company staff not found for this account",
    };
  }

  const firebaseUid = isRealFirebaseUid(payload.staff.firebaseId)
    ? payload.staff.firebaseId.trim()
    : null;

  if (!firebaseUid) {
    return {
      ok: false,
      error: "not_company_staff",
      detail: "Company staff has no linked Firebase account yet",
    };
  }

  return {
    ok: true,
    staff: {
      id: payload.staff.id,
      email: payload.staff.email?.trim().toLowerCase() ?? "",
      name: payload.staff.name ?? null,
      firebaseUid,
    },
  };
}
