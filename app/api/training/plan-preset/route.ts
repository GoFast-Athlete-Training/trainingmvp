export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { assertStaffForward } from "@/lib/staff-forward-auth";
import { prisma } from "@/lib/prisma";
import { serializeBuildPreset } from "@/lib/training/preset-serialize";
import { NextRequest, NextResponse } from "next/server";

async function assertListPresetAuth(request: NextRequest) {
  const forward = assertStaffForward(request);
  if (forward.ok) return null;
  const auth = await assertTrainingManagerAuth(request);
  return auth.error;
}

export async function GET(request: NextRequest) {
  const authError = await assertListPresetAuth(request);
  if (authError) return authError;

  const rows = await prisma.training_plan_preset.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      longRunConfig: { include: { positions: { orderBy: { cyclePosition: "asc" } } } },
      easyConfig: true,
      tempoConfig: true,
      intervalsConfig: true,
      buildPreset: { select: { id: true, name: true } },
      taperPreset: { select: { id: true, name: true } },
      raceWeekPreset: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json({
    success: true,
    presets: rows.map(serializeBuildPreset),
  });
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Minimal plan preset + empty linked build, taper, and race week for the wizard. */
export async function POST(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { title?: string };
  const title = body.title?.trim() || "Untitled";
  const baseSlug = slugify(title);
  let slug = baseSlug || `preset-${Date.now()}`;
  let n = 0;
  while (await prisma.training_plan_preset.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${baseSlug || "preset"}-${n}`;
  }

  const preset = await prisma.$transaction(async (tx) => {
    return tx.training_plan_preset.create({
      data: {
        slug,
        title,
        description: "",
      },
      include: {
        longRunConfig: { include: { positions: { orderBy: { cyclePosition: "asc" } } } },
        easyConfig: true,
        tempoConfig: true,
        intervalsConfig: true,
        buildPreset: { select: { id: true, name: true } },
        taperPreset: { select: { id: true, name: true } },
        raceWeekPreset: { select: { id: true, title: true } },
      },
    });
  });

  return NextResponse.json({ success: true, preset: serializeBuildPreset(preset) });
}
