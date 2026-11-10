import { TARGET_DISTANCE_OPTIONS } from "@/lib/training/race-distance-presets";

/** Stored on prod preset + build_preset (this ingest pass). */
export const PRESET_INGEST_STORED_COLUMNS = [
  "title",
  "targetDistance",
  "minWeeklyMiles",
  "maxWeeklyMiles",
  "startLongRunMiles",
  "peakLongRunMiles",
  "personaSlug",
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
  startLongRunMiles: number | null;
  peakLongRunMiles: number | null;
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
  startlongrunmiles: "startLongRunMiles",
  peaklongrunmiles: "peakLongRunMiles",
  personaslug: "personaSlug",
  durationweeks: "durationWeeks",
  suggestedeasyoffsetsec: "suggestedEasyOffsetSec",
  suggestedlongrunoffsetsec: "suggestedLongRunOffsetSec",
  suggestedthresholdoffsetsec: "suggestedThresholdOffsetSec",
  suggestedintervaloffsetsec: "suggestedIntervalOffsetSec",
};

export function presetIngestTemplateCsv(): string {
  const header = PRESET_INGEST_CSV_COLUMNS.join(",");
  const example = [
    "Marathon base 55–70",
    "Marathon",
    "55",
    "70",
    "10",
    "22",
    "advanced-runner",
    "18",
    "0",
    "15",
    "20",
    "25",
  ].join(",");
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
    title: str(record.title),
    targetDistance: str(record.targetDistance ?? record.targetDistanceLabel),
    minWeeklyMiles: parseNum(record.minWeeklyMiles ?? ""),
    maxWeeklyMiles: parseNum(record.maxWeeklyMiles ?? ""),
    startLongRunMiles: parseNum(record.startLongRunMiles ?? ""),
    peakLongRunMiles: parseNum(record.peakLongRunMiles ?? ""),
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
    ["startLongRunMiles", row.startLongRunMiles],
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
    row.startLongRunMiles != null &&
    row.peakLongRunMiles != null &&
    row.peakLongRunMiles < row.startLongRunMiles
  ) {
    errors.push("peakLongRunMiles must be at least startLongRunMiles");
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

  const required = new Set(PRESET_INGEST_STORED_COLUMNS.filter((c) => c !== "personaSlug"));
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
          {
            title: "",
            targetDistance: "",
            minWeeklyMiles: null,
            maxWeeklyMiles: null,
            startLongRunMiles: null,
            peakLongRunMiles: null,
            personaSlug: "",
            durationWeeks: null,
            suggestedEasyOffsetSec: null,
            suggestedLongRunOffsetSec: null,
            suggestedThresholdOffsetSec: null,
            suggestedIntervalOffsetSec: null,
          },
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
  startLongRunMiles: null,
  peakLongRunMiles: null,
  personaSlug: "",
  durationWeeks: null,
  suggestedEasyOffsetSec: null,
  suggestedLongRunOffsetSec: null,
  suggestedThresholdOffsetSec: null,
  suggestedIntervalOffsetSec: null,
};
