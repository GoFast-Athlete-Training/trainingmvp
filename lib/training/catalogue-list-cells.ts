/** List/table display helpers — aligned with Company training-engine catalogue page. */

export type CatalogueListRow = {
  paceAnchor?: string | null;
  mpPaceOffsetSecPerMile?: number | null;
  workPaceOffsetSecPerMile?: number | null;
  workBaseReps?: number | null;
  workBaseRepMeters?: number | null;
  reps?: number | null;
  repDistanceMeters?: number | null;
  segmentPaceDist?: unknown;
  segmentPatternJson?: unknown;
  workSegmentsJson?: unknown;
  trainingIntent?: string[] | null;
  runSubType?: string | null;
};

export function trainingIntentListCell(it: CatalogueListRow): string {
  const ti = it.trainingIntent;
  if (!Array.isArray(ti) || ti.length === 0) return "—";
  return ti.filter(Boolean).join(", ");
}

export function paceCell(it: CatalogueListRow): string {
  const wj = it.segmentPaceDist ?? it.segmentPatternJson ?? it.workSegmentsJson;
  if (wj != null && typeof wj === "object" && !Array.isArray(wj)) {
    const o = wj as Record<string, unknown>;
    if (o.layout === "blockRepeat") {
      const segs = Array.isArray(o.segments) ? o.segments.length : 0;
      const rc = o.repeatCount != null && Number(o.repeatCount) >= 1 ? Number(o.repeatCount) : "?";
      return `repeat ×${rc} · ${segs} seg${segs === 1 ? "" : "s"}`;
    }
  }
  if (Array.isArray(wj) && wj.length > 0) {
    const first = wj[0] as Record<string, unknown>;
    if (typeof first?.miles === "number") {
      return `${wj.length} segs`;
    }
    if (typeof first?.distanceMeters === "number") {
      return `${wj.length} rep grps`;
    }
  }
  const isMp = it.paceAnchor === "mpSimulation";
  const label = isMp ? "MP sim" : "fitness";
  const off = isMp
    ? (it.mpPaceOffsetSecPerMile ?? it.workPaceOffsetSecPerMile)
    : it.workPaceOffsetSecPerMile;
  if (off != null && Number.isFinite(Number(off))) {
    const n = Number(off);
    const sign = n > 0 ? "+" : "";
    return `${label} ${sign}${n}s/mi`;
  }
  return label;
}

export function repsCell(it: CatalogueListRow): string {
  const r = it.workBaseReps ?? it.reps;
  const m = it.workBaseRepMeters ?? it.repDistanceMeters;
  return r != null && m != null ? `${r}×${m}m` : "—";
}
