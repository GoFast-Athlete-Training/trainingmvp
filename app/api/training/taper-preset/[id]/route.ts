export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import {
  taperPresetInclude,
  serializeTaperPhasePreset,
} from "@/lib/training/phase-preset-serialize";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

function numOrNull(v: unknown): number | null | undefined {
  if (v === null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

function configId(body: Record<string, unknown>, key: string): string | null | undefined {
  if (!(key in body)) return undefined;
  return typeof body[key] === "string" && body[key] ? (body[key] as string) : null;
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const row = await prisma.taper_preset.findUnique({ where: { id }, include: taperPresetInclude });
  if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, taper: serializeTaperPhasePreset(row) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();

  for (const key of [
    "week1TotalMiles",
    "week1LongRunMiles",
    "week2TotalMiles",
    "week2LongRunMiles",
  ] as const) {
    const n = numOrNull(body[key]);
    if (n !== undefined) data[key] = n;
  }

  for (const key of ["longRunConfigId", "easyConfigId", "tempoConfigId", "intervalsConfigId"] as const) {
    const v = configId(body, key);
    if (v !== undefined) data[key] = v;
  }
  if (body.weekPins !== undefined) data.weekPins = body.weekPins;

  const row = await prisma.taper_preset.update({
    where: { id },
    data,
    include: taperPresetInclude,
  });
  return NextResponse.json({ success: true, taper: serializeTaperPhasePreset(row) });
}
