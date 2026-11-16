import { forwardProdPresetStaffRequest } from "@/lib/training/prod-preset-staff-proxy";
import { runOpenAiJsonAgent } from "@/lib/training/openai-json";
import type { ProdStaffCredentials } from "@/lib/training/preset-validate-load";
import { loadPresetValidateRow, type PresetValidateRow } from "@/lib/training/preset-validate-load";

const CAP_FIELDS = [
  "taperWeek1TotalMiles",
  "taperWeek1LongRunMiles",
  "taperWeek2TotalMiles",
  "taperWeek2LongRunMiles",
  "raceWeekMiles",
] as const;

const ROUND_FIELDS = new Set<string>([
  "minWeeklyMiles",
  "maxWeeklyMiles",
  ...CAP_FIELDS,
]);

export const PERSONA_FILL_FIELDS = [
  "minWeeklyMiles",
  "maxWeeklyMiles",
  "baseStartLongRunMiles",
  "baseEndLongRunMiles",
  "entryLongRunMiles",
  "peakLongRunMiles",
  ...CAP_FIELDS,
] as const;

const FILL_SET = new Set<string>(PERSONA_FILL_FIELDS);
const CAP_SET = new Set<string>(CAP_FIELDS);

export type PersonaFillField = {
  field: (typeof PERSONA_FILL_FIELDS)[number];
  value: string;
};

export function selectPersonaFillFields(opts: {
  proposed: { field?: string; value?: string }[];
  current: Record<string, string>;
}): PersonaFillField[] {
  const out: PersonaFillField[] = [];
  const seen = new Set<string>();
  for (const row of opts.proposed) {
    const field = typeof row.field === "string" ? row.field.trim() : "";
    if (!FILL_SET.has(field) || seen.has(field)) continue;
    const raw = typeof row.value === "string" ? row.value.trim() : "";
    if (!raw) continue;
    if (CAP_SET.has(field) && (opts.current[field] ?? "").trim() !== "") continue;

    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    const value = ROUND_FIELDS.has(field) ? String(Math.round(n)) : String(n);
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

function currentFields(row: PresetValidateRow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of PERSONA_FILL_FIELDS) {
    const value = row[field];
    out[field] = value == null || value === "" ? "" : String(value);
  }
  return out;
}

export async function reasonPresetFromPersona(opts: {
  presetId: string;
  auth: ProdStaffCredentials;
}): Promise<{ reasoning: string; fields: PersonaFillField[] }> {
  const row = await loadPresetValidateRow(opts.presetId, opts.auth);
  if (!row) throw new Error("Preset not found");
  const persona = await personaBlock(row, opts.auth);
  if (!persona) throw new Error("Link a persona on this preset, then reason from it.");

  const current = currentFields(row);

  const systemPrompt = `You check a GoFast training preset against its linked persona.

Judge only whether this athlete fits the plan.

The meta band is minWeeklyMiles and maxWeeklyMiles. One band for the whole plan, the range the athlete trains inside. Propose a change only when that band does not fit this athlete. Do not nudge it by a couple of miles.

Long runs are baseStartLongRunMiles to baseEndLongRunMiles, then entryLongRunMiles to peakLongRunMiles. Base end and build start are the same handoff, not two unrelated numbers.

Taper and race week are a three-week cap that steps the week down from the band. They are not a second preference. Propose taperWeek1TotalMiles, taperWeek1LongRunMiles, taperWeek2TotalMiles, taperWeek2LongRunMiles, or raceWeekMiles only when that field is empty. Leave a filled cap alone. An empty raceWeekMiles is one mileage under the band and below taper week 2.

Do not propose phase names, rotations, pace, peak volume, or a weekly min and max for base. Omit a field to leave it unchanged.

Output JSON:
{
  "reasoning": "one paragraph for staff",
  "fields": [{ "field": "minWeeklyMiles", "value": "40" }]
}`;

  const userPrompt = [
    "## Persona",
    persona,
    "",
    "## Current fields",
    JSON.stringify(current, null, 2),
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
    }),
  };
}
