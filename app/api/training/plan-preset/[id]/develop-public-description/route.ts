export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { buildPresetInclude } from "@/lib/training/phase-preset-include";
import { runOpenAiJsonAgent } from "@/lib/training/openai-json";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const preset = await prisma.training_plan_preset.findUnique({
    where: { id },
    include: {
      buildPreset: { include: buildPresetInclude },
      taperPreset: true,
    },
  });
  if (!preset) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const context = {
    title: preset.title,
    targetDistanceLabel: preset.targetDistanceLabel,
    planDurationWeeks: preset.planDurationWeeks,
    staffDescription: preset.description,
    build: preset.buildPreset
      ? {
          startLongRunMiles: preset.buildPreset.startLongRunMiles,
          peakLongRunMiles: preset.buildPreset.peakLongRunMiles,
          maxWeeklyMiles: preset.buildPreset.maxWeeklyMiles,
          longRun: preset.buildPreset.longRunConfig?.name ?? null,
          easy: preset.buildPreset.easyConfig?.name ?? null,
          tempo: preset.buildPreset.tempoConfig?.name ?? null,
          intervals: preset.buildPreset.intervalsConfig?.name ?? null,
        }
      : null,
  };

  try {
    const result = await runOpenAiJsonAgent<{ publicDescription: string }>({
      systemPrompt: `You write athlete-facing training plan descriptions for GoFast.
Output JSON: { "publicDescription": "..." }
2-4 short sentences. Encouraging, clear, no jargon. No internal staff notes. No mile-by-mile schedules.`,
      userPrompt: JSON.stringify(context, null, 2),
    });
    const text = result.publicDescription?.trim();
    if (!text) {
      return NextResponse.json({ success: false, error: "Empty draft" }, { status: 502 });
    }
    return NextResponse.json({ success: true, publicDescription: text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI failed";
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}
