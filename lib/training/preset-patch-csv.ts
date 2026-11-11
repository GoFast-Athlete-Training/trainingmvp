import { prisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/training/plan-entity-slugs";
import { loadPresetValidateRow, type PresetValidateRow } from "@/lib/training/preset-validate-load";
import { pushPresetToProd } from "@/lib/training/push-preset-to-prod";
import { runOpenAiJsonAgent } from "@/lib/training/openai-json";
import { TARGET_DISTANCE_OPTIONS } from "@/lib/training/race-distance-presets";

export const PRESET_PATCH_WRITABLE_FIELDS = [
  "title",
  "description",
  "publicDescription",
  "targetDistanceLabel",
  "minWeeklyMiles",
  "maxWeeklyMiles",
  "personaSlug",
  "goalSlug",
  "coachIntent",
  "objectiveOfPlan",
  "startLongRunMiles",
  "peakLongRunMiles",
  "buildMaxWeeklyMiles",
  "baseStartLongRunMiles",
  "basePeakLongRunMiles",
] as const;

export type PresetPatchField = (typeof PRESET_PATCH_WRITABLE_FIELDS)[number];

const WRITABLE_SET = new Set<string>(PRESET_PATCH_WRITABLE_FIELDS);

export type PresetPatchChange = {
  field: PresetPatchField;
  before: string;
  after: string;
};

export type PresetPatchPreview = {
  matchSlug: string;
  changes: PresetPatchChange[];
  unchanged: string[];
  errors: string[];
};

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function fieldValueFromRow(row: PresetValidateRow, field: PresetPatchField): string {
  switch (field) {
    case "title":
      return str(row.title);
    case "description":
      return str(row.description);
    case "publicDescription":
      return str(row.publicDescription);
    case "targetDistanceLabel":
      return str(row.targetDistanceLabel);
    case "minWeeklyMiles":
      return row.minWeeklyMiles != null ? String(row.minWeeklyMiles) : "";
    case "maxWeeklyMiles":
      return row.maxWeeklyMiles != null ? String(row.maxWeeklyMiles) : "";
    case "personaSlug":
      return row.persona?.slug ?? "";
    case "goalSlug":
      return row.goal?.slug ?? "";
    case "coachIntent":
      return str(row.coachIntent);
    case "objectiveOfPlan":
      return str(row.objectiveOfPlan);
    case "startLongRunMiles":
      return row.buildPreset?.startLongRunMiles != null
        ? String(row.buildPreset.startLongRunMiles)
        : "";
    case "peakLongRunMiles":
      return row.buildPreset?.peakLongRunMiles != null
        ? String(row.buildPreset.peakLongRunMiles)
        : "";
    case "buildMaxWeeklyMiles":
      return row.buildPreset?.maxWeeklyMiles != null ? String(row.buildPreset.maxWeeklyMiles) : "";
    case "baseStartLongRunMiles":
      return row.baseBuildPreset?.startLongRunMiles != null
        ? String(row.baseBuildPreset.startLongRunMiles)
        : "";
    case "basePeakLongRunMiles":
      return row.baseBuildPreset?.peakLongRunMiles != null
        ? String(row.baseBuildPreset.peakLongRunMiles)
        : "";
    default:
      return "";
  }
}

export function buildPresetPatchExportCsv(row: PresetValidateRow): string {
  const lines = ["matchKey", row.slug, "field,value"];
  for (const field of PRESET_PATCH_WRITABLE_FIELDS) {
    const value = fieldValueFromRow(row, field);
    lines.push(`${field},"${value.replace(/"/g, '""')}"`);
  }
  return `${lines.join("\n")}\n`;
}

function parseCsvLine(line: string): string[] {
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

export function parsePresetPatchFieldRows(csvText: string): {
  matchSlug: string | null;
  rows: { field: string; value: string }[];
  parseErrors: string[];
} {
  const parseErrors: string[] = [];
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { matchSlug: null, rows: [], parseErrors: ["CSV is empty"] };
  }

  let matchSlug: string | null = null;
  const rows: { field: string; value: string }[] = [];

  let startIdx = 0;
  const firstParts = parseCsvLine(lines[0]);
  if (firstParts[0]?.toLowerCase() === "matchkey") {
    matchSlug = firstParts[1]?.trim() || null;
    startIdx = 1;
  }

  if (startIdx < lines.length) {
    const header = parseCsvLine(lines[startIdx]).map((h) => h.toLowerCase());
    const fieldIdx = header.indexOf("field");
    const valueIdx = header.indexOf("value");
    if (fieldIdx === -1 || valueIdx === -1) {
      parseErrors.push("CSV must have field,value columns (or matchKey row + field,value header)");
      return { matchSlug, rows, parseErrors };
    }
    startIdx += 1;
    for (let i = startIdx; i < lines.length; i++) {
      const parts = parseCsvLine(lines[i]);
      const field = (parts[fieldIdx] ?? "").trim();
      const value = parts[valueIdx] ?? "";
      if (!field) continue;
      rows.push({ field, value: value.trim() });
    }
  }

  return { matchSlug, rows, parseErrors };
}

function looksLikePatchCsv(text: string): boolean {
  const first = text.trim().split(/\r?\n/)[0]?.toLowerCase() ?? "";
  return first.includes("field") && first.includes("value");
}

export async function parsePresetPatchPaste(opts: {
  pasteText: string;
  snapshotPacket: string;
}): Promise<{ csvText: string; parseErrors: string[] }> {
  const trimmed = opts.pasteText.trim();
  if (!trimmed) {
    return { csvText: "", parseErrors: ["Paste text is empty"] };
  }
  if (looksLikePatchCsv(trimmed)) {
    return { csvText: trimmed, parseErrors: [] };
  }

  const system = `Convert preset validation notes into patch CSV rows.
Output JSON: { "rows": [ { "field": string, "value": string } ] }
field must be one of: ${PRESET_PATCH_WRITABLE_FIELDS.join(", ")}
Only include fields that should change. Use empty string for value when the note says to keep on file.
Never output slug or matchKey as a field.`;

  const user = `Current preset packet:\n${opts.snapshotPacket}\n\n---\nLLM validation reply:\n${trimmed}`;

  try {
    const parsed = await runOpenAiJsonAgent<{ rows?: { field?: string; value?: string }[] }>({
      systemPrompt: system,
      userPrompt: user,
    });
    const rawRows = Array.isArray(parsed.rows) ? parsed.rows : [];
    const lines = ["field,value"];
    for (const r of rawRows) {
      const field = typeof r.field === "string" ? r.field.trim() : "";
      if (!field || !WRITABLE_SET.has(field)) continue;
      const value = typeof r.value === "string" ? r.value : "";
      lines.push(`${field},"${value.replace(/"/g, '""')}"`);
    }
    return { csvText: lines.join("\n"), parseErrors: [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Parse failed";
    return { csvText: "", parseErrors: [msg] };
  }
}

export async function previewPresetPatch(
  row: PresetValidateRow,
  csvText: string,
): Promise<PresetPatchPreview> {
  const { matchSlug, rows, parseErrors } = parsePresetPatchFieldRows(csvText);
  const errors = [...parseErrors];
  if (matchSlug && matchSlug !== row.slug) {
    errors.push(`matchKey slug "${matchSlug}" does not match preset slug "${row.slug}"`);
  }

  const changes: PresetPatchChange[] = [];
  const unchanged: string[] = [];
  const pending = new Map<PresetPatchField, string>();

  for (const { field, value } of rows) {
    if (!WRITABLE_SET.has(field)) {
      errors.push(`Unknown field: ${field}`);
      continue;
    }
    const key = field as PresetPatchField;
    if (value === "") {
      unchanged.push(field);
      continue;
    }
    pending.set(key, value);
  }

  for (const [field, after] of pending) {
    const before = fieldValueFromRow(row, field);
    if (before === after) {
      unchanged.push(field);
      continue;
    }
    changes.push({ field, before, after });
  }

  if (pending.has("personaSlug")) {
    const slug = pending.get("personaSlug")!;
    const persona = await prisma.training_plan_persona.findFirst({
      where: { slug },
      select: { id: true },
    });
    if (!persona) errors.push(`No persona for slug “${slug}”`);
  }

  if (pending.has("goalSlug")) {
    const slug = pending.get("goalSlug")!;
    const goal = await prisma.training_plan_goal.findFirst({
      where: { slug },
      select: { id: true },
    });
    if (!goal) errors.push(`No goal for slug “${slug}”`);
  }

  if (pending.has("targetDistanceLabel")) {
    const label = pending.get("targetDistanceLabel")!;
    const allowed = new Set(TARGET_DISTANCE_OPTIONS.map((d) => d.toLowerCase()));
    if (label && !allowed.has(label.toLowerCase())) {
      errors.push(`Unknown targetDistanceLabel “${label}”`);
    }
  }

  return {
    matchSlug: row.slug,
    changes,
    unchanged,
    errors,
  };
}

async function resolvePersonaId(slug: string | undefined): Promise<string | null | undefined> {
  if (slug === undefined) return undefined;
  if (!slug.trim()) return null;
  const row = await prisma.training_plan_persona.findFirst({
    where: { slug: slug.trim() },
    select: { id: true },
  });
  if (!row) throw new Error(`No persona for slug “${slug}”`);
  return row.id;
}

async function resolveGoalId(slug: string | undefined): Promise<string | null | undefined> {
  if (slug === undefined) return undefined;
  if (!slug.trim()) return null;
  const row = await prisma.training_plan_goal.findFirst({
    where: { slug: slug.trim() },
    select: { id: true },
  });
  if (!row) throw new Error(`No goal for slug “${slug}”`);
  return row.id;
}

export async function applyPresetPatch(opts: {
  presetId: string;
  csvText: string;
  authorization: string;
  staffId: string;
}): Promise<
  | { ok: true; preview: PresetPatchPreview }
  | { ok: false; error: string; preview?: PresetPatchPreview }
> {
  const row = await loadPresetValidateRow(opts.presetId);
  if (!row) {
    return { ok: false, error: "Preset not found in Training Manage" };
  }

  const preview = await previewPresetPatch(row, opts.csvText);
  if (preview.errors.length > 0) {
    return { ok: false, error: preview.errors.join("; "), preview };
  }
  if (preview.changes.length === 0) {
    return { ok: false, error: "No changes to apply", preview };
  }

  const valueByField = new Map(preview.changes.map((c) => [c.field, c.after]));

  const personaId = await resolvePersonaId(valueByField.get("personaSlug"));
  const goalId = await resolveGoalId(valueByField.get("goalSlug"));

  const planData: Record<string, unknown> = {};
  if (valueByField.has("title")) {
    const title = valueByField.get("title")!.trim();
    planData.title = title;
    const nextSlug = normalizeSlug(title).slice(0, 80);
    if (nextSlug) planData.slug = nextSlug;
  }
  if (valueByField.has("description")) planData.description = valueByField.get("description");
  if (valueByField.has("publicDescription"))
    planData.publicDescription = valueByField.get("publicDescription");
  if (valueByField.has("targetDistanceLabel")) {
    const v = valueByField.get("targetDistanceLabel")!.trim();
    planData.targetDistanceLabel = v || null;
  }
  if (valueByField.has("minWeeklyMiles")) {
    planData.minWeeklyMiles = Math.max(1, Math.round(Number(valueByField.get("minWeeklyMiles"))));
  }
  if (valueByField.has("maxWeeklyMiles")) {
    const n = Number(valueByField.get("maxWeeklyMiles"));
    planData.maxWeeklyMiles = Number.isFinite(n) ? Math.max(1, Math.round(n)) : null;
  }
  if (valueByField.has("coachIntent")) planData.coachIntent = valueByField.get("coachIntent") || null;
  if (valueByField.has("objectiveOfPlan"))
    planData.objectiveOfPlan = valueByField.get("objectiveOfPlan") || null;
  if (personaId !== undefined) planData.personaId = personaId;
  if (goalId !== undefined) planData.goalId = goalId;

  await prisma.$transaction(async (tx) => {
    await tx.training_plan_preset.update({
      where: { id: opts.presetId },
      data: planData,
    });

    const buildFields: Record<string, number | null> = {};
    if (valueByField.has("startLongRunMiles")) {
      buildFields.startLongRunMiles = Number(valueByField.get("startLongRunMiles"));
    }
    if (valueByField.has("peakLongRunMiles")) {
      buildFields.peakLongRunMiles = Number(valueByField.get("peakLongRunMiles"));
    }
    if (valueByField.has("buildMaxWeeklyMiles")) {
      buildFields.maxWeeklyMiles = Math.round(Number(valueByField.get("buildMaxWeeklyMiles")));
    }
    if (row.buildPresetId && Object.keys(buildFields).length > 0) {
      await tx.build_preset.update({ where: { id: row.buildPresetId }, data: buildFields });
    }

    const baseFields: Record<string, number | null> = {};
    if (valueByField.has("baseStartLongRunMiles")) {
      baseFields.startLongRunMiles = Number(valueByField.get("baseStartLongRunMiles"));
    }
    if (valueByField.has("basePeakLongRunMiles")) {
      baseFields.peakLongRunMiles = Number(valueByField.get("basePeakLongRunMiles"));
    }
    if (row.baseBuildPresetId && Object.keys(baseFields).length > 0) {
      await tx.build_preset.update({ where: { id: row.baseBuildPresetId }, data: baseFields });
    }
  });

  const push = await pushPresetToProd({
    presetId: opts.presetId,
    authorization: opts.authorization,
    staffId: opts.staffId,
  });
  if (!push.ok) {
    return { ok: false, error: `Local saved but prod sync failed: ${push.error}`, preview };
  }

  return { ok: true, preview };
}
