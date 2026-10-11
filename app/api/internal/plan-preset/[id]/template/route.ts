export const dynamic = "force-dynamic";

import { verifyInternalApiKey } from "@/lib/internal-api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

/** Machine lane — distance template metadata for athlete preset create (sourcePresetId). */
export async function GET(_request: NextRequest, { params }: Params) {
  const denied = verifyInternalApiKey(_request);
  if (denied) return denied;

  const { id } = await params;
  const row = await prisma.training_plan_preset.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      targetDistanceLabel: true,
      tempoIdealDow: true,
      intervalIdealDow: true,
      longRunDefaultDow: true,
    },
  });
  if (!row) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, preset: row });
}
