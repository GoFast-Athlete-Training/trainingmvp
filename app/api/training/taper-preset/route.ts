export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { serializeBuildPreset } from "@/lib/training/preset-serialize";
import { NextRequest, NextResponse } from "next/server";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Create a taper preset: training_plan_preset + 2-position long_run_config (14 then 12). */
export async function POST(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    week1CatalogueId?: string | null;
    week2CatalogueId?: string | null;
  };

  const title = body.title?.trim() || "Marathon taper";
  const lrConfig = await prisma.long_run_config.create({
    data: {
      name: `${title} LR`,
      positions: {
        create: [
          { cyclePosition: 0, distributionWeight: 0.5, catalogueWorkoutId: body.week1CatalogueId ?? null },
          { cyclePosition: 1, distributionWeight: 0.5, catalogueWorkoutId: body.week2CatalogueId ?? null },
        ],
      },
    },
  });

  const baseSlug = slugify(title);
  let slug = baseSlug || `taper-${Date.now()}`;
  let n = 0;
  while (await prisma.training_plan_preset.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${baseSlug}-${n}`;
  }

  const preset = await prisma.training_plan_preset.create({
    data: {
      slug,
      title,
      minWeeklyMiles: 30,
      longRunCycleWeeks: 2,
      longRunConfigId: lrConfig.id,
      baseLongRunPoolMiles: 0,
      peakLongRunPoolMiles: 0,
      taperLongRunPoolMiles: 0,
    },
    include: {
      longRunConfig: { include: { positions: { orderBy: { cyclePosition: "asc" } } } },
      easyConfig: true,
      tempoConfig: true,
      intervalsConfig: true,
    },
  });

  return NextResponse.json({ success: true, taperPreset: serializeBuildPreset(preset) });
}
