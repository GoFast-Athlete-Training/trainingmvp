export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const row = await prisma.long_run_config.findUnique({
    where: { id },
    include: { positions: { orderBy: { cyclePosition: "asc" } } },
  });

  if (!row) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, config: row });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    positions?: Array<{
      cyclePosition: number;
      catalogueWorkoutId?: string | null;
      distributionWeight?: number;
    }>;
  };

  if (typeof body.name === "string") {
    await prisma.long_run_config.update({ where: { id }, data: { name: body.name.trim() } });
  }

  if (Array.isArray(body.positions)) {
    for (const pos of body.positions) {
      await prisma.long_run_config_position.updateMany({
        where: { longRunConfigId: id, cyclePosition: pos.cyclePosition },
        data: {
          catalogueWorkoutId: pos.catalogueWorkoutId ?? null,
          ...(typeof pos.distributionWeight === "number"
            ? { distributionWeight: pos.distributionWeight }
            : {}),
        },
      });
    }
  }

  const row = await prisma.long_run_config.findUnique({
    where: { id },
    include: { positions: { orderBy: { cyclePosition: "asc" } } },
  });

  return NextResponse.json({ success: true, config: row });
}
