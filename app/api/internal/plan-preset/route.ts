export const dynamic = "force-dynamic";

import { verifyInternalApiKey } from "@/lib/internal-api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/** Machine lane — athlete catalog picker on prod (public fields only). */
export async function GET(request: NextRequest) {
  const denied = verifyInternalApiKey(request);
  if (denied) return denied;

  const rows = await prisma.training_plan_preset.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      publicDescription: true,
      targetDistanceLabel: true,
      minWeeklyMiles: true,
      maxWeeklyMiles: true,
      tempoIdealDow: true,
      intervalIdealDow: true,
      longRunDefaultDow: true,
      snapPeakLongRunMiles: true,
    },
  });

  return NextResponse.json({ success: true, presets: rows });
}
