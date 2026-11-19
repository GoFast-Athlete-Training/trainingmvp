/** Warmup + work + cooldown for a catalogue row. Mirrors prod `catalogueWarmupWorkCooldownMiles`. */

type BookendInput = {
  warmupMiles?: unknown;
  cooldownMiles?: unknown;
  workBaseMiles?: unknown;
  workBaseReps?: unknown;
  workBaseRepMeters?: unknown;
  segmentPaceDist?: unknown;
};

function positive(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function segmentMiles(segment: unknown): number | null {
  if (segment == null || typeof segment !== "object" || Array.isArray(segment)) return null;
  const row = segment as { miles?: unknown; distanceMeters?: unknown; reps?: unknown };
  let miles: number | null = null;
  if (row.miles != null && row.miles !== "") {
    const parsed = Number(row.miles);
    if (Number.isFinite(parsed) && parsed > 0) miles = parsed;
  }
  if (miles == null && row.distanceMeters != null && row.distanceMeters !== "") {
    const meters = Number(row.distanceMeters);
    if (Number.isFinite(meters) && meters > 0) miles = meters / 1609.34;
  }
  if (miles == null) return null;
  const repsRaw = Number(row.reps);
  const reps = Number.isFinite(repsRaw) && repsRaw > 0 ? Math.max(1, Math.round(repsRaw)) : 1;
  return miles * reps;
}

export function catalogueWarmupWorkCooldownMiles(row: BookendInput | null | undefined): number | null {
  if (!row) return null;
  const warmup = positive(row.warmupMiles) ?? 0;
  const cooldown = positive(row.cooldownMiles) ?? 0;
  let work = 0;
  const pace = row.segmentPaceDist;
  if (pace != null && typeof pace === "object" && !Array.isArray(pace)) {
    const block = pace as { layout?: unknown; segments?: unknown; repeatCount?: unknown };
    if (block.layout === "blockRepeat" && Array.isArray(block.segments)) {
      const cycle = block.segments.reduce((sum, segment) => sum + (segmentMiles(segment) ?? 0), 0);
      const repeatRaw = Number(block.repeatCount);
      const repeat =
        Number.isFinite(repeatRaw) && repeatRaw >= 1 ? Math.min(99, Math.round(repeatRaw)) : 1;
      if (cycle > 0) work = cycle * repeat;
    }
  } else if (Array.isArray(pace)) {
    work = pace.reduce((sum, segment) => sum + (segmentMiles(segment) ?? 0), 0);
  }
  if (work <= 0) {
    const base = positive(row.workBaseMiles);
    if (base != null) work = base;
  }
  if (work <= 0) {
    const reps = positive(row.workBaseReps);
    const meters = positive(row.workBaseRepMeters);
    if (reps != null && meters != null) work = (reps * meters) / 1609.34;
  }
  const total = warmup + work + cooldown;
  if (total <= 0) return null;
  return Math.round(total * 10) / 10;
}
