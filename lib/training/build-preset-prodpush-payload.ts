import { loadPresetForGenerate } from "@/lib/training/preset-for-generate";

export async function buildPresetProdPushPayload(presetId: string) {
  const phaseGenerate = await loadPresetForGenerate(presetId);
  if (!phaseGenerate) {
    throw new Error(`Preset ${presetId} not found`);
  }
  if (!phaseGenerate.build) {
    throw new Error(`Preset ${presetId} has no build phase — cannot mirror to prod`);
  }

  const build = phaseGenerate.build;
  const peakPool =
    build.peakLongRunMiles != null && Number.isFinite(build.peakLongRunMiles)
      ? build.peakLongRunMiles * 4
      : 32;

  const preset: Record<string, unknown> = {
    id: phaseGenerate.id,
    slug: phaseGenerate.slug,
    title: phaseGenerate.title,
    publicDescription: phaseGenerate.publicDescription,
    targetDistanceLabel: phaseGenerate.targetDistanceLabel,
    minWeeklyMiles: phaseGenerate.minWeeklyMiles,
    maxWeeklyMiles: phaseGenerate.maxWeeklyMiles,
    tempoIdealDow: phaseGenerate.tempoIdealDow,
    intervalIdealDow: phaseGenerate.intervalIdealDow,
    longRunDefaultDow: phaseGenerate.longRunDefaultDow,
    coachPlanOverview: phaseGenerate.coachPlanOverview,
    workoutStructure: phaseGenerate.workoutStructure,
    easyRunConfig: phaseGenerate.easyRunConfig,
    baseLongRunPoolMiles: peakPool > 0 ? peakPool * 0.6 : 24,
    peakLongRunPoolMiles: peakPool > 0 ? peakPool : 32,
    taperLongRunPoolMiles: peakPool > 0 ? peakPool * 0.5 : 16,
    longRunConfig: build.longRunConfig,
    intervalsConfig: build.intervalsConfig,
    tempoConfig: build.tempoConfig,
    easyConfig: build.easyConfig,
  };

  return { preset, phaseGenerate };
}
