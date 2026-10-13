import { prisma } from "@/lib/prisma";
import { pushPresetToProd } from "@/lib/training/push-preset-to-prod";

export async function syncPresetsToProd(opts: {
  presetIds: string[];
  authorization: string;
  staffId: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string; presetId?: string }> {
  const ids = [...new Set(opts.presetIds.filter(Boolean))];
  if (ids.length === 0) return { ok: true };

  for (const presetId of ids) {
    const result = await pushPresetToProd({
      presetId,
      authorization: opts.authorization,
      staffId: opts.staffId,
    });
    if (!result.ok) {
      return { ...result, presetId };
    }
  }
  return { ok: true };
}

/** @deprecated fire-and-forget — prefer syncPresetsToProd on save */
export function schedulePresetProdSync(opts: {
  presetIds: string[];
  authorization: string;
  staffId: string;
}): void {
  void syncPresetsToProd(opts).then((result) => {
    if (!result.ok) {
      console.warn("[schedulePresetProdSync]", result.presetId, result.status, result.error);
    }
  });
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
