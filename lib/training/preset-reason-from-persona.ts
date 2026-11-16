import { forwardProdPresetStaffRequest } from "@/lib/training/prod-preset-staff-proxy";
import { runOpenAiJsonAgent } from "@/lib/training/openai-json";
import type { ProdStaffCredentials } from "@/lib/training/preset-validate-load";
import { loadPresetValidateRow, type PresetValidateRow } from "@/lib/training/preset-validate-load";
import {
  PHASE_NAME_FIELDS,
  PHASE_ROLES,
  PHASE_SLOT_FIELDS,
  PRESET_MILE_FIELDS,
  SLOT_KINDS,
  isPhaseNameField,
  isPhaseSlotField,
  type SlotKind,
} from "@/lib/training/preset-shape-columns";

const SKIPPED_MILES = new Set(["raceWeekDayMiles", "longRunCutback", "paceNudgeSecPerMile", "baseEndWeeklyMiles"]);

const INT_MILES = new Set([
  "minWeeklyMiles",
  "maxWeeklyMiles",
  "baseWeeklyMinMiles",
  "baseWeeklyMaxMiles",
  "peakWeeklyVolumeMiles",
]);

export const PERSONA_FILL_FIELDS = [
  ...PRESET_MILE_FIELDS.filter((field) => !SKIPPED_MILES.has(field)),
  ...PHASE_NAME_FIELDS,
  ...PHASE_SLOT_FIELDS,
] as const;

const FILL_SET = new Set<string>(PERSONA_FILL_FIELDS);

export type PersonaFillField = {
  field: (typeof PERSONA_FILL_FIELDS)[number];
  value: string;
};

function slotKindForField(field: string): SlotKind | null {
  for (const role of PHASE_ROLES) {
    for (const slot of SLOT_KINDS) {
      if (`${role.key}${slot.suffix}` === field) return slot.kind;
    }
  }
  return null;
}

function canonicalName(value: string, names: string[]): string | null {
  const hit = names.find((name) => name.toLowerCase() === value.trim().toLowerCase());
  return hit ?? null;
}

export function selectPersonaFillFields(opts: {
  proposed: { field?: string; value?: string }[];
  current: Record<string, string>;
  phaseNames: string[];
  rotationNames: Record<SlotKind, string[]>;
}): PersonaFillField[] {
  const out: PersonaFillField[] = [];
  const seen = new Set<string>();
  for (const row of opts.proposed) {
    const field = typeof row.field === "string" ? row.field.trim() : "";
    if (!FILL_SET.has(field) || seen.has(field)) continue;
    const raw = typeof row.value === "string" ? row.value.trim() : "";
    if (!raw) continue;

    let value = raw;
    if (isPhaseNameField(field)) {
      const name = canonicalName(raw, opts.phaseNames);
      if (!name) continue;
      value = name;
    } else if (isPhaseSlotField(field)) {
      const kind = slotKindForField(field);
      const name = kind ? canonicalName(raw, opts.rotationNames[kind] ?? []) : null;
      if (!name) continue;
      value = name;
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      value = INT_MILES.has(field) ? String(Math.round(n)) : String(n);
    }

    if ((opts.current[field] ?? "") === value) continue;
    seen.add(field);
    out.push({ field: field as PersonaFillField["field"], value });
  }
  return out;
}

function personaText(row: PresetValidateRow): string | null {
  const persona = row.persona;
  if (!persona || typeof persona !== "object") return null;
  const record = persona as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title : "";
  if (!title && !record.id) return null;
  const lines = [
    title && `title: ${title}`,
    typeof record.capability === "string" && `capability: ${record.capability}`,
    typeof record.dedication === "string" && `dedication: ${record.dedication}`,
    typeof record.personaGoalLabel === "string" && `goal: ${record.personaGoalLabel}`,
    typeof record.intentSummary === "string" && `intent: ${record.intentSummary}`,
    typeof record.athletePersonaSummary === "string" && `summary: ${record.athletePersonaSummary}`,
  ].filter(Boolean);
  return lines.join("\n");
}

async function personaBlock(row: PresetValidateRow, auth: ProdStaffCredentials): Promise<string | null> {
  const nested = personaText(row);
  if (nested) return nested;
  const personaId = typeof row.personaId === "string" ? row.personaId : "";
  if (!personaId) return null;
  const res = await forwardProdPresetStaffRequest({
    authorization: auth.authorization,
    staffId: auth.staffId,
    path: "/api/training/plan-persona?all=1",
    method: "GET",
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => ({}))) as { personas?: Record<string, unknown>[] };
  const match = (json.personas ?? []).find((persona) => persona.id === personaId);
  if (!match) return null;
  return personaText({ ...row, persona: match });
}

async function currentFields(
  row: PresetValidateRow,
  auth: ProdStaffCredentials,
): Promise<Record<string, string>> {
  const read = (key: string) => {
    const value = row[key];
    return value == null || value === "" ? "" : String(value);
  };
  const out: Record<string, string> = {};
  for (const field of PERSONA_FILL_FIELDS) {
    if (!isPhaseNameField(field) && !isPhaseSlotField(field)) out[field] = read(field);
  }

  const phases: { key: (typeof PHASE_ROLES)[number]["key"]; id: string | null }[] = [
    { key: "baseBuild", id: typeof row.baseBuildPhasePresetId === "string" ? row.baseBuildPhasePresetId : null },
    { key: "buildToPeak", id: typeof row.buildToPeakPhasePresetId === "string" ? row.buildToPeakPhasePresetId : null },
    { key: "taper", id: typeof row.taperPhasePresetId === "string" ? row.taperPhasePresetId : null },
    { key: "raceWeek", id: typeof row.raceWeekPhasePresetId === "string" ? row.raceWeekPhasePresetId : null },
  ];

  await Promise.all(
    phases.map(async (phase) => {
      const role = PHASE_ROLES.find((item) => item.key === phase.key);
      if (!role) return;
      if (!phase.id) {
        out[role.nameField] = "";
        for (const slot of SLOT_KINDS) out[`${phase.key}${slot.suffix}`] = "";
        return;
      }
      const res = await forwardProdPresetStaffRequest({
        authorization: auth.authorization,
        staffId: auth.staffId,
        path: `/api/training/phase-preset/${encodeURIComponent(phase.id)}`,
        method: "GET",
      });
      const json = (await res.json().catch(() => ({}))) as {
        phasePreset?: {
          name?: string;
          longRunConfig?: { name?: string } | null;
          easyConfig?: { name?: string } | null;
          tempoConfig?: { name?: string } | null;
          intervalsConfig?: { name?: string } | null;
        };
      };
      const preset = json.phasePreset;
      out[role.nameField] = preset?.name ?? "";
      out[`${phase.key}LongRun`] = preset?.longRunConfig?.name ?? "";
      out[`${phase.key}Easy`] = preset?.easyConfig?.name ?? "";
      out[`${phase.key}Tempo`] = preset?.tempoConfig?.name ?? "";
      out[`${phase.key}Intervals`] = preset?.intervalsConfig?.name ?? "";
    }),
  );

  return out;
}

async function nameList(
  auth: ProdStaffCredentials,
  path: string,
  key: "phasePresets" | "items",
): Promise<string[]> {
  const res = await forwardProdPresetStaffRequest({
    authorization: auth.authorization,
    staffId: auth.staffId,
    path,
    method: "GET",
  });
  if (!res.ok) return [];
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const rows = json[key];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => (row && typeof row === "object" ? (row as { name?: unknown }).name : null))
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0);
}

export async function reasonPresetFromPersona(opts: {
  presetId: string;
  auth: ProdStaffCredentials;
}): Promise<{ reasoning: string; fields: PersonaFillField[] }> {
  const row = await loadPresetValidateRow(opts.presetId, opts.auth);
  if (!row) throw new Error("Preset not found");
  const persona = await personaBlock(row, opts.auth);
  if (!persona) throw new Error("Link a persona on this preset, save it, then reason from it.");

  const [phaseNames, longRun, easy, tempo, intervals] = await Promise.all([
    nameList(opts.auth, "/api/training/phase-preset", "phasePresets"),
    nameList(opts.auth, "/api/training/long-run-config", "items"),
    nameList(opts.auth, "/api/training/easy-config", "items"),
    nameList(opts.auth, "/api/training/tempo-config", "items"),
    nameList(opts.auth, "/api/training/intervals-config", "items"),
  ]);
  const rotationNames: Record<SlotKind, string[]> = { longRun, easy, tempo, intervals };
  const current = await currentFields(row, opts.auth);

  const systemPrompt = `You fill a GoFast training preset from its linked persona.

The persona says who this athlete is and what the plan is trying to do. Reason about where base starts and whether build to peak matches that athlete. Then propose only the fields that should change.

Base is a rough guide: baseWeeklyMinMiles, baseWeeklyMaxMiles, baseStartLongRunMiles, baseEndLongRunMiles.
Build to peak is the band and the ramp: minWeeklyMiles, maxWeeklyMiles, entryLongRunMiles, peakLongRunMiles, peakWeeklyVolumeMiles.
Taper is taperWeek1TotalMiles, taperWeek1LongRunMiles, taperWeek2TotalMiles, taperWeek2LongRunMiles.
Race week is raceWeekMiles.

Phase names and rotation names must be copied exactly from the lists. Do not invent catalogue workouts or phase names. Omit a field to leave it unchanged. Do not change pace.

Output JSON:
{
  "reasoning": "one paragraph for staff",
  "fields": [{ "field": "baseStartLongRunMiles", "value": "10" }]
}`;

  const userPrompt = [
    "## Persona",
    persona,
    "",
    "## Current fields",
    JSON.stringify(current, null, 2),
    "",
    "## Phase names",
    phaseNames.join("\n") || "(none)",
    "",
    "## Long run rotations",
    longRun.join("\n") || "(none)",
    "",
    "## Easy rotations",
    easy.join("\n") || "(none)",
    "",
    "## Tempo rotations",
    tempo.join("\n") || "(none)",
    "",
    "## Interval rotations",
    intervals.join("\n") || "(none)",
    "",
    `Writable fields: ${PERSONA_FILL_FIELDS.join(", ")}`,
  ].join("\n");

  const parsed = await runOpenAiJsonAgent<{
    reasoning?: string;
    fields?: { field?: string; value?: string }[];
  }>({ systemPrompt, userPrompt });

  const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "";
  if (!reasoning) throw new Error("The call did not explain the persona.");

  return {
    reasoning,
    fields: selectPersonaFillFields({
      proposed: Array.isArray(parsed.fields) ? parsed.fields : [],
      current,
      phaseNames,
      rotationNames,
    }),
  };
}
