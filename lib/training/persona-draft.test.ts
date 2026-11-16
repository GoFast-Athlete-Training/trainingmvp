import assert from "node:assert/strict";
import test from "node:test";
import { buildPersonaSlug } from "@/lib/training/plan-entity-slugs";
import { validatePersonaDraft } from "@/lib/training/persona-draft";

const BQ_DESCRIPTION = [
  "Advanced marathoner who runs 45–50 miles per week.",
  "Near or already at Boston Qualifying performance and wants to improve their marathon PR.",
  "Handles high-intensity training, prefers moderate volume, and balances training with work, family, and recovery.",
  "Wants sustainable training rather than adding mileage.",
].join(" ");

const PRIORITIES =
  "Prioritize marathon-specific intensity and aerobic durability within a sustainable 45–50-mile training structure. Emphasize threshold development, marathon-pace workouts, progressive long runs, and recovery rather than increasing volume unnecessarily.";

test("persona slug without a title stays capability-distance-kind", () => {
  assert.equal(
    buildPersonaSlug({
      capability: "COMPETITIVE",
      targetDistanceLabel: "Marathon",
      goalKind: "RACE",
    }),
    "comp-marathon-race",
  );
});

test("BQ marathoner draft keeps stated training characteristics", () => {
  const draft = validatePersonaDraft(
    {
      title: "Advanced BQ marathoner",
      capability: "ELITE",
      dedication: "HIGH",
      workoutFrequencyCap: 6,
      personaGoalLabel: "competitive marathon",
      intentSummary: "We are trying to get faster.",
      athletePersonaSummary: "A competitive runner with high dedication.",
      targetDistanceLabel: "Marathon",
      goalKind: "RACE",
      minWeeklyMiles: 45,
      maxWeeklyMiles: 50,
      trainingProfile: {
        experience: { value: "Advanced", source: "explicit" },
        primaryGoal: { value: "Marathon PR and Boston Qualifying", source: "explicit" },
        targetDistance: { value: "Marathon", source: "explicit" },
        weeklyMileage: { value: "45–50 miles per week", source: "explicit" },
        volumeTolerance: { value: "Moderate", source: "explicit" },
        intensityTolerance: { value: "High", source: "explicit" },
        trainingFrequency: { value: "6 days per week", source: "inferred" },
        lifestyleConstraints: { value: "Work, family, and recovery", source: "explicit" },
        recoveryConsiderations: { value: "Balance training with recovery", source: "explicit" },
        coachingPhilosophy: { value: "Keep training sustainable and do not add volume", source: "explicit" },
        trainingPriorities: { value: PRIORITIES, source: "inferred" },
      },
    },
    BQ_DESCRIPTION,
  );

  assert.equal(draft.capability, "COMPETITIVE");
  assert.equal(draft.dedication, null);
  assert.equal(draft.workoutFrequencyCap, null);
  assert.equal("minWeeklyMiles" in draft, false);
  assert.equal("maxWeeklyMiles" in draft, false);
  assert.match(draft.trainingProfile?.weeklyMileage?.value ?? "", /45/);
  assert.match(draft.trainingProfile?.weeklyMileage?.value ?? "", /50/);
  assert.equal(draft.trainingProfile?.experience?.value, "Advanced");
  assert.match(draft.trainingProfile?.primaryGoal?.value ?? "", /marathon pr/i);
  assert.match(draft.trainingProfile?.primaryGoal?.value ?? "", /boston qualifying/i);
  assert.match(draft.trainingProfile?.intensityTolerance?.value ?? "", /high/i);
  assert.match(draft.trainingProfile?.volumeTolerance?.value ?? "", /moderate/i);
  assert.equal(draft.trainingProfile?.trainingFrequency, undefined);
  assert.match(draft.intentSummary, /45/);
  assert.match(draft.intentSummary, /50/);
  assert.match(draft.intentSummary, /sustainable/i);
  assert.match(draft.athletePersonaSummary, /45/);
  assert.match(draft.athletePersonaSummary, /high/i);
  assert.match(draft.athletePersonaSummary, /moderate/i);
  assert.match(draft.athletePersonaSummary, /sustain/i);
  assert.equal(draft.slug, "comp-marathon-race-advanced-bq-marathoner");
});

test("invented mileage and frequency are dropped", () => {
  const draft = validatePersonaDraft(
    {
      title: "Advanced BQ marathoner",
      capability: "COMPETITIVE",
      trainingProfile: {
        weeklyMileage: { value: "70 miles per week", source: "explicit" },
        trainingFrequency: { value: "6 days per week", source: "inferred" },
        volumeTolerance: { value: "Moderate", source: "explicit" },
      },
    },
    BQ_DESCRIPTION,
  );

  assert.equal(draft.trainingProfile?.weeklyMileage, undefined);
  assert.equal(draft.trainingProfile?.trainingFrequency, undefined);
  assert.equal(draft.trainingProfile?.volumeTolerance?.value, "Moderate");
});

test("explicit dedication and frequency survive when the description states them", () => {
  const description = "Recreational runner with moderate dedication who trains 4 days per week.";
  const draft = validatePersonaDraft(
    {
      title: "Four day recreational",
      capability: "RECREATIONAL",
      dedication: "HIGH",
      workoutFrequencyCap: 7,
      trainingProfile: {
        trainingFrequency: { value: "4 days per week", source: "explicit" },
      },
    },
    description,
  );

  assert.equal(draft.dedication, "MODERATE");
  assert.equal(draft.workoutFrequencyCap, 4);
  assert.equal(draft.trainingProfile?.trainingFrequency?.value, "4 days per week");
});
