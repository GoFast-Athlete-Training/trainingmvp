export const dynamic = "force-dynamic";

import { assertFirebaseBearerOnly } from "@/lib/auth/firebase-bearer-only";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/** Athlete catalog (public fields) — called from Prod with forwarded Firebase Bearer, not internal key. */
export async function GET(request: NextRequest) {
  const authError = await assertFirebaseBearerOnly(request);
  if (authError) return authError;

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
