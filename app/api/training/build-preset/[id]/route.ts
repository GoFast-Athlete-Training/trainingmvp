export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import {
  buildPresetInclude,
  serializeBuildPhasePreset,
} from "@/lib/training/phase-preset-serialize";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

function numOrNull(v: unknown): number | null | undefined {
  if (v === null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

function intOrUndef(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
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
  const row = await prisma.build_preset.findUnique({ where: { id }, include: buildPresetInclude });
  if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, build: serializeBuildPhasePreset(row) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();

  const ints = [
    ["longRunCycleWeeks", body.longRunCycleWeeks],
    ["minWeeklyMiles", body.minWeeklyMiles],
    ["maxWeeklyMiles", body.maxWeeklyMiles],
    ["tempoIdealDow", body.tempoIdealDow],
    ["intervalIdealDow", body.intervalIdealDow],
    ["longRunDefaultDow", body.longRunDefaultDow],
  ] as const;
  for (const [key, val] of ints) {
    const n = intOrUndef(val);
    if (n !== undefined) data[key] = n;
    if (val === null) data[key] = null;
  }

  const floats = [
    ["baseLongRunPoolMiles", body.baseLongRunPoolMiles],
    ["peakLongRunPoolMiles", body.peakLongRunPoolMiles],
    ["taperLongRunPoolMiles", body.taperLongRunPoolMiles],
  ] as const;
  for (const [key, val] of floats) {
    const n = numOrNull(val);
    if (n !== undefined) data[key] = n;
  }

  if (body.easyRunConfig !== undefined) data.easyRunConfig = body.easyRunConfig;
  if (body.coachPlanOverview !== undefined) data.coachPlanOverview = body.coachPlanOverview;
  if (body.workoutStructure !== undefined) data.workoutStructure = body.workoutStructure;

  for (const key of ["longRunConfigId", "easyConfigId", "tempoConfigId", "intervalsConfigId"] as const) {
    const v = configId(body, key);
    if (v !== undefined) data[key] = v;
  }

  const row = await prisma.build_preset.update({
    where: { id },
    data,
    include: buildPresetInclude,
  });
  return NextResponse.json({ success: true, build: serializeBuildPhasePreset(row) });
}
