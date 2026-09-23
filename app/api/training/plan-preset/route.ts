export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { serializeBuildPreset } from "@/lib/training/preset-serialize";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function GET(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const rows = await prisma.training_plan_preset.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      longRunConfig: { include: { positions: { orderBy: { cyclePosition: "asc" } } } },
      easyConfig: true,
      tempoConfig: true,
      intervalsConfig: true,
    },
  });

  return NextResponse.json({
    success: true,
    presets: rows.map(serializeBuildPreset),
  });
}

export async function POST(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    minWeeklyMiles?: number;
    maxWeeklyMiles?: number;
  };

  const title = body.title?.trim() || "New build preset";
  const maxWeeklyMiles =
    typeof body.maxWeeklyMiles === "number" && Number.isFinite(body.maxWeeklyMiles)
      ? Math.round(body.maxWeeklyMiles)
      : 55;
  const baseSlug = slugify(title);
  let slug = baseSlug || `preset-${Date.now()}`;
  let n = 0;
  while (await prisma.training_plan_preset.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${baseSlug}-${n}`;
  }

  const row = await prisma.training_plan_preset.create({
    data: {
      slug,
      title,
      minWeeklyMiles: body.minWeeklyMiles ?? 40,
      maxWeeklyMiles,
      coachPlanOverview: {
        summary: title,
        weeklyVolume: { min: body.minWeeklyMiles ?? 40, max: maxWeeklyMiles },
        weeklyWorkoutComposition: {
          easy: 3,
          tempo: 1,
          intervals: 1,
          longRun: 1,
          cadenceWeeks: 1,
        },
        longRunStructure: { peakLongRunMiles: 20 },
      } as Prisma.InputJsonValue,
      baseLongRunPoolMiles: 0,
      peakLongRunPoolMiles: 0,
      taperLongRunPoolMiles: 0,
    },
    include: {
      longRunConfig: { include: { positions: true } },
      easyConfig: true,
      tempoConfig: true,
      intervalsConfig: true,
    },
  });

  return NextResponse.json({ success: true, preset: serializeBuildPreset(row) });
}
