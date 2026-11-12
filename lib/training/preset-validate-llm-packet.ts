import type { PresetValidateRow } from "@/lib/training/preset-validate-load";
import { PRESET_PATCH_WRITABLE_FIELDS } from "@/lib/training/preset-patch-csv";
import { raceWeekSlotsSummary } from "./preset-validate-load";
import { parseRaceWeekSlots } from "./race-week-slots";

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

function finite(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function raceWeekMilesSum(slots: unknown): number | null {
  const rows = parseRaceWeekSlots(slots);
  let sum = 0;
  let any = false;
  for (const slot of rows) {
    if (slot.type === "off") continue;
    if (slot.prescribedMiles != null && slot.prescribedMiles > 0) {
      sum += slot.prescribedMiles;
      any = true;
    }
  }
  return any ? Math.round(sum * 10) / 10 : null;
}

function derivedBoundaryLines(row: PresetValidateRow): string[] {
  const base = row.baseBuildPreset;
  const build = row.buildPreset;
  const taper = row.taperPreset;
  const cut = finite(row.longRunCutback) ?? finite(build?.longRunCutback);
  const factor = cut != null && cut > 0 && cut < 1 ? cut : 0.2;
  const entry = finite(row.entryLongRunMiles) ?? finite(build?.startLongRunMiles);
  const peakLong = finite(row.peakLongRunMiles) ?? finite(build?.peakLongRunMiles);
  const peakWeekly = finite(row.maxWeeklyMiles) ?? finite(build?.maxWeeklyMiles);
  const taper1 = row.taperWeek1TotalMiles ?? taper?.week1TotalMiles;
  const taper1Long = row.taperWeek1LongRunMiles ?? taper?.week1LongRunMiles;
  const taper2 = row.taperWeek2TotalMiles ?? taper?.week2TotalMiles;
  const taper2Long = row.taperWeek2LongRunMiles ?? taper?.week2LongRunMiles;
  return [
    `- long-run entry vs long-run peak: ${entry ?? "(missing)"} vs ${peakLong ?? "(missing)"}`,
    `- base peak long run vs build start: ${finite(base?.peakLongRunMiles) ?? "(no base)"} vs ${finite(build?.startLongRunMiles) ?? "(missing)"}`,
    `- build peak long run: ${peakLong ?? "(missing)"}`,
    `- peak weekly: ${peakWeekly ?? "(missing)"}`,
    `- taper caps: W1 ${taper1 ?? "—"} / LR ${taper1Long ?? "—"} · W2 ${taper2 ?? "—"} / LR ${taper2Long ?? "—"}`,
    `- race-week slot sum (miles, off days excluded): ${raceWeekMilesSum(row.raceWeekDayMiles) ?? raceWeekMilesSum(row.raceWeekPreset?.slots) ?? "(none)"}`,
    `- longRunCutback ${cut ?? "(missing, defaults to 0.20)"} yields two cutbacks (weeks 4 and 7) on an 8-week build to peak at factor ${factor}`,
  ];
}

function marathonReasonablenessLines(row: PresetValidateRow): string[] {
  const warnings: string[] = [];
  const peakLong = finite(row.peakLongRunMiles) ?? finite(row.buildPreset?.peakLongRunMiles);
  const peakWeekly = finite(row.maxWeeklyMiles) ?? finite(row.buildPreset?.maxWeeklyMiles);
  if (peakLong != null && (peakLong < 16 || peakLong > 22)) {
    warnings.push(`- warning: peak long run ${peakLong} is outside the marathon band of about 16–22`);
  }
  if (peakWeekly != null && (peakWeekly < 35 || peakWeekly > 70)) {
    warnings.push(`- warning: peak weekly ${peakWeekly} is outside the marathon band of about 35–70`);
  }
  if (peakWeekly != null && row.taperPreset) {
    for (const total of [
      row.taperWeek1TotalMiles ?? row.taperPreset.week1TotalMiles,
      row.taperWeek2TotalMiles ?? row.taperPreset.week2TotalMiles,
    ]) {
      if (typeof total === "number" && total >= peakWeekly) {
        warnings.push(`- warning: taper total ${total} is not below peak weekly ${peakWeekly}`);
      }
    }
  }
  const raceSum = raceWeekMilesSum(row.raceWeekDayMiles) ?? raceWeekMilesSum(row.raceWeekPreset?.slots);
  if (peakWeekly != null && raceSum != null && raceSum >= peakWeekly) {
    warnings.push(`- warning: race-week slot sum ${raceSum} is not below peak weekly ${peakWeekly}`);
  }
  if (warnings.length === 0) {
    return ["- No marathon-band warnings. These notes are warnings, not hard failures."];
  }
  return warnings;
}

export const PRESET_VALIDATE_LLM_INSTRUCTION = `Instruction:
- Persona is optional. Do not require a persona link. Mention one only when it is stored.
- Split the review into stored values, derived boundaries, and athlete-specific facts. Athlete start (current weekly miles and longest recent run) is not on the preset.
- Marathon reasonableness is a warning band (peak long run roughly 16–22, peak weekly roughly 35–70, taper and race week below the peak), not a hard fail.
- Flag deprecated TM-only columns that still hold data — prod athlete app does not store those on the preset row.
- Do not invent catalogue or rotation config ids. Do not request taper slots, race-week slots, or rotation ids. Phase slots are rotation names. An empty phase-slot cell leaves that slot empty. The same phase name may be used for more than one phase.
- For fixes, return a CSV with columns field,value (one row per field to change). Leave value blank only when keeping on file. Writable fields: ${PRESET_PATCH_WRITABLE_FIELDS.join(", ")}.`;

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
      line("paceNudgeSecPerMile", row.paceNudgeSecPerMile ?? 0),
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
    block("Preset miles", [
      line("entryLongRunMiles", row.entryLongRunMiles),
      line("peakLongRunMiles", row.peakLongRunMiles),
      line("baseWeeklyMinMiles", row.baseWeeklyMinMiles),
      line("baseWeeklyMaxMiles", row.baseWeeklyMaxMiles),
      line("raceWeekMiles", row.raceWeekMiles),
      line("baseEndWeeklyMiles", row.baseEndWeeklyMiles),
      line("longRunCutback", row.longRunCutback),
      line("taperWeek1TotalMiles", row.taperWeek1TotalMiles),
      line("taperWeek1LongRunMiles", row.taperWeek1LongRunMiles),
      line("taperWeek2TotalMiles", row.taperWeek2TotalMiles),
      line("taperWeek2LongRunMiles", row.taperWeek2LongRunMiles),
      line("raceWeekDayMiles", row.raceWeekDayMiles),
    ]),
    "",
    block("Phase presets", [
      line("baseBuildPhaseName", row.baseBuildPhasePreset?.name),
      line("baseBuildLongRun", row.baseBuildPhasePreset?.longRunConfig?.name),
      line("baseBuildEasy", row.baseBuildPhasePreset?.easyConfig?.name),
      line("baseBuildTempo", row.baseBuildPhasePreset?.tempoConfig?.name),
      line("baseBuildIntervals", row.baseBuildPhasePreset?.intervalsConfig?.name),
      line("buildToPeakPhaseName", row.buildToPeakPhasePreset?.name),
      line("buildToPeakLongRun", row.buildToPeakPhasePreset?.longRunConfig?.name),
      line("buildToPeakEasy", row.buildToPeakPhasePreset?.easyConfig?.name),
      line("buildToPeakTempo", row.buildToPeakPhasePreset?.tempoConfig?.name),
      line("buildToPeakIntervals", row.buildToPeakPhasePreset?.intervalsConfig?.name),
      line("taperPhaseName", row.taperPhasePreset?.name),
      line("taperLongRun", row.taperPhasePreset?.longRunConfig?.name),
      line("taperEasy", row.taperPhasePreset?.easyConfig?.name),
      line("taperTempo", row.taperPhasePreset?.tempoConfig?.name),
      line("taperIntervals", row.taperPhasePreset?.intervalsConfig?.name),
      line("raceWeekPhaseName", row.raceWeekPhasePreset?.name),
      line("raceWeekLongRun", row.raceWeekPhasePreset?.longRunConfig?.name),
      line("raceWeekEasy", row.raceWeekPhasePreset?.easyConfig?.name),
      line("raceWeekTempo", row.raceWeekPhasePreset?.tempoConfig?.name),
      line("raceWeekIntervals", row.raceWeekPhasePreset?.intervalsConfig?.name),
    ]),
    "",
    block("Stored values", [
      "The blocks above are values stored on the preset and its linked phases.",
      line("paceNudgeSecPerMile", row.paceNudgeSecPerMile ?? 0),
    ]),
    "",
    block("Derived boundaries", derivedBoundaryLines(row)),
    "",
    block("Athlete-specific", [
      "- Athlete start is not on the preset. Current weekly miles, longest recent run, and a return from injury are read from the athlete when the plan is generated.",
    ]),
    "",
    block("Marathon reasonableness (warnings, not failures)", marathonReasonablenessLines(row)),
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
      line("paceNudgeSecPerMile", preset.paceNudgeSecPerMile ?? 0),
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
