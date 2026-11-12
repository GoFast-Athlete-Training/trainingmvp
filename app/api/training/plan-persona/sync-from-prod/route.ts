export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: "Training Manage no longer stores a local persona/goal catalog — prod is source of truth.",
    personas: 0,
    goals: 0,
  });
}
