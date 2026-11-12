export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

/** Athlete catalog is served from prod (`/api/training/plan-preset/prod`). */
export async function GET(_request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: "Use prod plan-preset catalog (GOFAST_APP_API_URL /api/training/plan-preset/prod).",
    },
    { status: 410 },
  );
}
