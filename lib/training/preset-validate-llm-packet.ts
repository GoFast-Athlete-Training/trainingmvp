import type { PresetValidateRow } from "@/lib/training/preset-validate-load";
import { raceWeekSlotsSummary } from "./preset-validate-load";

function hasText(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function line(label: string, value: unknown): string | null {
  if (value === null || value === undefined) return `- ${label}: (missing)`;
  if (typeof value === "string" && !value.trim()) return `- ${label}: (missing)`;
  if (typeof value === "object") {
    const s = JSON.stringify(value);
    if (s === "{}" || s === "[]" || s === "null") return `- ${label}: (missing)`;
    return `- ${label}: ${s.length > 400 ? `${s.slice(0, 400)}…` : s}`;
  }
  return `- ${label}: ${String(value)}`;
}

function block(title: string, lines: Array<string | null>): string {
  const body = lines.filter((l): l is string => Boolean(l));
  return `${title}\n${body.length ? body.join("\n") : "(empty)"}`;
}

function jsonPresent(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s !== "{}" && s !== "[]" && s !== "null";
  }
  return Boolean(v);
}

export const PRESET_VALIDATE_LLM_INSTRUCTION = `Instruction:
- Say which athlete type this preset is for (persona capability + dedication, or explain if unlinked).
- List what is missing for that athlete type (public copy, persona link, goal, weekly band, build/taper/race week).
- Flag marketing copy such as "advanced" if it does not match persona capability (canonical: NON_RUNNER, BEGINNER, RECREATIONAL, COMPETITIVE, ELITE).
- Flag deprecated TM-only columns that still hold data (listed below) — prod athlete app does not store those on the preset row.
- Do not invent catalogue or rotation config ids.
- For fixes, return a CSV with columns field,value (one row per field to change). Leave value blank only when keeping on file. Writable fields: title, description, publicDescription, targetDistanceLabel, minWeeklyMiles, maxWeeklyMiles, personaSlug, goalSlug, coachIntent, objectiveOfPlan, startLongRunMiles, peakLongRunMiles, buildMaxWeeklyMiles, baseStartLongRunMiles, basePeakLongRunMiles.`;

export function buildPresetValidateLlmPacket(row: PresetValidateRow): string {
  const persona = row.persona;
  const goal = row.goal;
  const base = row.baseBuildPreset;
  const build = row.buildPreset;
  const taper = row.taperPreset;
  const race = row.raceWeekPreset;

  const deprecated = [
    ["snapPeakLongRunMiles", row.snapPeakLongRunMiles],
    ["snapPeakWeeklyMiles", row.snapPeakWeeklyMiles],
    ["snapTaperWeek1TotalMiles", row.snapTaperWeek1TotalMiles],
    ["snapTaperWeek1LongRunMiles", row.snapTaperWeek1LongRunMiles],
    ["snapTaperWeek2TotalMiles", row.snapTaperWeek2TotalMiles],
    ["snapTaperWeek2LongRunMiles", row.snapTaperWeek2LongRunMiles],
    ["coachPlanOverview", jsonPresent(row.coachPlanOverview) ? "present" : null],
    ["workoutStructure", jsonPresent(row.workoutStructure) ? "present" : null],
    ["easyRunConfig", jsonPresent(row.easyRunConfig) ? "present" : null],
    ["longRunConfigId", row.longRunConfigId],
    ["intervalsConfigId", row.intervalsConfigId],
    ["tempoConfigId", row.tempoConfigId],
    ["easyConfigId", row.easyConfigId],
    ["longRunCycleWeeks", row.longRunCycleWeeks],
  ] as const;

  const deprecatedLines = deprecated.map(([name, val]) =>
    val != null && val !== "" && val !== 0 ? line(name, val) : null,
  );

  const parts = [
    `Preset: ${row.title}`,
    `id: ${row.id}`,
    `slug: ${row.slug}`,
    "",
    block("Core (live)", [
      line("title", row.title),
      line("description (staff)", row.description),
      line("publicDescription", row.publicDescription),
      line("targetDistanceLabel", row.targetDistanceLabel),
      line("minWeeklyMiles", row.minWeeklyMiles),
      line("maxWeeklyMiles", row.maxWeeklyMiles),
      line("coachIntent", row.coachIntent),
      line("objectiveOfPlan", row.objectiveOfPlan),
      line("tempoIdealDow", row.tempoIdealDow),
      line("intervalIdealDow", row.intervalIdealDow),
      line("longRunDefaultDow", row.longRunDefaultDow),
    ]),
    "",
    block("Linked persona", [
      persona
        ? line("persona slug", persona.slug)
        : line("persona", "(not linked)"),
      persona ? line("persona title", persona.title) : null,
      persona ? line("capability", persona.capability) : null,
      persona ? line("dedication", persona.dedication) : null,
      persona ? line("intentSummary", persona.intentSummary) : null,
      persona ? line("athletePersonaSummary", persona.athletePersonaSummary) : null,
      persona ? line("runningHistorySummary", persona.runningHistorySummary) : null,
      persona ? line("currentCapabilitySummary", persona.currentCapabilitySummary) : null,
    ]),
    "",
    block("Linked goal", [
      goal ? line("goal slug", goal.slug) : line("goal", "(not linked)"),
      goal ? line("objectiveOfPlan", goal.objectiveOfPlan) : null,
      goal ? line("targetDistanceLabel", goal.targetDistanceLabel) : null,
      goal ? line("planDurationWeeks", goal.planDurationWeeks) : null,
      goal ? line("progressionAggressiveness", goal.progressionAggressiveness) : null,
      goal ? line("coachIntent", goal.coachIntent) : null,
    ]),
    "",
    block("Denormalized on preset (may disagree with persona)", [
      line("athletePersonaCapability", row.athletePersonaCapability),
      line("athletePersonaGoal", row.athletePersonaGoal),
      line("athletePersonaDedication", row.athletePersonaDedication),
    ]),
    "",
    block("Base build", [
      base ? line("name", base.name) : line("status", "(not linked)"),
      base ? line("startLongRunMiles", base.startLongRunMiles) : null,
      base ? line("peakLongRunMiles", base.peakLongRunMiles) : null,
      base ? line("maxWeeklyMiles", base.maxWeeklyMiles) : null,
    ]),
    "",
    block("Build to peak", [
      build ? line("name", build.name) : line("status", "(not linked)"),
      build ? line("startLongRunMiles", build.startLongRunMiles) : null,
      build ? line("peakLongRunMiles", build.peakLongRunMiles) : null,
      build ? line("maxWeeklyMiles", build.maxWeeklyMiles) : null,
      build ? line("longRunCutback", build.longRunCutback) : null,
    ]),
    "",
    block("Taper", [
      taper ? line("name", taper.name) : line("status", "(not linked)"),
      taper ? line("week1TotalMiles", taper.week1TotalMiles) : null,
      taper ? line("week1LongRunMiles", taper.week1LongRunMiles) : null,
      taper ? line("week2TotalMiles", taper.week2TotalMiles) : null,
      taper ? line("week2LongRunMiles", taper.week2LongRunMiles) : null,
    ]),
    "",
    block("Race week", [
      race ? line("title", race.title) : line("status", "(not linked)"),
      race ? line("slots", raceWeekSlotsSummary(race.slots)) : null,
    ]),
    "",
    block("Deprecated (TM mirror only — not prod preset columns)", deprecatedLines),
    "",
    "---",
    PRESET_VALIDATE_LLM_INSTRUCTION,
  ];

  return parts.join("\n");
}

/** Minimal packet when prod is SOT and TM row is missing. */
export function buildPresetValidateLlmPacketFromProdJson(
  preset: Record<string, unknown>,
): string {
  const title = hasText(preset.title) ? String(preset.title) : "Untitled";
  const parts = [
    `Preset: ${title}`,
    `id: ${preset.id ?? ""}`,
    `slug: ${preset.slug ?? ""}`,
    "",
    "(Training Manage mirror missing — packet from prod staff API only.)",
    "",
    block("Core", [
      line("title", preset.title),
      line("description", preset.description),
      line("publicDescription", preset.publicDescription),
      line("targetDistanceLabel", preset.targetDistanceLabel),
      line("minWeeklyMiles", preset.minWeeklyMiles),
      line("maxWeeklyMiles", preset.maxWeeklyMiles),
      line("personaId", preset.personaId),
      line("goalId", preset.goalId),
    ]),
    "",
    block("Build (prod)", [
      line("peakLongRunMiles", (preset.buildPreset as { peakLongRunMiles?: unknown })?.peakLongRunMiles),
      line("build name", (preset.buildPreset as { name?: unknown })?.name),
    ]),
    "",
    "---",
    PRESET_VALIDATE_LLM_INSTRUCTION,
  ];
  return parts.join("\n");
}

export function buildPresetCatalogValidateLlmPacket(rows: PresetValidateRow[]): string {
  if (rows.length === 0) {
    return "No presets in Training Manage database.\nSync or import presets, then re-run catalog check.";
  }
  const sections = rows.map((row, i) => {
    const body = buildPresetValidateLlmPacket(row);
    return `========== Preset ${i + 1} / ${rows.length} ==========\n${body}`;
  });
  return [
    "TRAINING PLAN PRESET CATALOG CHECK",
    `Count: ${rows.length}`,
    "",
    ...sections,
    "",
    "---",
    "For each preset above, note persona fit, missing fields, and deprecated data. Do not batch-edit ids.",
  ].join("\n");
}
