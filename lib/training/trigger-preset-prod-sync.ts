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

export async function presetIdsLinkedToBuildPreset(_buildPresetId: string): Promise<string[]> {
  return [];
}

export async function presetIdsLinkedToTaperPreset(_taperPresetId: string): Promise<string[]> {
  return [];
}

export async function presetIdsLinkedToRaceWeekPreset(_raceWeekPresetId: string): Promise<string[]> {
  return [];
}
