import assert from "node:assert/strict";
import test from "node:test";
import { parseWorkoutSegmentsCsv, WORKOUT_SEGMENT_CSV_TEMPLATE } from "./parse-workout-segments-csv";

test("parseWorkoutSegmentsCsv reads the template into paced steps", () => {
  const parsed = parseWorkoutSegmentsCsv(WORKOUT_SEGMENT_CSV_TEMPLATE);
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.steps.length, 3);
  assert.equal(parsed.steps[1]?.repeatCount, 3);
  assert.equal(parsed.steps[1]?.recoveryDurationType, "DISTANCE");
  assert.equal(parsed.steps[1]?.recoveryDurationValue, 0.5);
  const pace = parsed.steps[1]?.targets?.[0];
  assert.equal(pace?.type, "PACE");
  assert.equal(pace?.valueLow, 254.8);
  assert.equal(pace?.valueHigh, 261);
});

test("parseWorkoutSegmentsCsv rejects a bad duration", () => {
  const parsed = parseWorkoutSegmentsCsv("title,durationType,durationValue\nWarmup,DISTANCE,0\n");
  assert.match(parsed.error ?? "", /durationValue/);
});
