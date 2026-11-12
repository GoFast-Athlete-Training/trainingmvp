/** Shared columns for preset ingest and the preset patch CSV. */

export const PRESET_MILE_FIELDS = [
  "minWeeklyMiles",
  "maxWeeklyMiles",
  "entryLongRunMiles",
  "peakLongRunMiles",
  "baseEndWeeklyMiles",
  "longRunCutback",
  "taperWeek1TotalMiles",
  "taperWeek1LongRunMiles",
  "taperWeek2TotalMiles",
  "taperWeek2LongRunMiles",
  "raceWeekDayMiles",
  "paceNudgeSecPerMile",
] as const;

export const PHASE_ROLES = [
  {
    key: "baseBuild",
    nameField: "baseBuildPhaseName",
    pointer: "baseBuildPhasePresetId",
  },
  {
    key: "buildToPeak",
    nameField: "buildToPeakPhaseName",
    pointer: "buildToPeakPhasePresetId",
  },
  {
    key: "taper",
    nameField: "taperPhaseName",
    pointer: "taperPhasePresetId",
  },
  {
    key: "raceWeek",
    nameField: "raceWeekPhaseName",
    pointer: "raceWeekPhasePresetId",
  },
] as const;

export const SLOT_KINDS = [
  { suffix: "LongRun", kind: "longRun", column: "longRunConfigId" },
  { suffix: "Easy", kind: "easy", column: "easyConfigId" },
  { suffix: "Tempo", kind: "tempo", column: "tempoConfigId" },
  { suffix: "Intervals", kind: "intervals", column: "intervalsConfigId" },
] as const;

export type PhasePointerField = (typeof PHASE_ROLES)[number]["pointer"];
export type PhaseNameField = (typeof PHASE_ROLES)[number]["nameField"];
export type SlotKind = (typeof SLOT_KINDS)[number]["kind"];
export type SlotColumn = (typeof SLOT_KINDS)[number]["column"];

export const PHASE_NAME_FIELDS = [
  "baseBuildPhaseName",
  "buildToPeakPhaseName",
  "taperPhaseName",
  "raceWeekPhaseName",
] as const;

export const PHASE_SLOT_FIELDS = [
  "baseBuildLongRun",
  "baseBuildEasy",
  "baseBuildTempo",
  "baseBuildIntervals",
  "buildToPeakLongRun",
  "buildToPeakEasy",
  "buildToPeakTempo",
  "buildToPeakIntervals",
  "taperLongRun",
  "taperEasy",
  "taperTempo",
  "taperIntervals",
  "raceWeekLongRun",
  "raceWeekEasy",
  "raceWeekTempo",
  "raceWeekIntervals",
] as const;

export const PHASE_SHAPE_FIELDS = [...PHASE_NAME_FIELDS, ...PHASE_SLOT_FIELDS] as const;

const PHASE_SHAPE_SET = new Set<string>(PHASE_SHAPE_FIELDS);
const SLOT_FIELD_SET = new Set<string>(PHASE_SLOT_FIELDS);
const NAME_FIELD_SET = new Set<string>(PHASE_NAME_FIELDS);

export function isPhaseShapeField(field: string): boolean {
  return PHASE_SHAPE_SET.has(field);
}

export function isPhaseSlotField(field: string): boolean {
  return SLOT_FIELD_SET.has(field);
}

export function isPhaseNameField(field: string): boolean {
  return NAME_FIELD_SET.has(field);
}

export function formatRaceWeekDayMiles(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  const parts: string[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const offset = Number(row.offsetFromRace);
    const miles = Number(row.prescribedMiles);
    if (!Number.isFinite(offset) || !Number.isFinite(miles)) continue;
    parts.push(`${offset}:${miles}`);
  }
  return parts.join(";");
}

export function parseRaceWeekDayMilesCell(
  raw: string,
): { offsetFromRace: number; prescribedMiles: number }[] | { error: string } {
  const text = raw.trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) return { error: "raceWeekDayMiles must be a list" };
      return parseRaceWeekParts(
        parsed.map((item) => {
          if (item == null || typeof item !== "object") return "";
          const row = item as Record<string, unknown>;
          return `${row.offsetFromRace}:${row.prescribedMiles ?? ""}`;
        }),
      );
    } catch {
      return { error: "raceWeekDayMiles is not valid JSON" };
    }
  }
  return parseRaceWeekParts(text.split(/[;|]/));
}

function parseRaceWeekParts(
  parts: string[],
): { offsetFromRace: number; prescribedMiles: number }[] | { error: string } {
  const rows: { offsetFromRace: number; prescribedMiles: number }[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [offsetRaw, milesRaw] = trimmed.split(":");
    const offset = Number(offsetRaw);
    const miles = Number(milesRaw);
    if (!Number.isFinite(offset) || !Number.isFinite(miles)) {
      return { error: `raceWeekDayMiles entry “${trimmed}” must look like -6:4` };
    }
    rows.push({ offsetFromRace: offset, prescribedMiles: miles });
  }
  return rows;
}
