import { TARGET_DISTANCE_OPTIONS } from "@/lib/training/race-distance-presets";
import {
  parseRaceWeekDayMilesCell,
  PHASE_NAME_FIELDS,
  PHASE_SLOT_FIELDS,
  PRESET_MILE_FIELDS,
} from "@/lib/training/preset-shape-columns";

/** Written onto the training preset, its phase pointers, and the named phase presets. */
export const PRESET_INGEST_STORED_COLUMNS = [
  "title",
  "targetDistance",
  ...PRESET_MILE_FIELDS,
  ...PHASE_NAME_FIELDS,
  ...PHASE_SLOT_FIELDS,
  "personaSlug",
] as const;

export const PRESET_INGEST_REQUIRED_COLUMNS = [
  "title",
  "minWeeklyMiles",
  "maxWeeklyMiles",
  "entryLongRunMiles",
  "peakLongRunMiles",
] as const;

/** Shown in preview; not written to prod in this pass. */
export const PRESET_INGEST_PREVIEW_ONLY_COLUMNS = [
  "durationWeeks",
  "suggestedEasyOffsetSec",
  "suggestedLongRunOffsetSec",
  "suggestedThresholdOffsetSec",
  "suggestedIntervalOffsetSec",
] as const;

export const PRESET_INGEST_CSV_COLUMNS = [
  ...PRESET_INGEST_STORED_COLUMNS,
  ...PRESET_INGEST_PREVIEW_ONLY_COLUMNS,
] as const;

export type PresetIngestCsvColumn = (typeof PRESET_INGEST_CSV_COLUMNS)[number];

export type PresetIngestRowInput = {
  title: string;
  targetDistance: string;
  minWeeklyMiles: number | null;
  maxWeeklyMiles: number | null;
  entryLongRunMiles: number | null;
  peakLongRunMiles: number | null;
  baseEndWeeklyMiles: number | null;
  longRunCutback: number | null;
  taperWeek1TotalMiles: number | null;
  taperWeek1LongRunMiles: number | null;
  taperWeek2TotalMiles: number | null;
  taperWeek2LongRunMiles: number | null;
  raceWeekDayMiles: string;
  paceNudgeSecPerMile: number | null;
  baseBuildPhaseName: string;
  buildToPeakPhaseName: string;
  taperPhaseName: string;
  raceWeekPhaseName: string;
  baseBuildLongRun: string;
  baseBuildEasy: string;
  baseBuildTempo: string;
  baseBuildIntervals: string;
  buildToPeakLongRun: string;
  buildToPeakEasy: string;
  buildToPeakTempo: string;
  buildToPeakIntervals: string;
  taperLongRun: string;
  taperEasy: string;
  taperTempo: string;
  taperIntervals: string;
  raceWeekLongRun: string;
  raceWeekEasy: string;
  raceWeekTempo: string;
  raceWeekIntervals: string;
  personaSlug: string;
  durationWeeks: number | null;
  suggestedEasyOffsetSec: number | null;
  suggestedLongRunOffsetSec: number | null;
  suggestedThresholdOffsetSec: number | null;
  suggestedIntervalOffsetSec: number | null;
};

export type PresetIngestPreviewRow = {
  rowIndex: number;
  row: PresetIngestRowInput;
  errors: string[];
  notStoredYet: { field: PresetIngestCsvColumn; label: string; value: string }[];
  valid: boolean;
};

const DISTANCE_CANON = new Map(
  TARGET_DISTANCE_OPTIONS.filter(Boolean).map((d) => [d.toLowerCase(), d]),
);

const COLUMN_ALIASES: Record<string, PresetIngestCsvColumn> = {
  targetdistancelabel: "targetDistance",
  target_distance: "targetDistance",
  targetdistance: "targetDistance",
  minweeklymiles: "minWeeklyMiles",
  maxweeklymiles: "maxWeeklyMiles",
  startlongrunmiles: "entryLongRunMiles",
  entrylongrunmiles: "entryLongRunMiles",
  peaklongrunmiles: "peakLongRunMiles",
  baseendweeklymiles: "baseEndWeeklyMiles",
  longruncutback: "longRunCutback",
  taperweek1totalmiles: "taperWeek1TotalMiles",
  taperweek1longrunmiles: "taperWeek1LongRunMiles",
  taperweek2totalmiles: "taperWeek2TotalMiles",
  taperweek2longrunmiles: "taperWeek2LongRunMiles",
  raceweekdaymiles: "raceWeekDayMiles",
  pacenudgesecpermile: "paceNudgeSecPerMile",
  basebuildphasename: "baseBuildPhaseName",
  buildtopeakphasename: "buildToPeakPhaseName",
  taperphasename: "taperPhaseName",
  raceweekphasename: "raceWeekPhaseName",
  personaslug: "personaSlug",
  durationweeks: "durationWeeks",
  suggestedeasyoffsetsec: "suggestedEasyOffsetSec",
  suggestedlongrunoffsetsec: "suggestedLongRunOffsetSec",
  suggestedthresholdoffsetsec: "suggestedThresholdOffsetSec",
  suggestedintervaloffsetsec: "suggestedIntervalOffsetSec",
};

const TEMPLATE_EXAMPLE: Partial<Record<PresetIngestCsvColumn, string>> = {
  title: "Marathon base 55-70",
  targetDistance: "Marathon",
  minWeeklyMiles: "55",
  maxWeeklyMiles: "70",
  entryLongRunMiles: "12",
  peakLongRunMiles: "20",
  baseEndWeeklyMiles: "45",
  longRunCutback: "0.25",
  taperWeek1TotalMiles: "40",
  taperWeek1LongRunMiles: "12",
  taperWeek2TotalMiles: "30",
  taperWeek2LongRunMiles: "8",
  raceWeekDayMiles: "-6:4;-5:5;-1:3;0:26.2",
  paceNudgeSecPerMile: "0",
  baseBuildPhaseName: "Base",
  buildToPeakPhaseName: "Build",
  taperPhaseName: "Taper",
  raceWeekPhaseName: "Race week",
  personaSlug: "advanced-runner",
  durationWeeks: "18",
};

export function presetIngestTemplateCsv(): string {
  const header = PRESET_INGEST_CSV_COLUMNS.join(",");
  const example = PRESET_INGEST_CSV_COLUMNS.map((column) => TEMPLATE_EXAMPLE[column] ?? "").join(",");
  return `${header}\n${example}\n`;
}

export function normalizeHeaderKey(raw: string): PresetIngestCsvColumn | null {
  const key = raw.trim().replace(/^\uFEFF/, "");
  if (!key) return null;
  if ((PRESET_INGEST_CSV_COLUMNS as readonly string[]).includes(key)) {
    return key as PresetIngestCsvColumn;
  }
  const alias = COLUMN_ALIASES[key.toLowerCase().replace(/[\s_-]+/g, "")];
  return alias ?? null;
}

function parseNum(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function str(raw: string | undefined): string {
  return (raw ?? "").trim();
}

export function normalizeTargetDistance(raw: string): { value: string; error?: string } {
  const t = raw.trim();
  if (!t) return { value: "" };
  const canon = DISTANCE_CANON.get(t.toLowerCase());
  if (!canon) {
    return {
      value: t,
      error: `Unknown target distance “${t}”. Use labels such as Marathon, 5K, Half Marathon.`,
    };
  }
  return { value: canon };
}

export function rowFromRecord(record: Record<string, string>): PresetIngestRowInput {
  return {
    ...EMPTY_PRESET_INGEST_ROW,
    title: str(record.title),
    targetDistance: str(record.targetDistance ?? record.targetDistanceLabel),
    minWeeklyMiles: parseNum(record.minWeeklyMiles ?? ""),
    maxWeeklyMiles: parseNum(record.maxWeeklyMiles ?? ""),
    entryLongRunMiles: parseNum(record.entryLongRunMiles ?? record.startLongRunMiles ?? ""),
    peakLongRunMiles: parseNum(record.peakLongRunMiles ?? ""),
    baseEndWeeklyMiles: parseNum(record.baseEndWeeklyMiles ?? ""),
    longRunCutback: parseNum(record.longRunCutback ?? ""),
    taperWeek1TotalMiles: parseNum(record.taperWeek1TotalMiles ?? ""),
    taperWeek1LongRunMiles: parseNum(record.taperWeek1LongRunMiles ?? ""),
    taperWeek2TotalMiles: parseNum(record.taperWeek2TotalMiles ?? ""),
    taperWeek2LongRunMiles: parseNum(record.taperWeek2LongRunMiles ?? ""),
    raceWeekDayMiles: str(record.raceWeekDayMiles),
    paceNudgeSecPerMile: parseNum(record.paceNudgeSecPerMile ?? ""),
    baseBuildPhaseName: str(record.baseBuildPhaseName),
    buildToPeakPhaseName: str(record.buildToPeakPhaseName),
    taperPhaseName: str(record.taperPhaseName),
    raceWeekPhaseName: str(record.raceWeekPhaseName),
    baseBuildLongRun: str(record.baseBuildLongRun),
    baseBuildEasy: str(record.baseBuildEasy),
    baseBuildTempo: str(record.baseBuildTempo),
    baseBuildIntervals: str(record.baseBuildIntervals),
    buildToPeakLongRun: str(record.buildToPeakLongRun),
    buildToPeakEasy: str(record.buildToPeakEasy),
    buildToPeakTempo: str(record.buildToPeakTempo),
    buildToPeakIntervals: str(record.buildToPeakIntervals),
    taperLongRun: str(record.taperLongRun),
    taperEasy: str(record.taperEasy),
    taperTempo: str(record.taperTempo),
    taperIntervals: str(record.taperIntervals),
    raceWeekLongRun: str(record.raceWeekLongRun),
    raceWeekEasy: str(record.raceWeekEasy),
    raceWeekTempo: str(record.raceWeekTempo),
    raceWeekIntervals: str(record.raceWeekIntervals),
    personaSlug: str(record.personaSlug),
    durationWeeks: parseNum(record.durationWeeks ?? ""),
    suggestedEasyOffsetSec: parseNum(record.suggestedEasyOffsetSec ?? ""),
    suggestedLongRunOffsetSec: parseNum(record.suggestedLongRunOffsetSec ?? ""),
    suggestedThresholdOffsetSec: parseNum(record.suggestedThresholdOffsetSec ?? ""),
    suggestedIntervalOffsetSec: parseNum(record.suggestedIntervalOffsetSec ?? ""),
  };
}

export function validatePresetIngestRow(
  row: PresetIngestRowInput,
  rowIndex: number,
): PresetIngestPreviewRow {
  const errors: string[] = [];

  if (!row.title) errors.push("title is required");

  const dist = normalizeTargetDistance(row.targetDistance);
  if (dist.error) errors.push(dist.error);

  for (const [label, val] of [
    ["minWeeklyMiles", row.minWeeklyMiles],
    ["maxWeeklyMiles", row.maxWeeklyMiles],
    ["entryLongRunMiles", row.entryLongRunMiles],
    ["peakLongRunMiles", row.peakLongRunMiles],
  ] as const) {
    if (val == null) errors.push(`${label} is required`);
    else if (val <= 0) errors.push(`${label} must be greater than 0`);
  }

  if (
    row.minWeeklyMiles != null &&
    row.maxWeeklyMiles != null &&
    row.maxWeeklyMiles < row.minWeeklyMiles
  ) {
    errors.push("maxWeeklyMiles must be at least minWeeklyMiles");
  }

  if (
    row.entryLongRunMiles != null &&
    row.peakLongRunMiles != null &&
    row.peakLongRunMiles < row.entryLongRunMiles
  ) {
    errors.push("peakLongRunMiles must be at least entryLongRunMiles");
  }

  for (const [label, val] of [
    ["baseEndWeeklyMiles", row.baseEndWeeklyMiles],
    ["taperWeek1TotalMiles", row.taperWeek1TotalMiles],
    ["taperWeek1LongRunMiles", row.taperWeek1LongRunMiles],
    ["taperWeek2TotalMiles", row.taperWeek2TotalMiles],
    ["taperWeek2LongRunMiles", row.taperWeek2LongRunMiles],
  ] as const) {
    if (val != null && val <= 0) errors.push(`${label} must be greater than 0`);
  }

  if (row.paceNudgeSecPerMile != null && (row.paceNudgeSecPerMile < -180 || row.paceNudgeSecPerMile > 180)) {
    errors.push("paceNudgeSecPerMile must be between -180 and 180");
  }
  if (row.longRunCutback != null && (row.longRunCutback < 0 || row.longRunCutback > 1)) {
    errors.push("longRunCutback must be between 0 and 1");
  }
  const dayMiles = row.raceWeekDayMiles.trim();
  if (dayMiles) {
    const parsed = parseRaceWeekDayMilesCell(dayMiles);
    if ("error" in parsed) errors.push(parsed.error);
  }

  const notStoredYet: PresetIngestPreviewRow["notStoredYet"] = [];
  const previewFields: {
    field: PresetIngestCsvColumn;
    label: string;
    value: number | null;
  }[] = [
    { field: "durationWeeks", label: "durationWeeks", value: row.durationWeeks },
    {
      field: "suggestedEasyOffsetSec",
      label: "suggestedEasyOffsetSec",
      value: row.suggestedEasyOffsetSec,
    },
    {
      field: "suggestedLongRunOffsetSec",
      label: "suggestedLongRunOffsetSec",
      value: row.suggestedLongRunOffsetSec,
    },
    {
      field: "suggestedThresholdOffsetSec",
      label: "suggestedThresholdOffsetSec",
      value: row.suggestedThresholdOffsetSec,
    },
    {
      field: "suggestedIntervalOffsetSec",
      label: "suggestedIntervalOffsetSec",
      value: row.suggestedIntervalOffsetSec,
    },
  ];

  for (const p of previewFields) {
    if (p.value != null) {
      notStoredYet.push({
        field: p.field,
        label: p.label,
        value: String(p.value),
      });
    }
  }

  return {
    rowIndex,
    row: {
      ...row,
      targetDistance: dist.value,
    },
    errors,
    notStoredYet,
    valid: errors.length === 0,
  };
}

export type ParsedPresetCsv = {
  headers: string[];
  rows: PresetIngestPreviewRow[];
  fileErrors: string[];
};

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parsePresetIngestCsv(csvText: string): ParsedPresetCsv {
  const fileErrors: string[] = [];
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [], fileErrors: ["CSV file is empty"] };
  }

  const rawHeaders = parseCsvRow(lines[0]);
  const headers: string[] = [];
  const columnKeys: (PresetIngestCsvColumn | null)[] = [];

  for (const h of rawHeaders) {
    const key = normalizeHeaderKey(h);
    columnKeys.push(key);
    headers.push(key ?? h);
  }

  const required = new Set<string>(PRESET_INGEST_REQUIRED_COLUMNS);
  const present = new Set(columnKeys.filter(Boolean) as PresetIngestCsvColumn[]);
  for (const col of required) {
    if (!present.has(col)) {
      fileErrors.push(`Missing column: ${col}`);
    }
  }

  const rows: PresetIngestPreviewRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvRow(lines[i]);
    if (values.every((v) => !v.trim())) continue;

    if (values.length !== rawHeaders.length) {
      rows.push(
        validatePresetIngestRow(
          EMPTY_PRESET_INGEST_ROW,
          i + 1,
        ),
      );
      rows[rows.length - 1].errors.push(
        `Expected ${rawHeaders.length} columns, got ${values.length}`,
      );
      rows[rows.length - 1].valid = false;
      continue;
    }

    const record: Record<string, string> = {};
    values.forEach((val, idx) => {
      const key = columnKeys[idx];
      if (key) record[key] = val;
    });

    const input = rowFromRecord(record);
    const preview = validatePresetIngestRow(input, i + 1);
    rows.push(preview);
  }

  return { headers, rows, fileErrors };
}

export const EMPTY_PRESET_INGEST_ROW: PresetIngestRowInput = {
  title: "",
  targetDistance: "",
  minWeeklyMiles: null,
  maxWeeklyMiles: null,
  entryLongRunMiles: null,
  peakLongRunMiles: null,
  baseEndWeeklyMiles: null,
  longRunCutback: null,
  taperWeek1TotalMiles: null,
  taperWeek1LongRunMiles: null,
  taperWeek2TotalMiles: null,
  taperWeek2LongRunMiles: null,
  raceWeekDayMiles: "",
  paceNudgeSecPerMile: null,
  baseBuildPhaseName: "",
  buildToPeakPhaseName: "",
  taperPhaseName: "",
  raceWeekPhaseName: "",
  baseBuildLongRun: "",
  baseBuildEasy: "",
  baseBuildTempo: "",
  baseBuildIntervals: "",
  buildToPeakLongRun: "",
  buildToPeakEasy: "",
  buildToPeakTempo: "",
  buildToPeakIntervals: "",
  taperLongRun: "",
  taperEasy: "",
  taperTempo: "",
  taperIntervals: "",
  raceWeekLongRun: "",
  raceWeekEasy: "",
  raceWeekTempo: "",
  raceWeekIntervals: "",
  personaSlug: "",
  durationWeeks: null,
  suggestedEasyOffsetSec: null,
  suggestedLongRunOffsetSec: null,
  suggestedThresholdOffsetSec: null,
  suggestedIntervalOffsetSec: null,
};
