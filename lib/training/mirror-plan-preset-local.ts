import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MILE_KEYS = [
  "entryLongRunMiles",
  "peakLongRunMiles",
  "baseEndLongRunMiles",
  "baseEndWeeklyMiles",
  "baseWeeklyMinMiles",
  "baseWeeklyMaxMiles",
  "raceWeekMiles",
  "longRunCutback",
  "taperWeek1TotalMiles",
  "taperWeek1LongRunMiles",
  "taperWeek2TotalMiles",
  "taperWeek2LongRunMiles",
] as const;

const PHASE_KEYS = [
  "baseBuildPhasePresetId",
  "buildToPeakPhasePresetId",
  "taperPhasePresetId",
  "raceWeekPhasePresetId",
] as const;

/** Keep the Training Manage copy aligned so the next prodpush does not wipe prod miles or pointers. */
export async function mirrorPlanPresetLocal(id: string, body: Record<string, unknown>) {
  const data: Prisma.training_plan_presetUncheckedUpdateManyInput = {};

  for (const key of MILE_KEYS) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (raw === null || raw === "") {
      data[key] = null;
      continue;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
      data[key] =
        key === "baseEndWeeklyMiles" || key === "baseWeeklyMinMiles" || key === "baseWeeklyMaxMiles"
          ? Math.round(raw)
          : raw;
    }
  }

  if ("raceWeekDayMiles" in body) {
    data.raceWeekDayMiles =
      body.raceWeekDayMiles == null ? Prisma.DbNull : (body.raceWeekDayMiles as Prisma.InputJsonValue);
  }

  for (const key of PHASE_KEYS) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (raw === null || raw === "") {
      data[key] = null;
      continue;
    }
    if (typeof raw !== "string" || !raw.trim()) continue;
    const phase = await prisma.phase_preset.findUnique({ where: { id: raw.trim() }, select: { id: true } });
    if (phase) data[key] = phase.id;
  }

  if (Object.keys(data).length === 0) return;
  await prisma.training_plan_preset.updateMany({ where: { id }, data });
}
