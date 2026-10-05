import { assertTrainingManagerForward } from "@/lib/auth/training-manager-auth";
import { NextRequest, NextResponse } from "next/server";

export type StaffForwardActor = {
  staffId: string;
};

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
