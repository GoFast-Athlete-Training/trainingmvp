import assert from "node:assert/strict";
import test from "node:test";
import { selectPersonaFillFields } from "@/lib/training/preset-reason-from-persona";

test("persona fill keeps the band and long runs, and only an empty cap", () => {
  const fields = selectPersonaFillFields({
    proposed: [
      { field: "baseStartLongRunMiles", value: "8" },
      { field: "minWeeklyMiles", value: "42" },
      { field: "baseWeeklyMinMiles", value: "30" },
      { field: "baseWeeklyMaxMiles", value: "40" },
      { field: "peakWeeklyVolumeMiles", value: "55" },
      { field: "buildToPeakLongRun", value: "Made up long run" },
      { field: "buildToPeakPhaseName", value: "marathon peak" },
      { field: "taperWeek1TotalMiles", value: "35" },
      { field: "raceWeekMiles", value: "12" },
      { field: "paceNudgeSecPerMile", value: "-10" },
    ],
    current: {
      minWeeklyMiles: "42",
      baseStartLongRunMiles: "",
      taperWeek1TotalMiles: "40",
      raceWeekMiles: "",
    },
  });

  assert.deepEqual(
    fields.map((field) => field.field),
    ["baseStartLongRunMiles", "raceWeekMiles"],
  );
  assert.equal(fields[0]?.value, "8");
  assert.equal(fields[1]?.value, "12");
});
