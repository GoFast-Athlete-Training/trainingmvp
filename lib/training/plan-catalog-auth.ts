import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { assertStaffForward } from "@/lib/staff-forward-auth";
import { NextRequest } from "next/server";

/** HQ staff-forward or local Training Manager — same as plan-preset list. */
export async function assertPlanCatalogAuth(request: NextRequest) {
  const forward = await assertStaffForward(request);
  if (forward.ok) return null;
  const auth = await assertTrainingManagerAuth(request);
  return auth.error;
}
