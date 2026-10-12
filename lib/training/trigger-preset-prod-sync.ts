import { prisma } from "@/lib/prisma";
import { pushPresetToProd } from "@/lib/training/push-preset-to-prod";

/** Fire-and-forget prod mirror after TM save; logs failures only. */
export function schedulePresetProdSync(opts: {
  presetIds: string[];
  authorization: string;
  staffId: string;
}): void {
  const ids = [...new Set(opts.presetIds.filter(Boolean))];
  if (ids.length === 0) return;

  void (async () => {
    for (const presetId of ids) {
      const result = await pushPresetToProd({
        presetId,
        authorization: opts.authorization,
        staffId: opts.staffId,
      });
      if (!result.ok) {
        console.warn("[schedulePresetProdSync]", presetId, result.status, result.error);
      }
    }
  })();
}

export async function presetIdsLinkedToBuildPreset(buildPresetId: string): Promise<string[]> {
  const rows = await prisma.training_plan_preset.findMany({
    where: { buildPresetId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function presetIdsLinkedToTaperPreset(taperPresetId: string): Promise<string[]> {
  const rows = await prisma.training_plan_preset.findMany({
    where: { taperPresetId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function presetIdsLinkedToRaceWeekPreset(raceWeekPresetId: string): Promise<string[]> {
  const rows = await prisma.training_plan_preset.findMany({
    where: { raceWeekPresetId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
