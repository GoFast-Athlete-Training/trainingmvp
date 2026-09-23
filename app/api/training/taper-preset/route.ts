export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { taperPresetInclude, serializeTaperPhasePreset } from "@/lib/training/phase-preset-serialize";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const rows = await prisma.taper_preset.findMany({ orderBy: { updatedAt: "desc" }, include: taperPresetInclude });
  return NextResponse.json({
    success: true,
    tapers: rows.map(serializeTaperPhasePreset),
  });
}

export async function POST(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const row = await prisma.taper_preset.create({
    data: { name: body.name?.trim() || "New taper preset" },
    include: taperPresetInclude,
  });
  return NextResponse.json({ success: true, taper: serializeTaperPhasePreset(row) });
}
