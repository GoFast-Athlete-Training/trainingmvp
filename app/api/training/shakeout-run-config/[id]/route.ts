export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const row = await prisma.shakeout_run_config.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, config: row });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    totalMiles?: number;
    paceOffsetSecPerMile?: number;
  };

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.totalMiles === "number" && Number.isFinite(body.totalMiles)) {
    data.totalMiles = body.totalMiles;
  }
  if (typeof body.paceOffsetSecPerMile === "number" && Number.isFinite(body.paceOffsetSecPerMile)) {
    data.paceOffsetSecPerMile = Math.round(body.paceOffsetSecPerMile);
  }

  const row = await prisma.shakeout_run_config.update({ where: { id }, data });
  return NextResponse.json({ success: true, config: row });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const ex = await prisma.shakeout_run_config.findUnique({ where: { id } });
  if (!ex) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await prisma.shakeout_run_config.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
