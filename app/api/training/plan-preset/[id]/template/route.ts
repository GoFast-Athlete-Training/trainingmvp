export const dynamic = "force-dynamic";

import { assertFirebaseBearerOnly } from "@/lib/auth/firebase-bearer-only";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

/** Distance template metadata for athlete preset create — Prod forwards Firebase Bearer. */
export async function GET(request: NextRequest, { params }: Params) {
  const authError = await assertFirebaseBearerOnly(request);
  if (authError) return authError;

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
