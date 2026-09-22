export const dynamic = "force-dynamic";

import { requireTrainingManagerByTokenOnlyWithDetail } from "@/lib/auth/training-manager-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const result = await requireTrainingManagerByTokenOnlyWithDetail(request);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true, manager: result.manager });
}
