export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { getRotationConfig, patchRotationConfig } from "@/lib/training/rotation-config-api";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const row = await getRotationConfig("easy", id);
  if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, config: row });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Parameters<typeof patchRotationConfig>[2];
  const row = await patchRotationConfig("easy", id, body);
  return NextResponse.json({ success: true, config: row });
}
