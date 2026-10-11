import { verifyFirebaseBearer } from "@/lib/auth/verify-firebase-bearer";
import { NextRequest, NextResponse } from "next/server";

/** Prod BFF / cross-app: valid gofast-nextapp Firebase token (no training_managers seat). */
export async function assertFirebaseBearerOnly(
  request: NextRequest,
): Promise<NextResponse | null> {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const token = authorization.slice("Bearer ".length).trim();
  const firebase = await verifyFirebaseBearer(token);
  if (!firebase.ok) {
    return NextResponse.json(
      { success: false, error: firebase.detail ?? "Invalid or expired sign-in token" },
      { status: 401 },
    );
  }

  return null;
}
