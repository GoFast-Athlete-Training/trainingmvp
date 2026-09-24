import type { Prisma } from "@prisma/client";
import { rotationIdsForTaper, rotationIdsFromPlan } from "@/lib/training/copy-plan-body-to-build";

type Tx = Prisma.TransactionClient;

export async function syncPhaseRowsFromPlanPreset(tx: Tx, planId: string) {
  const plan = await tx.training_plan_preset.findUnique({ where: { id: planId } });
  if (!plan) return;

  const rotations = rotationIdsFromPlan(plan);
  let buildPresetId = plan.buildPresetId;
  if (!buildPresetId) {
    const created = await tx.build_preset.create({
      data: { name: "Untitled", ...rotations },
    });
    buildPresetId = created.id;
  } else {
    await tx.build_preset.update({ where: { id: buildPresetId }, data: rotations });
  }

  const taperRotations = rotationIdsForTaper(plan);
  let taperPresetId = plan.taperPresetId;
  if (!taperPresetId) {
    const created = await tx.taper_preset.create({
      data: { name: "Untitled", ...taperRotations },
    });
    taperPresetId = created.id;
  } else {
    await tx.taper_preset.update({ where: { id: taperPresetId }, data: taperRotations });
  }

  let raceWeekPresetId = plan.raceWeekPresetId;
  if (!raceWeekPresetId) {
    const created = await tx.race_week_preset.create({ data: { title: "Untitled" } });
    raceWeekPresetId = created.id;
  }

  const build = await tx.build_preset.findUnique({ where: { id: buildPresetId } });
  const taper = await tx.taper_preset.findUnique({ where: { id: taperPresetId } });

  await tx.training_plan_preset.update({
    where: { id: planId },
    data: {
      buildPresetId,
      taperPresetId,
      raceWeekPresetId,
      snapPeakLongRunMiles: build?.peakLongRunMiles ?? null,
      snapPeakWeeklyMiles: build?.maxWeeklyMiles ?? null,
      snapTaperWeek1TotalMiles: taper?.week1TotalMiles ?? null,
      snapTaperWeek1LongRunMiles: taper?.week1LongRunMiles ?? null,
      snapTaperWeek2TotalMiles: taper?.week2TotalMiles ?? null,
      snapTaperWeek2LongRunMiles: taper?.week2LongRunMiles ?? null,
    },
  });
}
