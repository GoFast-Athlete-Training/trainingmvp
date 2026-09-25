/** User-facing copy for plan preset list and wizard — not DB field names. */

export function formatPeakMileageSummary(
  peakLongRunMiles: number | null,
  peakWeeklyMiles: number | null,
): string | null {
  const lr = peakLongRunMiles != null ? `${peakLongRunMiles} mi long run` : null;
  const wk = peakWeeklyMiles != null ? `${peakWeeklyMiles} mi/week at peak` : null;
  if (lr && wk) return `Up to ${lr} · ${wk}`;
  if (lr) return `Up to ${lr}`;
  if (wk) return wk;
  return null;
}

export function peakMileagePendingHint(hasBuildLinked: boolean): string | null {
  if (!hasBuildLinked) return null;
  return "Peak mileage appears after you save the build step";
}

function isGenericPhaseName(name: string, generic: string): boolean {
  return name.trim().toLowerCase() === generic.toLowerCase();
}

/** Short meta line for preset cards — distance, peaks, named phases only when not factory defaults. */
export function presetListMetaParts(input: {
  targetDistanceLabel: string | null;
  snapPeakLongRunMiles: number | null;
  snapPeakWeeklyMiles: number | null;
  buildPreset: { name: string } | null;
  taperPreset: { name: string } | null;
  raceWeekPreset: { title: string } | null;
}): string[] {
  const parts: string[] = [];
  if (input.targetDistanceLabel?.trim()) {
    parts.push(input.targetDistanceLabel.trim());
  }
  const peaks = formatPeakMileageSummary(
    input.snapPeakLongRunMiles,
    input.snapPeakWeeklyMiles,
  );
  if (peaks) parts.push(peaks);
  else {
    const pending = peakMileagePendingHint(Boolean(input.buildPreset));
    if (pending) parts.push(pending);
  }
  if (
    input.buildPreset?.name &&
    !isGenericPhaseName(input.buildPreset.name, "Build")
  ) {
    parts.push(`Build: ${input.buildPreset.name}`);
  }
  if (
    input.taperPreset?.name &&
    !isGenericPhaseName(input.taperPreset.name, "Taper")
  ) {
    parts.push(`Taper: ${input.taperPreset.name}`);
  }
  if (
    input.raceWeekPreset?.title &&
    !isGenericPhaseName(input.raceWeekPreset.title, "Race week")
  ) {
    parts.push(`Race week: ${input.raceWeekPreset.title}`);
  }
  return parts;
}
