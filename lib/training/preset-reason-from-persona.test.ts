import assert from "node:assert/strict";
import test from "node:test";
import { selectPersonaFillFields } from "@/lib/training/preset-reason-from-persona";

test("persona fill keeps known miles and drops invented rotations", () => {
  const fields = selectPersonaFillFields({
    proposed: [
      { field: "baseStartLongRunMiles", value: "8" },
      { field: "minWeeklyMiles", value: "42" },
      { field: "buildToPeakLongRun", value: "Made up long run" },
      { field: "buildToPeakPhaseName", value: "marathon peak" },
      { field: "paceNudgeSecPerMile", value: "-10" },
    ],
    current: { minWeeklyMiles: "42", baseStartLongRunMiles: "" },
    phaseNames: ["Marathon peak"],
    rotationNames: { longRun: ["Steady 20"], easy: [], tempo: [], intervals: [] },
  });

  assert.deepEqual(
    fields.map((field) => field.field),
    ["baseStartLongRunMiles", "buildToPeakPhaseName"],
  );
  assert.equal(fields[1]?.value, "Marathon peak");
});
