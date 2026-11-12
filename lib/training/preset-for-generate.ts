export type TrainingManagePresetForGenerate = {
  id: string;
  slug: string;
  title: string;
  build: Record<string, unknown> | null;
  [key: string]: unknown;
};

/** Generate loads presets from prod DB — Training Manage has no local catalog. */
export async function loadPresetForGenerate(
  _presetId: string,
): Promise<TrainingManagePresetForGenerate | null> {
  return null;
}
