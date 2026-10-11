export const dynamic = "force-dynamic";

import { assertStaffForward } from "@/lib/staff-forward-auth";
import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

async function assertPickerAuth(request: NextRequest) {
  const forward = await assertStaffForward(request);
  if (forward.ok) return null;
  const auth = await assertTrainingManagerAuth(request);
  return auth.error;
}

/** HQ workout-picker persist — apply rotations in Training Manage wizard for now. */
export async function POST(_request: NextRequest, { params }: Params) {
  const authError = await assertPickerAuth(_request);
  if (authError) return authError;
  await params;
  return NextResponse.json(
    {
      success: false,
      error:
        "Apply rotation configs in Training Manage (dashboard → presets). HQ picker preview still works; persist is satellite-only until parity lands.",
    },
    { status: 501 },
  );
}
