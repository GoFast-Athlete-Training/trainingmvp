import { Prisma } from "@prisma/client";
import { bodyToCatalogueRow } from "@/lib/training/catalogue-row";
import { generateCatalogueSlug } from "@/lib/catalogue-slug";

export type CatalogueRowData = Extract<
  ReturnType<typeof bodyToCatalogueRow>,
  { ok: true }
>["data"];

export function parseCatalogueBody(body: Record<string, unknown>) {
  return bodyToCatalogueRow(body);
}

export function catalogueDataToPrismaWrite(
  d: CatalogueRowData,
): Omit<Prisma.workout_catalogueUncheckedCreateInput, "id" | "createdAt"> {
  return {
    name: d.name,
    runSubType: d.runSubType,
    slug: d.slug ?? generateCatalogueSlug(d.name),
    description: d.description,
    workoutType: d.workoutType,
    segmentPaceDist:
      d.segmentPaceDist === null ? Prisma.JsonNull : (d.segmentPaceDist as Prisma.InputJsonValue),
    warmupFraction: d.warmupFraction,
    workFraction: d.workFraction,
    cooldownFraction: d.cooldownFraction,
    paceAnchor: d.paceAnchor,
    mpFraction: d.mpFraction,
    mpBlockPosition: d.mpBlockPosition,
    mpBlockProgression: d.mpBlockProgression,
    workBaseReps: d.workBaseReps,
    workBaseRepMeters: d.workBaseRepMeters,
    recoveryDistanceMeters: d.recoveryDistanceMeters,
    recoveryDurationSeconds: d.recoveryDurationSeconds,
    warmupMiles: d.warmupMiles,
    warmupPaceOffsetSecPerMile: d.warmupPaceOffsetSecPerMile,
    cooldownMiles: d.cooldownMiles,
    cooldownPaceOffsetSecPerMile: d.cooldownPaceOffsetSecPerMile,
    workBaseMiles: d.workBaseMiles,
    workPaceOffsetSecPerMile: d.workPaceOffsetSecPerMile,
    workBasePaceOffsetSecPerMile: d.workBasePaceOffsetSecPerMile,
    recoveryPaceOffsetSecPerMile: d.recoveryPaceOffsetSecPerMile,
    mpTotalMiles: d.mpTotalMiles,
    mpPaceOffsetSecPerMile: d.mpPaceOffsetSecPerMile,
    intendedHeartRateZone: d.intendedHeartRateZone,
    intendedHRBpmLow: d.intendedHRBpmLow,
    intendedHRBpmHigh: d.intendedHRBpmHigh,
    notes: d.notes,
    ...(d.trainingIntent !== undefined ? { trainingIntent: d.trainingIntent } : {}),
  };
}
