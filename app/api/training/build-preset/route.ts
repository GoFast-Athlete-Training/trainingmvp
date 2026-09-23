export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { buildPresetInclude, serializeBuildPhasePreset } from "@/lib/training/phase-preset-serialize";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const rows = await prisma.build_preset.findMany({ orderBy: { updatedAt: "desc" }, include: buildPresetInclude });
  return NextResponse.json({
    success: true,
    builds: rows.map(serializeBuildPhasePreset),
  });
}

export async function POST(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const row = await prisma.build_preset.create({
    data: { name: body.name?.trim() || "New build preset" },
    include: buildPresetInclude,
  });
  return NextResponse.json({ success: true, build: serializeBuildPhasePreset(row) });
}
