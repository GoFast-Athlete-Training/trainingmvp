export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, _ctx: Params) {
  return NextResponse.json(
    {
      success: false,
      error: "Preset templates are served from prod, not Training Manage.",
    },
    { status: 410 },
  );
}
