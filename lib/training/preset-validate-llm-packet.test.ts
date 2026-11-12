import assert from "node:assert/strict";
import test from "node:test";
import { buildPresetValidateLlmPacket } from "@/lib/training/preset-validate-llm-packet";
import type { PresetValidateRow } from "@/lib/training/preset-validate-load";

test("llm packet splits stored, derived, and athlete-specific and does not require persona", () => {
  const row = {
    id: "preset-1",
    slug: "advanced-marathon",
    title: "Advanced Marathon",
    description: "Staff note",
    publicDescription: "A marathon build",
    targetDistanceLabel: "Marathon",
    minWeeklyMiles: 40,
    maxWeeklyMiles: 55,
    paceNudgeSecPerMile: 0,
    coachIntent: null,
    objectiveOfPlan: null,
    tempoIdealDow: 2,
    intervalIdealDow: 4,
    longRunDefaultDow: 6,
    persona: null,
    goal: null,
    athletePersonaCapability: null,
    athletePersonaGoal: null,
    athletePersonaDedication: null,
    baseBuildPreset: {
      name: "Base",
      startLongRunMiles: 10,
      peakLongRunMiles: 12,
      maxWeeklyMiles: 40,
    },
    buildPreset: {
      name: "Peak",
      startLongRunMiles: 12,
      peakLongRunMiles: 20,
      maxWeeklyMiles: 55,
      longRunCutback: 0.2,
    },
    taperPreset: {
      name: "Taper",
      week1TotalMiles: 40,
      week1LongRunMiles: 12,
      week2TotalMiles: 28,
      week2LongRunMiles: 8,
    },
    raceWeekPreset: {
      title: "Race week",
      slots: [{ offsetFromRace: -1, type: "easy", prescribedMiles: 3, runName: "Shake" }],
    },
    snapPeakLongRunMiles: null,
    snapPeakWeeklyMiles: null,
    snapTaperWeek1TotalMiles: null,
    snapTaperWeek1LongRunMiles: null,
    snapTaperWeek2TotalMiles: null,
    snapTaperWeek2LongRunMiles: null,
    coachPlanOverview: null,
    workoutStructure: null,
    easyRunConfig: null,
    longRunConfigId: null,
    intervalsConfigId: null,
    tempoConfigId: null,
    easyConfigId: null,
    longRunCycleWeeks: null,
  } as unknown as PresetValidateRow;

  const packet = buildPresetValidateLlmPacket(row);
  assert.match(packet, /Stored values/);
  assert.match(packet, /Derived boundaries/);
  assert.match(packet, /Athlete-specific/);
  assert.match(packet, /paceNudgeSecPerMile: 0/);
  assert.match(packet, /Persona is optional/);
  assert.match(packet, /not a hard fail/);
  assert.match(packet, /Do not request taper slots, race-week slots, or rotation ids/);
  assert.doesNotMatch(packet, /Say which athlete type this preset is for/);
  assert.match(packet, /two cutbacks/);
  assert.match(packet, /Athlete start is not on the preset/);
});
