import assert from "node:assert/strict";
import test from "node:test";
import { selectCheckFieldIssues } from "@/lib/training/preset-check-fields";

test("check-fields keeps notes and drops replacement values and blank rows", () => {
  const issues = selectCheckFieldIssues([
    { field: "peakLongRunMiles", note: "Above the marathon band.", value: "18" },
    { field: "peakLongRunMiles", note: "Duplicate." },
    { field: "", note: "Missing field." },
    { field: "maxWeeklyMiles", note: "   " },
    { field: "not a field", note: "Spaces are not a field name." },
    { field: "taperWeek1TotalMiles", note: "Taper total is not below peak weekly." },
  ]);

  assert.deepEqual(issues, [
    { field: "peakLongRunMiles", note: "Above the marathon band." },
    { field: "taperWeek1TotalMiles", note: "Taper total is not below peak weekly." },
  ]);
});
