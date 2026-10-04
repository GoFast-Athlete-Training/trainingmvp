import { assertTrainingManagerForward, STAFF_ID_HEADER } from "@/lib/auth/training-manager-auth";
import { NextRequest, NextResponse } from "next/server";

export { STAFF_ID_HEADER };

export type StaffForwardActor = {
  staffId: string;
};

/** Human lane — Bearer + active training_managers seat (Company send / import). */
export async function assertStaffForward(
  request: NextRequest,
): Promise<
  | { ok: true; actor: StaffForwardActor }
  | { ok: false; response: NextResponse }
> {
  const forward = await assertTrainingManagerForward(request);
  if (!forward.ok) return forward;

  return { ok: true, actor: { staffId: forward.manager.id } };
}
