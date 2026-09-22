export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const rows = await prisma.shakeout_run_config.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ success: true, configs: rows });
}

export async function POST(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    totalMiles?: number;
    paceOffsetSecPerMile?: number;
  };

  const row = await prisma.shakeout_run_config.create({
    data: {
      name: body.name?.trim() || "Race shakeout",
      totalMiles: body.totalMiles ?? 3,
      paceOffsetSecPerMile: body.paceOffsetSecPerMile ?? 0,
    },
  });

  return NextResponse.json({ success: true, config: row });
}
