import { runOpenAiJsonAgent } from "@/lib/training/openai-json";
import type { ProdStaffCredentials } from "@/lib/training/preset-validate-load";
import { loadPresetValidateRow } from "@/lib/training/preset-validate-load";
import { buildPresetValidateLlmPacket } from "@/lib/training/preset-validate-llm-packet";

export type PresetFieldIssue = {
  field: string;
  note: string;
};

export function selectCheckFieldIssues(raw: unknown): PresetFieldIssue[] {
  if (!Array.isArray(raw)) return [];
  const out: PresetFieldIssue[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const record = row as { field?: unknown; note?: unknown };
    const field = typeof record.field === "string" ? record.field.trim() : "";
    const note = typeof record.note === "string" ? record.note.trim() : "";
    if (!field || !note || seen.has(field)) continue;
    if (!/^[A-Za-z][A-Za-z0-9]{0,80}$/.test(field)) continue;
    seen.add(field);
    out.push({ field, note: note.slice(0, 400) });
  }
  return out;
}

export async function checkPresetFields(opts: {
  presetId: string;
  auth: ProdStaffCredentials;
}): Promise<{ summary: string; issues: PresetFieldIssue[] }> {
  const row = await loadPresetValidateRow(opts.presetId, opts.auth);
  if (!row) throw new Error("Preset not found");

  const systemPrompt = `You inspect a GoFast training preset sheet. Look only at how the fields are filled. Do not invent a new plan from the persona story. Do not propose replacement values.

Flag empty cells the sheet implies should be filled, miles that break the bands already in the packet, and phase or rotation names that are empty when the miles imply a phase. Omit a field that looks fine.

Output JSON:
{
  "summary": "one paragraph for staff",
  "issues": [{ "field": "peakLongRunMiles", "note": "what looks off" }]
}`;

  const parsed = await runOpenAiJsonAgent<{ summary?: string; issues?: unknown }>({
    systemPrompt,
    userPrompt: buildPresetValidateLlmPacket(row),
  });

  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  if (!summary) throw new Error("The call did not describe the fields.");

  return { summary, issues: selectCheckFieldIssues(parsed.issues) };
}
