import { forwardProdPresetStaffRequest } from "@/lib/training/prod-preset-staff-proxy";
import { parseRaceWeekSlots } from "@/lib/training/race-week-slots";

export type PhasePresetValidateSlice = {
  name?: string;
  longRunConfig?: { name?: string } | null;
  easyConfig?: { name?: string } | null;
  tempoConfig?: { name?: string } | null;
  intervalsConfig?: { name?: string } | null;
};

export type PresetValidateRow = {
  id: string;
  slug: string;
  title?: string | null;
  description?: string | null;
  publicDescription?: string | null;
  targetDistanceLabel?: string | null;
  minWeeklyMiles?: number | null;
  maxWeeklyMiles?: number | null;
  entryLongRunMiles?: number | null;
  peakLongRunMiles?: number | null;
  baseEndWeeklyMiles?: number | null;
  longRunCutback?: number | null;
  taperWeek1TotalMiles?: number | null;
  taperWeek1LongRunMiles?: number | null;
  taperWeek2TotalMiles?: number | null;
  taperWeek2LongRunMiles?: number | null;
  raceWeekDayMiles?: unknown;
  paceNudgeSecPerMile?: number | null;
  coachIntent?: string | null;
  objectiveOfPlan?: string | null;
  baseBuildPhasePresetId?: string | null;
  buildToPeakPhasePresetId?: string | null;
  taperPhasePresetId?: string | null;
  raceWeekPhasePresetId?: string | null;
  baseBuildPhasePreset?: PhasePresetValidateSlice | null;
  buildToPeakPhasePreset?: PhasePresetValidateSlice | null;
  taperPhasePreset?: PhasePresetValidateSlice | null;
  raceWeekPhasePreset?: PhasePresetValidateSlice | null;
  persona?: Record<string, unknown> | null;
  goal?: Record<string, unknown> | null;
  baseBuildPreset?: Record<string, unknown> | null;
  buildPreset?: Record<string, unknown> | null;
  taperPreset?: Record<string, unknown> | null;
  raceWeekPreset?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type ProdStaffCredentials = {
  authorization: string;
  staffId: string;
};

async function fetchStaffPreset(
  presetId: string,
  auth: ProdStaffCredentials,
): Promise<PresetValidateRow | null> {
  const res = await forwardProdPresetStaffRequest({
    authorization: auth.authorization,
    staffId: auth.staffId,
    path: `/api/training/plan-preset/${encodeURIComponent(presetId)}`,
    method: "GET",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { preset?: Record<string, unknown> };
  const preset = json.preset;
  if (!preset || typeof preset.id !== "string") return null;
  return {
    ...preset,
    id: preset.id,
    slug: typeof preset.slug === "string" ? preset.slug : preset.id,
  } as PresetValidateRow;
}

export async function loadPresetValidateRow(
  presetId: string,
  auth: ProdStaffCredentials,
): Promise<PresetValidateRow | null> {
  return fetchStaffPreset(presetId, auth);
}

export async function loadAllPresetValidateRows(
  auth: ProdStaffCredentials,
): Promise<PresetValidateRow[]> {
  const res = await forwardProdPresetStaffRequest({
    authorization: auth.authorization,
    staffId: auth.staffId,
    path: "/api/training/plan-preset",
    method: "GET",
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { presets?: PresetValidateRow[] };
  return json.presets ?? [];
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
