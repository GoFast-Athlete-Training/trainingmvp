import { getAdminAuth } from "@/lib/firebaseAdmin";

export type VerifiedFirebaseUser = {
  uid: string;
  email: string;
  name: string | null;
};

/** Verify Firebase ID token locally (gofast-nextapp) — no Company hop. */
export async function verifyFirebaseBearer(
  token: string,
): Promise<
  | { ok: true; user: VerifiedFirebaseUser }
  | { ok: false; error: "invalid_token"; detail?: string }
> {
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const email = decoded.email?.trim().toLowerCase() ?? "";
    const displayName = (decoded as { displayName?: unknown }).displayName;
    const nameFromToken =
      (typeof decoded.name === "string" && decoded.name.trim()) ||
      (typeof displayName === "string" && displayName.trim()) ||
      null;

    return {
      ok: true,
      user: { uid: decoded.uid, email, name: nameFromToken },
    };
  } catch (err) {
    const detail =
      err instanceof Error ? err.message : "Invalid or expired sign-in token";
    return { ok: false, error: "invalid_token", detail };
  }
}
