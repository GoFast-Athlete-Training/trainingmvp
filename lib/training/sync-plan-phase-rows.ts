import type { Prisma } from "@prisma/client";
import { planPresetBodyForBuild, planPresetBodyForTaper } from "@/lib/training/copy-plan-body-to-build";

type Tx = Prisma.TransactionClient;

export async function syncPhaseRowsFromPlanPreset(tx: Tx, planId: string) {
  const plan = await tx.training_plan_preset.findUnique({ where: { id: planId } });
  if (!plan) return;

  const buildBody = planPresetBodyForBuild(plan) as Prisma.build_presetUncheckedCreateInput;
  let buildPresetId = plan.buildPresetId;
  if (!buildPresetId) {
    const created = await tx.build_preset.create({
      data: { ...buildBody, name: "Build" },
    });
    buildPresetId = created.id;
  } else {
    await tx.build_preset.update({
      where: { id: buildPresetId },
      data: buildBody,
    });
  }

  const taperBody = planPresetBodyForTaper(plan) as Prisma.taper_presetUncheckedCreateInput;
  let taperPresetId = plan.taperPresetId;
  if (!taperPresetId) {
    const created = await tx.taper_preset.create({
      data: { ...taperBody, name: "Taper" },
    });
    taperPresetId = created.id;
  } else {
    await tx.taper_preset.update({
      where: { id: taperPresetId },
      data: taperBody,
    });
  }

  let raceWeekPresetId = plan.raceWeekPresetId;
  if (!raceWeekPresetId) {
    const created = await tx.race_week_preset.create({
      data: { title: "Race week" },
    });
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
      snapPeakLongRunMiles: build?.peakLongRunPoolMiles ?? null,
      snapPeakWeeklyMiles: build?.maxWeeklyMiles ?? null,
      snapTaperWeek1TotalMiles: taper?.week1TotalMiles ?? null,
      snapTaperWeek1LongRunMiles: taper?.week1LongRunMiles ?? null,
      snapTaperWeek2TotalMiles: taper?.week2TotalMiles ?? null,
      snapTaperWeek2LongRunMiles: taper?.week2LongRunMiles ?? null,
    },
  });
}
