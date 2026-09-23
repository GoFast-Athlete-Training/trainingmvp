export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { createRotationConfig, listRotationConfigs } from "@/lib/training/rotation-config-api";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const configs = await listRotationConfigs("intervals");
  return NextResponse.json({ success: true, configs });
}

export async function POST(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => ({}))) as { name?: string; positionCount?: number };
  const row = await createRotationConfig(
    "intervals",
    body.name?.trim() || "Intervals rotation",
    body.positionCount ?? 4,
  );
  return NextResponse.json({ success: true, config: row });
}
