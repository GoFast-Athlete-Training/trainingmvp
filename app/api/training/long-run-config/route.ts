export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const rows = await prisma.long_run_config.findMany({
    orderBy: { name: "asc" },
    include: {
      positions: { orderBy: { cyclePosition: "asc" } },
    },
  });

  return NextResponse.json({ success: true, configs: rows });
}

export async function POST(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    positionCount?: number;
  };

  const name = body.name?.trim() || "Long run rotation";
  const count = Math.max(1, Math.min(4, body.positionCount ?? 4));

  const row = await prisma.long_run_config.create({
    data: {
      name,
      positions: {
        create: Array.from({ length: count }, (_, i) => ({
          cyclePosition: i,
          distributionWeight: 1 / count,
        })),
      },
    },
    include: { positions: { orderBy: { cyclePosition: "asc" } } },
  });

  return NextResponse.json({ success: true, config: row });
}
