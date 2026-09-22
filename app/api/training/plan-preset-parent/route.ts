export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { serializeParentPreset } from "@/lib/training/preset-serialize";
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

  const rows = await prisma.training_plan_preset_parent.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      buildPreset: true,
      taperPreset: true,
      raceWeekPreset: { include: { shakeoutRunConfig: true } },
    },
  });

  return NextResponse.json({
    success: true,
    parents: rows.map(serializeParentPreset),
  });
}

export async function POST(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    buildPresetId?: string;
  };

  if (!body.buildPresetId) {
    return NextResponse.json({ success: false, error: "buildPresetId required" }, { status: 400 });
  }

  const build = await prisma.training_plan_preset.findUnique({ where: { id: body.buildPresetId } });
  if (!build) {
    return NextResponse.json({ success: false, error: "Build preset not found" }, { status: 404 });
  }

  const title = body.title?.trim() || `${build.title} (program)`;
  const baseSlug = slugify(title);
  let slug = baseSlug || `parent-${Date.now()}`;
  let n = 0;
  while (await prisma.training_plan_preset_parent.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${baseSlug}-${n}`;
  }

  const row = await prisma.training_plan_preset_parent.create({
    data: {
      slug,
      title,
      buildPresetId: body.buildPresetId,
    },
    include: {
      buildPreset: true,
      taperPreset: true,
      raceWeekPreset: { include: { shakeoutRunConfig: true } },
    },
  });

  return NextResponse.json({ success: true, parent: serializeParentPreset(row) });
}
