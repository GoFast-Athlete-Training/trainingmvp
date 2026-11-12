import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { parseRaceWeekSlots } from "@/lib/training/race-week-slots";

const phasePresetInclude = {
  include: {
    longRunConfig: { select: { name: true } },
    easyConfig: { select: { name: true } },
    tempoConfig: { select: { name: true } },
    intervalsConfig: { select: { name: true } },
  },
} as const;

export const presetValidateInclude = {
  persona: true,
  goal: { include: { persona: true } },
  baseBuildPreset: true,
  buildPreset: true,
  taperPreset: true,
  raceWeekPreset: true,
  baseBuildPhasePreset: phasePresetInclude,
  buildToPeakPhasePreset: phasePresetInclude,
  taperPhasePreset: phasePresetInclude,
  raceWeekPhasePreset: phasePresetInclude,
} as const satisfies Prisma.training_plan_presetInclude;

export type PresetValidateRow = Prisma.training_plan_presetGetPayload<{
  include: typeof presetValidateInclude;
}>;

export async function loadPresetValidateRow(presetId: string): Promise<PresetValidateRow | null> {
  return prisma.training_plan_preset.findUnique({
    where: { id: presetId },
    include: presetValidateInclude,
  });
}

export async function loadAllPresetValidateRows(): Promise<PresetValidateRow[]> {
  return prisma.training_plan_preset.findMany({
    orderBy: { updatedAt: "desc" },
    include: presetValidateInclude,
  });
}

export function raceWeekSlotsSummary(slotsJson: unknown): string {
  const slots = parseRaceWeekSlots(slotsJson);
  if (slots.length === 0) return "(no slots)";
  return slots
    .map(
      (s) =>
        `D${s.offsetFromRace}: ${s.runName} [${s.type}]${s.prescribedMiles != null ? ` ${s.prescribedMiles}mi` : ""}`,
    )
    .join("; ");
}
