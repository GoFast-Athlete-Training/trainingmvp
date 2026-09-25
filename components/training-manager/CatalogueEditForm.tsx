"use client";

import { useState } from "react";
import { authFetch } from "@/components/AppProviders";
import { generateCatalogueSlug } from "@/lib/catalogue-slug";
import { normalizeTrainingIntentArray } from "@/lib/catalogue-training-intents";
import { CANONICAL_PACE_KEYS } from "@/lib/training/preset-strategy";
import {
  segmentPayloadFromMetersRow,
  segmentPayloadFromMilesRow,
} from "@/lib/training/pace-key-catalogue";

export type CatalogueFormItem = {
  id: string;
  name: string;
  slug?: string | null;
  runSubType?: string | null;
  description?: string | null;
  workoutType: string;
  paceAnchor: string;
  /** JSON: per-segment pace + distance (mile ladders, block repeat, etc.). Legacy rows may use older keys. */
  segmentPaceDist?: unknown;
  /** @deprecated Prefer segmentPaceDist */
  segmentPatternJson?: unknown;
  /** @deprecated Prefer segmentPaceDist */
  workSegmentsJson?: unknown;
  warmupFraction?: number | null;
  workFraction?: number | null;
  cooldownFraction?: number | null;
  workBaseMiles?: number | null;
  workPaceOffsetSecPerMile?: number | null;
  workBasePaceOffsetSecPerMile?: number | null;
  workBaseReps?: number | null;
  workBaseRepMeters?: number | null;
  recoveryDistanceMeters: number | null;
  recoveryDurationSeconds?: number | null;
  recoveryPaceOffsetSecPerMile: number | null;
  warmupMiles: number | null;
  warmupPaceOffsetSecPerMile?: number | null;
  cooldownMiles: number | null;
  cooldownPaceOffsetSecPerMile?: number | null;
  mpFraction?: number | null;
  mpBlockPosition?: string | null;
  mpBlockProgression?: string;
  mpTotalMiles?: number | null;
  mpPaceOffsetSecPerMile?: number | null;
  intendedHeartRateZone: string | null;
  intendedHRBpmLow: number | null;
  intendedHRBpmHigh: number | null;
  notes: string | null;
  trainingIntent?: string[] | null;
};

type MilesSeg = { miles: string; paceKey?: string; pace: string };
type IntSeg = { distanceMeters: string; paceKey?: string; pace: string; reps: string };
type IntBlockSeg = { distanceMeters: string; paceKey?: string; pace: string };

function PaceKeySelect({
  value,
  onChange,
  selectClassName = "block w-36 border rounded px-2 py-1 text-sm",
}: {
  value: string;
  onChange: (v: string) => void;
  selectClassName?: string;
}) {
  return (
    <label>
      <span className="text-xs text-gray-500">Offset vs 5K (sec/mi) — optional pace key ignored on save</span>
      <select
        className={selectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— offset fallback —</option>
        {CANONICAL_PACE_KEYS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Catalogue segment pace offset: blank → null (OPEN / no Garmin pace target in materializer). */
function optionalRoundedPaceOffsetSecPerMi(paceRaw: string): number | null {
  const t = paceRaw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Card shell: Warmup / Work / Cooldown match materialized workout phases. */
const sectionCard = "rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2";
const sectionHeaderRow = "flex flex-wrap items-end justify-between gap-2 min-h-7";

/** Aligned with gofastapp-mvp `catalogueEntryToApiSegments` behavior. */
const WC_HELP = {
  easy: "Miles and offsets are optional, absolute (not a % of the run). A common build is a single full-distance easy segment; use these when the workout should be split into warmup / work / cooldown.",
  steadyWc15:
    "Leave miles blank: the engine can default this phase to 15% of the scheduled run distance. Set miles to fix an absolute distance instead.",
  progressionWc5kLrW:
    "Leave miles blank: the engine defaults to 15% of the scheduled run as an open warmup (no pace target). Check No warmup to save explicit 0 and skip the phase. Set miles for a fixed distance.",
  progressionWc5kLrC:
    "Leave miles blank: the engine defaults to 15% of the scheduled run as an open cooldown. Check No cooldown to save explicit 0 and skip the phase. Set miles for a fixed distance.",
  progressionWc5kTempoW:
    "Absolute miles, not a percentage. Leave blank: no warmup segment. Build order: warmup (if set), your mile blocks, leftover as tempo, cooldown (if set).",
  progressionWc5kTempoC:
    "Absolute miles, not a percentage. Leave blank: no cooldown segment. Any leftover scheduled distance after warmup and your blocks is applied as tempo before a cooldown you set here.",
  onePace5kLr:
    "Set miles to carve off easy before/after the work block, or leave blank. One-pace long runs often materialize as a single full scheduled segment. Miles are absolute, not a percentage.",
  onePace5kTempo:
    "Steady: see Warmup / Cooldown — blank miles can default to 15% of the scheduled run each; work is the remainder. Miles are always absolute when you enter them.",
  /** MP anchor: goal pace = athlete’s plan (goal time / race) at materialization — not staff input on this row. */
  mpPaceFromAthlete:
    "For marathon-pace work, the pace comes from the athlete’s plan goal (goal time on their plan, plus race distance) when the run is built — not from this catalogue. Here you only choose how the scheduled distance is split into phases.",
  mpWorkCardNoteLr:
    "Goal marathon pace is taken from the athlete’s plan goal (time + race distance). Set warmup %, work-at-MP %, and cooldown % of the scheduled run.",
  mpWorkCardNoteTempo:
    "Pace is the athlete’s goal marathon pace, derived from their plan goal time and race distance. It is not entered here. This field only defines what share of the scheduled run is at goal MP.",
  tempoBlockRepeatWork:
    "Repeat group: tempo mile segments run in order; the whole block repeats N times with optional timed recovery between cycles. Warmup/cooldown are absolute miles; recovery pace offset blank = no pace target on watch. This mode does not add leftover scheduled distance as extra tempo after the repeats.",
  intervalBlockRepeatWork:
    "Run each segment in order as one cycle, then repeat the whole cycle N times (ABAB pattern). Use this for rolling 400s—fast stride then float/recovery stride—plus optional timed rest only BETWEEN full cycles—not progressive mile blocks.",
  intervalRepLadderRecovery:
    "Use timed recovery OR jog distance — the builder needs one for a scripted recovery step between work reps (when positive, time wins over distance; leave both unset for default 400 m jog). Pace offset blank = no pace target on watch.",
} as const;

function str(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

/** Coerce malformed DB JSON (e.g. string `"null"`) before building segment editors. */
function normalizeSegmentJsonFromDb(raw: unknown): unknown {
  if (raw == null) return undefined;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t === "" || t === "null") return undefined;
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return undefined;
    }
  }
  return raw;
}

/** Prefer `segmentPaceDist`; fall back to legacy `segmentPatternJson` / `workSegmentsJson`. */
function segmentPaceDistFromSources(
  p: Record<string, unknown> | null | undefined,
  initial: CatalogueFormItem | null
): unknown {
  const raw =
    p?.segmentPaceDist ??
    (p && (p as Record<string, unknown>).segmentPatternJson) ??
    (p && (p as Record<string, unknown>).workSegmentsJson);
  const fromPrefill = normalizeSegmentJsonFromDb(raw);
  if (fromPrefill !== undefined && fromPrefill !== null) return fromPrefill;
  return (
    normalizeSegmentJsonFromDb(initial?.segmentPaceDist) ??
    normalizeSegmentJsonFromDb(initial?.segmentPatternJson) ??
    normalizeSegmentJsonFromDb(initial?.workSegmentsJson)
  );
}

function milesSegsFromJson(raw: unknown): MilesSeg[] {
  if (!Array.isArray(raw) || raw.length === 0) return [{ miles: "", paceKey: "", pace: "" }];
  return raw.map((r) => {
    const o = r as { miles?: unknown; paceOffsetSecPerMile?: unknown; paceKey?: unknown };
    return {
      miles: o.miles != null ? String(o.miles) : "",
      paceKey: o.paceKey != null ? String(o.paceKey) : "",
      pace: o.paceOffsetSecPerMile != null ? String(o.paceOffsetSecPerMile) : "",
    };
  });
}

function tempoBlockRepeatStateFromJson(raw: unknown): {
  tempoBlockSegs: MilesSeg[];
  tempoBlockRepeatCount: string;
  tempoBlockRecoverySec: string;
} {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      tempoBlockSegs: [{ miles: "", paceKey: "", pace: "" }],
      tempoBlockRepeatCount: "1",
      tempoBlockRecoverySec: "",
    };
  }
  const o = raw as Record<string, unknown>;
  if (o.layout !== "blockRepeat") {
    return {
      tempoBlockSegs: [{ miles: "", paceKey: "", pace: "" }],
      tempoBlockRepeatCount: "1",
      tempoBlockRecoverySec: "",
    };
  }
  const segs = Array.isArray(o.segments) ? o.segments : [];
  const tempoBlockSegs: MilesSeg[] =
    segs.length > 0
      ? segs.map((r) => {
          const row = r as { miles?: unknown; paceOffsetSecPerMile?: unknown; paceKey?: unknown };
          return {
            miles: row.miles != null ? String(row.miles) : "",
            paceKey: row.paceKey != null ? String(row.paceKey) : "",
            pace: row.paceOffsetSecPerMile != null ? String(row.paceOffsetSecPerMile) : "",
          };
        })
      : [{ miles: "", paceKey: "", pace: "" }];
  return {
    tempoBlockSegs,
    tempoBlockRepeatCount:
      o.repeatCount != null && String(o.repeatCount) !== "" ? String(o.repeatCount) : "1",
    tempoBlockRecoverySec:
      o.recoveryBetweenCyclesSeconds != null ? String(o.recoveryBetweenCyclesSeconds) : "",
  };
}

function intervalBlockRepeatStateFromJson(raw: unknown): {
  intervalBlockSegs: IntBlockSeg[];
  intervalBlockRepeatCount: string;
  intervalBlockRecoverySec: string;
} {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      intervalBlockSegs: [{ distanceMeters: "", paceKey: "", pace: "" }],
      intervalBlockRepeatCount: "1",
      intervalBlockRecoverySec: "",
    };
  }
  const o = raw as Record<string, unknown>;
  if (o.layout !== "blockRepeat") {
    return {
      intervalBlockSegs: [{ distanceMeters: "", paceKey: "", pace: "" }],
      intervalBlockRepeatCount: "1",
      intervalBlockRecoverySec: "",
    };
  }
  const segs = Array.isArray(o.segments) ? o.segments : [];
  const intervalBlockSegs: IntBlockSeg[] =
    segs.length > 0
      ? segs.map((r) => {
          const row = r as { distanceMeters?: unknown; paceOffsetSecPerMile?: unknown; paceKey?: unknown };
          return {
            distanceMeters: row.distanceMeters != null ? String(row.distanceMeters) : "",
            paceKey: row.paceKey != null ? String(row.paceKey) : "",
            pace: row.paceOffsetSecPerMile != null ? String(row.paceOffsetSecPerMile) : "",
          };
        })
      : [{ distanceMeters: "", paceKey: "", pace: "" }];
  return {
    intervalBlockSegs,
    intervalBlockRepeatCount:
      o.repeatCount != null && String(o.repeatCount) !== "" ? String(o.repeatCount) : "1",
    intervalBlockRecoverySec:
      o.recoveryBetweenCyclesSeconds != null ? String(o.recoveryBetweenCyclesSeconds) : "",
  };
}

function intervalSegsFromItem(initial: CatalogueFormItem | null, p: Record<string, unknown> | null | undefined): IntSeg[] {
  const j = segmentPaceDistFromSources(p ?? null, initial);
  if (j != null && typeof j === "object" && !Array.isArray(j)) {
    const o = j as Record<string, unknown>;
    if (o.layout === "blockRepeat") {
      return [{ distanceMeters: "", paceKey: "", pace: "", reps: "1" }];
    }
  }
  if (Array.isArray(j) && j.length > 0) {
    return j.map((r) => {
      const o = r as { distanceMeters?: unknown; paceOffsetSecPerMile?: unknown; paceKey?: unknown; reps?: unknown };
      return {
        distanceMeters: o.distanceMeters != null ? String(o.distanceMeters) : "",
        paceKey: o.paceKey != null ? String(o.paceKey) : "",
        pace: o.paceOffsetSecPerMile != null ? String(o.paceOffsetSecPerMile) : "",
        reps: o.reps != null ? String(o.reps) : "1",
      };
    });
  }
  if (initial?.workBaseRepMeters != null || initial?.workBaseReps != null) {
    return [
      {
        distanceMeters: str(initial?.workBaseRepMeters),
        pace: str(
          p?.workBasePaceOffsetSecPerMile ?? p?.repPaceOffsetSecPerMile ?? initial?.workBasePaceOffsetSecPerMile
        ),
        reps: str(initial?.workBaseReps) || "1",
      },
    ];
  }
  return [{ distanceMeters: "", paceKey: "", pace: "", reps: "1" }];
}

function pct(f: number | null | undefined): string {
  if (f == null || !Number.isFinite(f)) return "";
  return String(Math.round(f * 1000) / 10);
}

function pctToFrac(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n / 100;
}

type LongRunMpBookendMode = "fractions" | "miles" | "hybrid";

function positiveDbNumber(v: unknown): boolean {
  if (v == null || v === "") return false;
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function initLongRunMpBookendMode(
  p: Record<string, unknown> | null | undefined,
  initial: CatalogueFormItem | null
): LongRunMpBookendMode {
  const warmupMiles = p?.warmupMiles ?? initial?.warmupMiles;
  const cooldownMiles = p?.cooldownMiles ?? initial?.cooldownMiles;
  const warmupFraction = p?.warmupFraction ?? initial?.warmupFraction;
  const workFraction = p?.workFraction ?? initial?.workFraction;
  const cooldownFraction = p?.cooldownFraction ?? initial?.cooldownFraction;
  const hasAbs =
    positiveDbNumber(warmupMiles) || positiveDbNumber(cooldownMiles);
  const hasFrac =
    positiveDbNumber(warmupFraction) ||
    positiveDbNumber(workFraction) ||
    positiveDbNumber(cooldownFraction);
  if (hasAbs && hasFrac) return "hybrid";
  if (hasFrac) return "fractions";
  if (hasAbs) return "miles";
  return "fractions";
}

function normalizePaceAnchorForForm(raw: string): string {
  const s = raw.trim();
  if (s === "mpSimulation" || s === "goalRacePace") return "goalRacePace";
  if (s === "currentBuildup" || s === "fiveKPace" || s === "") return "fiveKPace";
  return s;
}

function initNoWarmup(p: Record<string, unknown> | null | undefined, initial: CatalogueFormItem | null): boolean {
  const rawM = p?.warmupMiles ?? initial?.warmupMiles;
  if (rawM === 0 || rawM === "0") return true;
  const wm = str(rawM);
  const wo = str(p?.warmupPaceOffsetSecPerMile ?? initial?.warmupPaceOffsetSecPerMile);
  return wm === "" && wo === "";
}

function initNoCooldown(p: Record<string, unknown> | null | undefined, initial: CatalogueFormItem | null): boolean {
  const rawM = p?.cooldownMiles ?? initial?.cooldownMiles;
  if (rawM === 0 || rawM === "0") return true;
  const cm = str(rawM);
  const co = str(p?.cooldownPaceOffsetSecPerMile ?? initial?.cooldownPaceOffsetSecPerMile);
  return cm === "" && co === "";
}

function initPurposeTextFromSources(
  p: Record<string, unknown> | null | undefined,
  initial: CatalogueFormItem | null,
): string {
  const fromPrefill =
    typeof p?.purpose === "string"
      ? p.purpose.trim()
      : Array.isArray(p?.trainingIntent)
        ? (p.trainingIntent as unknown[])
            .map((x) => String(x).trim())
            .filter(Boolean)
            .join("\n")
        : "";
  if (fromPrefill) return fromPrefill;
  const raw = initial?.trainingIntent;
  if (Array.isArray(raw)) {
    return raw
      .map((x) => String(x).trim())
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export function CatalogueEditForm({
  initial,
  aiPrefill,
  prefillNotice,
  onCancel,
  onSaved,
}: {
  initial: CatalogueFormItem | null;
  aiPrefill?: Record<string, unknown> | null;
  prefillNotice?: string | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const p = aiPrefill;
  const [lockSlugFromName, setLockSlugFromName] = useState(() => !initial);
  const nameInit = str(p?.name ?? initial?.name);

  const wf = p?.warmupFraction ?? initial?.warmupFraction;
  const wff = p?.workFraction ?? initial?.workFraction;
  const cff = p?.cooldownFraction ?? initial?.cooldownFraction;

  const wtInit = str(p?.workoutType ?? initial?.workoutType);
  const paceInit = normalizePaceAnchorForForm(str(p?.paceAnchor ?? initial?.paceAnchor) || "fiveKPace");

  const [form, setForm] = useState({
    name: nameInit,
    runSubType: str(p?.runSubType ?? initial?.runSubType),
    slug:
      str(p?.slug ?? initial?.slug) ||
      (nameInit ? generateCatalogueSlug(nameInit) : ""),
    description: str(p?.description ?? initial?.description),
    workoutType: str(p?.workoutType ?? initial?.workoutType) || "Tempo",
    paceAnchor: paceInit,
    warmupMiles:
      str(p?.warmupMiles ?? initial?.warmupMiles) ||
      (wtInit === "LongRun" && paceInit === "mpSimulation" ? "2" : ""),
    warmupPaceOffsetSecPerMile: str(p?.warmupPaceOffsetSecPerMile ?? initial?.warmupPaceOffsetSecPerMile),
    cooldownMiles:
      str(p?.cooldownMiles ?? initial?.cooldownMiles) ||
      (wtInit === "LongRun" && paceInit === "mpSimulation" ? "2" : ""),
    cooldownPaceOffsetSecPerMile: str(p?.cooldownPaceOffsetSecPerMile ?? initial?.cooldownPaceOffsetSecPerMile),
    workPaceOffsetSecPerMile: str(
      p?.workPaceOffsetSecPerMile ?? p?.overallPaceOffsetSecPerMile ?? initial?.workPaceOffsetSecPerMile
    ),
    workBaseMiles: str(p?.workBaseMiles ?? initial?.workBaseMiles),
    workBasePaceOffsetSecPerMile: str(
      p?.workBasePaceOffsetSecPerMile ?? p?.repPaceOffsetSecPerMile ?? initial?.workBasePaceOffsetSecPerMile
    ),
    recoveryDistanceMeters: str(p?.recoveryDistanceMeters ?? initial?.recoveryDistanceMeters),
    recoveryDurationSeconds: str(
      (p as Record<string, unknown> | null | undefined)?.recoveryDurationSeconds ??
        (p as Record<string, unknown> | null | undefined)?.recoveryBetweenRepsSeconds ??
        initial?.recoveryDurationSeconds
    ),
    recoveryPaceOffsetSecPerMile: str(
      p?.recoveryPaceOffsetSecPerMile ?? initial?.recoveryPaceOffsetSecPerMile
    ),
    mpPaceOffsetSecPerMile: str(p?.mpPaceOffsetSecPerMile ?? initial?.mpPaceOffsetSecPerMile),
    warmupFractionPct: pct(wf as number | null | undefined),
    workFractionPct: pct(wff as number | null | undefined),
    cooldownFractionPct: pct(cff as number | null | undefined),
    longRunMpBookendMode: initLongRunMpBookendMode(p ?? null, initial),
    longRun5kMode: (() => {
      const w = str(p?.workoutType ?? initial?.workoutType);
      if (w !== "LongRun") return "simple" as const;
      const wj = segmentPaceDistFromSources(p ?? null, initial);
      if (Array.isArray(wj) && wj.length > 0) {
        const first = wj[0] as { miles?: unknown; distanceMeters?: unknown };
        if (first && typeof first === "object" && "miles" in first) return "segments" as const;
      }
      return "simple" as const;
    })(),
    tempo5kMode: (() => {
      const t = str(p?.workoutType ?? initial?.workoutType);
      if (t !== "Tempo") return "simple" as const;
      const wj = segmentPaceDistFromSources(p ?? null, initial);
      if (wj != null && typeof wj === "object" && !Array.isArray(wj)) {
        const o = wj as Record<string, unknown>;
        if (o.layout === "blockRepeat") return "blockRepeat" as const;
      }
      if (Array.isArray(wj) && wj.length > 0) {
        const first = wj[0] as { miles?: unknown; distanceMeters?: unknown };
        if (first && typeof first === "object" && "miles" in first) return "segments" as const;
      }
      return "simple" as const;
    })(),
    longRunMilesSegs: (() => {
      const w = str(p?.workoutType ?? initial?.workoutType);
      if (w !== "LongRun") return [{ miles: "", paceKey: "", pace: "" }];
      return milesSegsFromJson(segmentPaceDistFromSources(p ?? null, initial));
    })(),
    tempoMilesSegs: (() => {
      const t = str(p?.workoutType ?? initial?.workoutType);
      if (t !== "Tempo") return [{ miles: "", paceKey: "", pace: "" }];
      return milesSegsFromJson(segmentPaceDistFromSources(p ?? null, initial));
    })(),
    ...(() => {
      const t = str(p?.workoutType ?? initial?.workoutType);
      const wj = segmentPaceDistFromSources(p ?? null, initial);
      if (t === "Tempo") return tempoBlockRepeatStateFromJson(wj);
      return {
        tempoBlockSegs: [{ miles: "", paceKey: "", pace: "" }] as MilesSeg[],
        tempoBlockRepeatCount: "1",
        tempoBlockRecoverySec: "",
      };
    })(),
    intervalMode: (() => {
      const t = str(p?.workoutType ?? initial?.workoutType);
      if (t !== "Intervals") return "flat" as const;
      const ij = segmentPaceDistFromSources(p ?? null, initial);
      if (ij != null && typeof ij === "object" && !Array.isArray(ij)) {
        const o = ij as Record<string, unknown>;
        if (o.layout === "blockRepeat") return "blockRepeat" as const;
      }
      return "flat" as const;
    })(),
    ...(() => {
      const t = str(p?.workoutType ?? initial?.workoutType);
      const ij = segmentPaceDistFromSources(p ?? null, initial);
      if (t === "Intervals") return intervalBlockRepeatStateFromJson(ij);
      return {
        intervalBlockSegs: [{ distanceMeters: "", paceKey: "", pace: "" }] as IntBlockSeg[],
        intervalBlockRepeatCount: "1",
        intervalBlockRecoverySec: "",
      };
    })(),
    intervalSegs: intervalSegsFromItem(initial, p ?? null),
    noWarmup: initNoWarmup(p ?? null, initial),
    noCooldown: initNoCooldown(p ?? null, initial),
    intendedHeartRateZone: str(p?.intendedHeartRateZone ?? initial?.intendedHeartRateZone),
    intendedHRBpmLow: str(p?.intendedHRBpmLow ?? initial?.intendedHRBpmLow),
    intendedHRBpmHigh: str(p?.intendedHRBpmHigh ?? initial?.intendedHRBpmHigh),
    notes: str(p?.notes ?? initial?.notes),
    purpose: initPurposeTextFromSources(p ?? null, initial),
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const wt = form.workoutType;
  const is5K = form.paceAnchor === "fiveKPace" || form.paceAnchor === "currentBuildup";
  const isMP = form.paceAnchor === "goalRacePace" || form.paceAnchor === "mpSimulation";

  /** Builds JSON for `segmentPaceDist` (segment pace + distance / repeat structure). */
  function buildSegmentPaceDistance(): unknown {
    const w = form.workoutType;
    if (w === "LongRun" && is5K && form.longRun5kMode === "segments") {
      const arr = form.longRunMilesSegs
        .map((r) => segmentPayloadFromMilesRow(r))
        .filter((r) => Object.keys(r).length > 0);
      return arr.length ? arr : null;
    }
    if (w === "Tempo" && form.tempo5kMode === "blockRepeat") {
      const arr = form.tempoBlockSegs
        .map((r) => segmentPayloadFromMilesRow(r))
        .filter((r) => Object.keys(r).length > 0);
      if (!arr.length) return null;
      const repeatCount = Math.max(1, Math.round(Number(form.tempoBlockRepeatCount) || 1));
      const recSec = Number(form.tempoBlockRecoverySec);
      const out: Record<string, unknown> = {
        layout: "blockRepeat",
        segments: arr,
        repeatCount,
      };
      if (Number.isFinite(recSec) && recSec > 0) {
        out.recoveryBetweenCyclesSeconds = Math.round(recSec);
      }
      return out;
    }
    if (w === "Tempo" && form.tempo5kMode === "segments") {
      const arr = form.tempoMilesSegs
        .map((r) => segmentPayloadFromMilesRow(r))
        .filter((r) => Object.keys(r).length > 0);
      return arr.length ? arr : null;
    }
    if (w === "Intervals") {
      if (form.intervalMode === "blockRepeat") {
        const arr = form.intervalBlockSegs
          .map((r) => segmentPayloadFromMetersRow(r))
          .filter((r) => Object.keys(r).length > 0);
        if (!arr.length) return null;
        const repeatCount = Math.max(1, Math.round(Number(form.intervalBlockRepeatCount) || 1));
        const recSec = Number(form.intervalBlockRecoverySec);
        const out: Record<string, unknown> = {
          layout: "blockRepeat",
          segments: arr,
          repeatCount,
        };
        if (Number.isFinite(recSec) && recSec > 0) {
          out.recoveryBetweenCyclesSeconds = Math.round(recSec);
        }
        return out;
      }
      const arr = form.intervalSegs
        .map((r) => segmentPayloadFromMetersRow(r))
        .filter((r) => Object.keys(r).length > 0);
      return arr.length ? arr : null;
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const n = (v: string) => {
      if (v === "" || v == null) return undefined;
      const x = Number(v);
      return Number.isFinite(x) ? x : undefined;
    };
    const ni = (v: string) => {
      const x = n(v);
      return x === undefined ? undefined : Math.round(x);
    };

    const wjsonBuilt = buildSegmentPaceDistance();
    const wjson =
      wt === "Tempo" && isMP ? null : wjsonBuilt;
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      runSubType: form.runSubType.trim() || null,
      description: form.description.trim() || undefined,
      workoutType: form.workoutType,
      paceAnchor: form.paceAnchor,
      mpFraction: null,
      mpBlockPosition: null,
      mpBlockProgression: "flat",
      mpTotalMiles: null,
      segmentPaceDist: wjson as unknown,
    };

    if (wt === "LongRun" && isMP) {
      body.paceAnchor = "goalRacePace";
      body.mpFraction = null;
      body.mpTotalMiles = null;
      body.mpBlockPosition = null;
      body.mpBlockProgression = "flat";
      body.mpPaceOffsetSecPerMile = null;
      body.segmentPaceDist = null;
      body.warmupPaceOffsetSecPerMile = null;
      body.cooldownPaceOffsetSecPerMile = null;
      const mode = form.longRunMpBookendMode as LongRunMpBookendMode;
      if (mode === "fractions") {
        body.warmupFraction = pctToFrac(form.warmupFractionPct);
        body.workFraction = pctToFrac(form.workFractionPct);
        body.cooldownFraction = pctToFrac(form.cooldownFractionPct);
        body.warmupMiles = null;
        body.cooldownMiles = null;
      } else if (mode === "miles") {
        body.warmupFraction = null;
        body.workFraction = null;
        body.cooldownFraction = null;
        body.warmupMiles = n(form.warmupMiles) ?? null;
        body.cooldownMiles = n(form.cooldownMiles) ?? null;
      } else {
        body.warmupFraction = null;
        body.warmupMiles = n(form.warmupMiles) ?? null;
        body.cooldownMiles = n(form.cooldownMiles) ?? null;
        body.workFraction = pctToFrac(form.workFractionPct);
        body.cooldownFraction = pctToFrac(form.cooldownFractionPct);
      }
    } else if (isMP) {
      body.warmupFraction = pctToFrac(form.warmupFractionPct);
      body.workFraction = pctToFrac(form.workFractionPct);
      body.cooldownFraction = pctToFrac(form.cooldownFractionPct);
    } else {
      body.warmupFraction = null;
      body.workFraction = null;
      body.cooldownFraction = null;
    }

    if (wt === "LongRun" && isMP) {
      /* fractions + null bookends saved above */
    } else if (wt === "LongRun" && is5K && form.longRun5kMode === "segments") {
      body.warmupMiles = form.noWarmup ? 0 : n(form.warmupMiles) ?? null;
      body.warmupPaceOffsetSecPerMile = form.noWarmup
        ? null
        : ni(form.warmupPaceOffsetSecPerMile) ?? null;
      if (form.noCooldown) {
        body.cooldownMiles = 0;
        body.cooldownPaceOffsetSecPerMile = null;
      } else {
        body.cooldownMiles = n(form.cooldownMiles) ?? null;
        body.cooldownPaceOffsetSecPerMile = ni(form.cooldownPaceOffsetSecPerMile) ?? null;
      }
    } else if (form.noWarmup) {
      body.warmupMiles = null;
      body.warmupPaceOffsetSecPerMile = null;
    } else {
      body.warmupMiles = n(form.warmupMiles) ?? null;
      body.warmupPaceOffsetSecPerMile = ni(form.warmupPaceOffsetSecPerMile) ?? null;
    }
    if (!(wt === "LongRun" && isMP) && !(wt === "LongRun" && is5K && form.longRun5kMode === "segments")) {
      if (form.noCooldown) {
        body.cooldownMiles = null;
        body.cooldownPaceOffsetSecPerMile = null;
      } else {
        body.cooldownMiles = n(form.cooldownMiles) ?? null;
        body.cooldownPaceOffsetSecPerMile = ni(form.cooldownPaceOffsetSecPerMile) ?? null;
      }
    }
    body.workPaceOffsetSecPerMile = ni(form.workPaceOffsetSecPerMile);
    body.workBaseMiles = n(form.workBaseMiles);
    body.workBasePaceOffsetSecPerMile = ni(form.workBasePaceOffsetSecPerMile);
    body.recoveryDistanceMeters = ni(form.recoveryDistanceMeters);
    body.recoveryDurationSeconds = ni(form.recoveryDurationSeconds);
    body.recoveryPaceOffsetSecPerMile = ni(form.recoveryPaceOffsetSecPerMile);
    body.mpPaceOffsetSecPerMile = isMP ? null : ni(form.mpPaceOffsetSecPerMile) ?? null;
    body.intendedHeartRateZone = form.intendedHeartRateZone.trim() || undefined;
    body.intendedHRBpmLow = ni(form.intendedHRBpmLow);
    body.intendedHRBpmHigh = ni(form.intendedHRBpmHigh);
    body.notes = form.notes.trim() || undefined;
    body.trainingIntent = normalizeTrainingIntentArray(
      form.purpose
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    );

    if (wt === "LongRun" && is5K && form.longRun5kMode === "simple") {
      body.segmentPaceDist = null;
    }
    if (wt === "Tempo" && form.tempo5kMode === "simple") {
      body.segmentPaceDist = null;
    }
    if (wt === "Easy") {
      body.segmentPaceDist = null;
    }
    if (wt === "Intervals") {
      if (wjson) {
        body.workBaseReps = null;
        body.workBaseRepMeters = null;
      } else {
        const first = form.intervalSegs[0];
        body.workBaseReps = first?.reps != null && first.reps !== "" ? ni(first.reps) : null;
        body.workBaseRepMeters =
          first?.distanceMeters != null && first.distanceMeters !== ""
            ? ni(first.distanceMeters)
            : null;
      }
    }

    const st = form.slug.trim();
    if (st === "") {
      if (initial) body.slug = null;
    } else {
      body.slug = st;
    }

    try {
      const res = await authFetch(
        initial ? `/api/training/catalogue/${initial.id}` : "/api/training/catalogue",
        {
          method: initial ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json()) as { success?: boolean; error?: string; details?: string };
      if (!res.ok || !data.success) {
        setErr(data.error || data.details || "Save failed");
        return;
      }
      await onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white border border-orange-200 rounded-lg p-6 mb-8">
      <h2 className="text-lg font-semibold mb-1">
        {initial
          ? "Edit workout"
          : aiPrefill && !prefillNotice
            ? "AI-generated entry — review and save"
            : "New catalogue workout"}
      </h2>
      {aiPrefill && !initial && (
        <p className="text-sm text-purple-700 mb-4">
          {prefillNotice ?? "Fields pre-filled by AI. Review all values before saving."}
        </p>
      )}

      <form onSubmit={submit} className="space-y-6 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2">
            <span className="block text-xs font-medium text-gray-500 mb-1">Name</span>
            <input
              className="w-full border rounded px-2 py-1.5"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({
                  ...f,
                  name,
                  ...(lockSlugFromName ? { slug: generateCatalogueSlug(name) } : {}),
                }));
              }}
              required
            />
          </label>
          <label className="sm:col-span-2">
            <span className="block text-xs font-medium text-gray-500 mb-1">Run sub-type (free text)</span>
            <input
              className="w-full border rounded px-2 py-1.5"
              value={form.runSubType}
              onChange={(e) => setForm((f) => ({ ...f, runSubType: e.target.value }))}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="block text-xs font-medium text-gray-500 mb-1">Slug (kebab-case)</span>
            <input
              className="w-full border rounded px-2 py-1.5 font-mono text-sm"
              value={form.slug}
              onChange={(e) => {
                setLockSlugFromName(false);
                setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }));
              }}
              pattern="[a-z0-9-]*"
            />
          </label>
          <label>
            <span className="block text-xs font-medium text-gray-500 mb-1">Workout type</span>
            <select
              className="w-full border rounded px-2 py-1.5"
              value={form.workoutType}
              onChange={(e) => setForm((f) => ({ ...f, workoutType: e.target.value }))}
            >
              <option value="Easy">Easy</option>
              <option value="LongRun">Long run</option>
              <option value="Intervals">Intervals</option>
              <option value="Tempo">Tempo</option>
              <option value="Race">Race</option>
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="block text-xs font-medium text-gray-500 mb-1">Description (optional)</span>
            <input
              className="w-full border rounded px-2 py-1.5"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="block text-xs font-medium text-gray-500 mb-1">
              Purpose (optional)
            </span>
            <textarea
              className="w-full border rounded px-2 py-1.5 text-sm min-h-[4.5rem]"
              rows={3}
              value={form.purpose}
              onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
            />
            <span className="mt-1 block text-[10px] text-gray-500">
              Stored as training intent for coaching context. One sentence per line if you need several.
            </span>
          </label>
        </div>

        {(wt === "LongRun" || wt === "Tempo") && (
          <div>
            <span className="block text-xs font-medium text-gray-600 mb-2">Pace anchor</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, paceAnchor: "fiveKPace" }))}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  is5K ? "bg-orange-100 text-orange-900 ring-2 ring-orange-400" : "bg-gray-100 text-gray-600"
                }`}
              >
                5K pace
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, paceAnchor: "goalRacePace" }))}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  isMP ? "bg-orange-100 text-orange-900 ring-2 ring-orange-400" : "bg-gray-100 text-gray-600"
                }`}
              >
                Race pace
              </button>
            </div>
            {(wt === "LongRun" || wt === "Tempo") && isMP && (
              <p className="text-xs text-amber-950/90 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2">
                {WC_HELP.mpPaceFromAthlete}
              </p>
            )}
          </div>
        )}

        {wt === "Easy" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Easy run vs current 5K fitness. {WC_HELP.easy} Use the checkboxes to drop a dedicated warmup or
              cooldown if the AI added one by mistake.
            </p>
            <div className={sectionCard}>
              <div className={sectionHeaderRow}>
                <h3 className="text-sm font-semibold text-gray-900">Warmup</h3>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={form.noWarmup}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setForm((f) => ({
                        ...f,
                        noWarmup: v,
                        ...(v ? { warmupMiles: "", warmupPaceOffsetSecPerMile: "" } : {}),
                      }));
                    }}
                  />
                  No warmup
                </label>
              </div>
              <p className="text-xs text-gray-500">Optional absolute miles, not a percentage of the plan.</p>
              {!form.noWarmup && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label>
                    <span className="text-xs text-gray-500">Miles (optional)</span>
                    <input
                      type="text"
                      className="w-full border rounded px-2 py-1.5"
                      value={form.warmupMiles}
                      onChange={(e) => setForm((f) => ({ ...f, warmupMiles: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs text-gray-500">Warmup pace offset (sec/mi — blank for no pace target)</span>
                    <input
                      type="text"
                      className="w-full border rounded px-2 py-1.5"
                      value={form.warmupPaceOffsetSecPerMile}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, warmupPaceOffsetSecPerMile: e.target.value }))
                      }
                    />
                  </label>
                </div>
              )}
            </div>
            <div className={sectionCard}>
              <h3 className="text-sm font-semibold text-gray-900">Work</h3>
              <p className="text-xs text-gray-500">Main run is the scheduled distance at easy pace, unless you cap miles below.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label>
                  <span className="text-xs text-gray-500">Work miles (optional; blank = use schedule)</span>
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1.5"
                    value={form.workBaseMiles}
                    onChange={(e) => setForm((f) => ({ ...f, workBaseMiles: e.target.value }))}
                  />
                </label>
                <label>
                  <span className="text-xs text-gray-500">Pace offset vs 5K (sec/mi, + slower — blank for no pace target)</span>
                  <input
                    type="number"
                    className="w-full max-w-xs border rounded px-2 py-1.5"
                    value={form.workPaceOffsetSecPerMile}
                    onChange={(e) => setForm((f) => ({ ...f, workPaceOffsetSecPerMile: e.target.value }))}
                  />
                </label>
              </div>
            </div>
            <div className={sectionCard}>
              <div className={sectionHeaderRow}>
                <h3 className="text-sm font-semibold text-gray-900">Cooldown</h3>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={form.noCooldown}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setForm((f) => ({
                        ...f,
                        noCooldown: v,
                        ...(v ? { cooldownMiles: "", cooldownPaceOffsetSecPerMile: "" } : {}),
                      }));
                    }}
                  />
                  No cooldown
                </label>
              </div>
              <p className="text-xs text-gray-500">Optional absolute miles, not a percentage of the plan.</p>
              {!form.noCooldown && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label>
                    <span className="text-xs text-gray-500">Miles (optional)</span>
                    <input
                      type="text"
                      className="w-full border rounded px-2 py-1.5"
                      value={form.cooldownMiles}
                      onChange={(e) => setForm((f) => ({ ...f, cooldownMiles: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs text-gray-500">Cooldown pace offset (sec/mi — blank for no pace target)</span>
                    <input
                      type="text"
                      className="w-full border rounded px-2 py-1.5"
                      value={form.cooldownPaceOffsetSecPerMile}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, cooldownPaceOffsetSecPerMile: e.target.value }))
                      }
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {wt === "LongRun" && is5K && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              5K-anchored long run: phases match the materialized run. In{" "}
              <strong className="font-medium">Progression (segments)</strong>, blank warmup/cooldown miles
              default to 15% open bookends at materialization; check No warmup/cooldown to save explicit 0
              and skip that phase.
            </p>
            <div className={sectionCard}>
              <div className={sectionHeaderRow}>
                <h3 className="text-sm font-semibold text-gray-900">Warmup</h3>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={form.noWarmup}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setForm((f) => ({
                        ...f,
                        noWarmup: v,
                        ...(v ? { warmupMiles: "", warmupPaceOffsetSecPerMile: "" } : {}),
                      }));
                    }}
                  />
                  No warmup
                </label>
              </div>
              <p className="text-xs text-gray-500">
                {form.longRun5kMode === "segments" ? WC_HELP.progressionWc5kLrW : WC_HELP.onePace5kLr}
              </p>
              {!form.noWarmup && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label>
                    <span className="text-xs text-gray-500">Miles (optional)</span>
                    <input
                      type="text"
                      className="w-full border rounded px-2 py-1.5"
                      value={form.warmupMiles}
                      onChange={(e) => setForm((f) => ({ ...f, warmupMiles: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs text-gray-500">Warmup pace offset (sec/mi — blank for no pace target)</span>
                    <input
                      type="text"
                      className="w-full border rounded px-2 py-1.5"
                      value={form.warmupPaceOffsetSecPerMile}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, warmupPaceOffsetSecPerMile: e.target.value }))
                      }
                    />
                  </label>
                </div>
              )}
            </div>

            <div className={sectionCard}>
              <div className={sectionHeaderRow}>
                <h3 className="text-sm font-semibold text-gray-900">Work</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, longRun5kMode: "simple" }))}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      form.longRun5kMode === "simple"
                        ? "bg-orange-100 text-orange-900 ring-1 ring-orange-300"
                        : "bg-white text-gray-600 ring-1 ring-slate-200"
                    }`}
                  >
                    One pace
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, longRun5kMode: "segments" }))}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      form.longRun5kMode === "segments"
                        ? "bg-orange-100 text-orange-900 ring-1 ring-orange-300"
                        : "bg-white text-gray-600 ring-1 ring-slate-200"
                    }`}
                  >
                    Progression (segments)
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {form.longRun5kMode === "simple" ? (
                  <>
                    Single work block: optional miles and pace offset vs 5K. With no progression segments, the
                    build often uses the full scheduled distance as one long run unless warmup or cooldown is set.
                  </>
                ) : (
                  "Multiple work blocks — fixed miles and pace (sec/mi) per block. The engine subtracts warmup/cooldown, applies these segments, then uses any remaining scheduled distance as a final long-pace work block (before cooldown)."
                )}
              </p>
              {form.longRun5kMode === "simple" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label>
                    <span className="text-xs text-gray-500">Work miles (optional; blank = use schedule)</span>
                    <input
                      type="text"
                      className="w-full border rounded px-2 py-1.5"
                      value={form.workBaseMiles}
                      onChange={(e) => setForm((f) => ({ ...f, workBaseMiles: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs text-gray-500">Pace offset vs 5K (sec/mi, + slower — blank for no pace target)</span>
                    <input
                      type="number"
                      className="w-full max-w-xs border rounded px-2 py-1.5"
                      value={form.workPaceOffsetSecPerMile}
                      onChange={(e) => setForm((f) => ({ ...f, workPaceOffsetSecPerMile: e.target.value }))}
                    />
                  </label>
                </div>
              )}
              {form.longRun5kMode === "segments" && (
                <div className="space-y-2">
                  {form.longRunMilesSegs.map((row, i) => (
                    <div key={i} className="flex flex-wrap gap-2 items-end">
                      <label>
                        <span className="text-xs text-gray-500">Miles</span>
                        <input
                          type="text"
                          className="block w-24 border rounded px-2 py-1"
                          value={row.miles}
                          onChange={(e) => {
                            const next = [...form.longRunMilesSegs];
                            next[i] = { ...row, miles: e.target.value };
                            setForm((f) => ({ ...f, longRunMilesSegs: next }));
                          }}
                        />
                      </label>
                      <PaceKeySelect
                        value={row.paceKey ?? ""}
                        onChange={(paceKey) => {
                          const next = [...form.longRunMilesSegs];
                          next[i] = { ...row, paceKey };
                          setForm((f) => ({ ...f, longRunMilesSegs: next }));
                        }}
                      />
                      <label>
                        <span className="text-xs text-gray-500">Offset vs 5K (sec/mi)</span>
                        <input
                          type="text"
                          className="block w-28 border rounded px-2 py-1"
                          value={row.pace}
                          onChange={(e) => {
                            const next = [...form.longRunMilesSegs];
                            next[i] = { ...row, pace: e.target.value };
                            setForm((f) => ({ ...f, longRunMilesSegs: next }));
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="text-xs text-red-600"
                        onClick={() => {
                          const next = form.longRunMilesSegs.filter((_, j) => j !== i);
                          setForm((f) => ({
                            ...f,
                            longRunMilesSegs: next.length ? next : [{ miles: "", paceKey: "", pace: "" }],
                          }));
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-sm text-orange-700"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        longRunMilesSegs: [...f.longRunMilesSegs, { miles: "", paceKey: "", pace: "" }],
                      }))
                    }
                  >
                    + Add work segment
                  </button>
                </div>
              )}
            </div>

            <div className={sectionCard}>
              <div className={sectionHeaderRow}>
                <h3 className="text-sm font-semibold text-gray-900">Cooldown</h3>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={form.noCooldown}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setForm((f) => ({
                        ...f,
                        noCooldown: v,
                        ...(v ? { cooldownMiles: "", cooldownPaceOffsetSecPerMile: "" } : {}),
                      }));
                    }}
                  />
                  No cooldown
                </label>
              </div>
              <p className="text-xs text-gray-500">
                {form.longRun5kMode === "segments" ? WC_HELP.progressionWc5kLrC : WC_HELP.onePace5kLr}
              </p>
              {!form.noCooldown && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label>
                    <span className="text-xs text-gray-500">Miles (optional)</span>
                    <input
                      type="text"
                      className="w-full border rounded px-2 py-1.5"
                      value={form.cooldownMiles}
                      onChange={(e) => setForm((f) => ({ ...f, cooldownMiles: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs text-gray-500">Cooldown pace offset (sec/mi — blank for no pace target)</span>
                    <input
                      type="text"
                      className="w-full border rounded px-2 py-1.5"
                      value={form.cooldownPaceOffsetSecPerMile}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, cooldownPaceOffsetSecPerMile: e.target.value }))
                      }
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {wt === "LongRun" && isMP && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Race-pace long run: choose how scheduled miles split into phases. Work pace comes from the
              athlete&apos;s goal race pace at materialization — set offset below if needed.
            </p>
            <div className="flex flex-wrap gap-2">
              {(["fractions", "miles", "hybrid"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, longRunMpBookendMode: mode }))}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ${
                    form.longRunMpBookendMode === mode
                      ? "bg-orange-100 text-orange-900 ring-1 ring-orange-300"
                      : "bg-white text-gray-600 ring-1 ring-slate-200"
                  }`}
                >
                  {mode === "fractions" ? "% of run" : mode === "miles" ? "Miles" : "Hybrid"}
                </button>
              ))}
            </div>
            {form.longRunMpBookendMode === "fractions" && (
              <>
                <div className={sectionCard}>
                  <h3 className="text-sm font-semibold text-gray-900">Warmup</h3>
                  <label>
                    <span className="text-xs text-gray-500">Warmup % of scheduled run</span>
                    <input
                      className="w-full max-w-xs border rounded px-2 py-1.5"
                      value={form.warmupFractionPct}
                      onChange={(e) => setForm((f) => ({ ...f, warmupFractionPct: e.target.value }))}
                      placeholder="10"
                    />
                  </label>
                </div>
                <div className={sectionCard}>
                  <h3 className="text-sm font-semibold text-gray-900">Work at race pace</h3>
                  <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
                    {WC_HELP.mpWorkCardNoteLr}
                  </p>
                  <label>
                    <span className="text-xs text-gray-500">Work % of scheduled run</span>
                    <input
                      className="w-full max-w-xs border rounded px-2 py-1.5"
                      value={form.workFractionPct}
                      onChange={(e) => setForm((f) => ({ ...f, workFractionPct: e.target.value }))}
                      placeholder="50"
                    />
                  </label>
                  <label className="block mt-2">
                    <span className="text-xs text-gray-500">Offset vs race pace (sec/mi)</span>
                    <input
                      className="w-full max-w-xs border rounded px-2 py-1.5"
                      value={form.workPaceOffsetSecPerMile}
                      onChange={(e) => setForm((f) => ({ ...f, workPaceOffsetSecPerMile: e.target.value }))}
                    />
                  </label>
                </div>
                <div className={sectionCard}>
                  <h3 className="text-sm font-semibold text-gray-900">Cooldown</h3>
                  <label>
                    <span className="text-xs text-gray-500">Cooldown % of scheduled run</span>
                    <input
                      className="w-full max-w-xs border rounded px-2 py-1.5"
                      value={form.cooldownFractionPct}
                      onChange={(e) => setForm((f) => ({ ...f, cooldownFractionPct: e.target.value }))}
                      placeholder="10"
                    />
                  </label>
                </div>
              </>
            )}
            {form.longRunMpBookendMode === "miles" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label>
                  <span className="text-xs text-gray-500">Warmup miles</span>
                  <input
                    className="w-full border rounded px-2 py-1.5"
                    value={form.warmupMiles}
                    onChange={(e) => setForm((f) => ({ ...f, warmupMiles: e.target.value }))}
                  />
                </label>
                <label>
                  <span className="text-xs text-gray-500">Cooldown miles</span>
                  <input
                    className="w-full border rounded px-2 py-1.5"
                    value={form.cooldownMiles}
                    onChange={(e) => setForm((f) => ({ ...f, cooldownMiles: e.target.value }))}
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-xs text-gray-500">Offset vs race pace (sec/mi)</span>
                  <input
                    className="w-full max-w-xs border rounded px-2 py-1.5"
                    value={form.workPaceOffsetSecPerMile}
                    onChange={(e) => setForm((f) => ({ ...f, workPaceOffsetSecPerMile: e.target.value }))}
                  />
                </label>
              </div>
            )}
            {form.longRunMpBookendMode === "hybrid" && (
              <>
                <div className={sectionCard}>
                  <h3 className="text-sm font-semibold text-gray-900">Absolute bookends</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label>
                      <span className="text-xs text-gray-500">Warmup miles</span>
                      <input
                        className="w-full border rounded px-2 py-1.5"
                        value={form.warmupMiles}
                        onChange={(e) => setForm((f) => ({ ...f, warmupMiles: e.target.value }))}
                      />
                    </label>
                    <label>
                      <span className="text-xs text-gray-500">Cooldown miles (optional fixed tail)</span>
                      <input
                        className="w-full border rounded px-2 py-1.5"
                        value={form.cooldownMiles}
                        onChange={(e) => setForm((f) => ({ ...f, cooldownMiles: e.target.value }))}
                      />
                    </label>
                  </div>
                </div>
                <div className={sectionCard}>
                  <h3 className="text-sm font-semibold text-gray-900">Remainder split</h3>
                  <p className="text-xs text-gray-500">
                    After absolute warmup/cooldown, work and cooldown % split what&apos;s left (e.g. 2 mi warmup +
                    50% / 50% of 10 mi → 2 / 5 race pace / 5 cooldown).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    <label>
                      <span className="text-xs text-gray-500">Work % of remainder</span>
                      <input
                        className="w-full border rounded px-2 py-1.5"
                        value={form.workFractionPct}
                        onChange={(e) => setForm((f) => ({ ...f, workFractionPct: e.target.value }))}
                      />
                    </label>
                    <label>
                      <span className="text-xs text-gray-500">Cooldown % of remainder</span>
                      <input
                        className="w-full border rounded px-2 py-1.5"
                        value={form.cooldownFractionPct}
                        onChange={(e) => setForm((f) => ({ ...f, cooldownFractionPct: e.target.value }))}
                      />
                    </label>
                  </div>
                  <label className="block mt-2">
                    <span className="text-xs text-gray-500">Offset vs race pace (sec/mi)</span>
                    <input
                      className="w-full max-w-xs border rounded px-2 py-1.5"
                      value={form.workPaceOffsetSecPerMile}
                      onChange={(e) => setForm((f) => ({ ...f, workPaceOffsetSecPerMile: e.target.value }))}
                    />
                  </label>
                </div>
              </>
            )}
            <p className="text-xs text-gray-500">
              Leftover miles become easy long-run filler between phases when fractions do not sum to 100%.
            </p>
          </div>
        )}

        {wt === "Tempo" && !isMP && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Fitness-anchored tempo (vs 5K): absolute miles, not a percentage of the plan, except in Steady (one
              pace) where empty warmup/cooldown can each default to 15% of the scheduled run.
            </p>
            <div className={sectionCard}>
              <div className={sectionHeaderRow}>
                <h3 className="text-sm font-semibold text-gray-900">Warmup</h3>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={form.noWarmup}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setForm((f) => ({
                        ...f,
                        noWarmup: v,
                        ...(v ? { warmupMiles: "", warmupPaceOffsetSecPerMile: "" } : {}),
                      }));
                    }}
                  />
                  No warmup
                </label>
              </div>
              <p className="text-xs text-gray-500">
                {form.tempo5kMode === "segments" || form.tempo5kMode === "blockRepeat"
                  ? WC_HELP.progressionWc5kTempoW
                  : WC_HELP.steadyWc15}
              </p>
              {!form.noWarmup && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label>
                    <span className="text-xs text-gray-500">Miles (optional)</span>
                    <input
                      type="text"
                      className="w-full border rounded px-2 py-1.5"
                      value={form.warmupMiles}
                      onChange={(e) => setForm((f) => ({ ...f, warmupMiles: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs text-gray-500">Warmup pace offset (sec/mi — blank for no pace target)</span>
                    <input
                      type="text"
                      className="w-full border rounded px-2 py-1.5"
                      value={form.warmupPaceOffsetSecPerMile}
                      onChange={(e) => setForm((f) => ({ ...f, warmupPaceOffsetSecPerMile: e.target.value }))}
                    />
                  </label>
                </div>
              )}
            </div>
            <div className={sectionCard}>
              <div className={sectionHeaderRow}>
                <h3 className="text-sm font-semibold text-gray-900">Work</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tempo5kMode: "simple" }))}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      form.tempo5kMode === "simple"
                        ? "bg-orange-100 text-orange-900 ring-1 ring-orange-300"
                        : "bg-white text-gray-600 ring-1 ring-slate-200"
                    }`}
                  >
                    Steady (one pace)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tempo5kMode: "segments" }))}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      form.tempo5kMode === "segments"
                        ? "bg-orange-100 text-orange-900 ring-1 ring-orange-300"
                        : "bg-white text-gray-600 ring-1 ring-slate-200"
                    }`}
                  >
                    Progression (segments)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tempo5kMode: "blockRepeat" }))}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      form.tempo5kMode === "blockRepeat"
                        ? "bg-orange-100 text-orange-900 ring-1 ring-orange-300"
                        : "bg-white text-gray-600 ring-1 ring-slate-200"
                    }`}
                  >
                    Repeat group
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {form.tempo5kMode === "simple" ? (
                  <>
                    One work block: optional miles and pace offset vs 5K. {WC_HELP.onePace5kTempo}
                  </>
                ) : form.tempo5kMode === "blockRepeat" ? (
                  WC_HELP.tempoBlockRepeatWork
                ) : (
                  "Multiple work blocks — fixed miles and pace per block. The engine subtracts warmup/cooldown, applies your segments, then any leftover plan distance as a tempo work block, then cooldown if set."
                )}
              </p>
              {form.tempo5kMode === "simple" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label>
                    <span className="text-xs text-gray-500">Work miles (optional)</span>
                    <input
                      className="w-full border rounded px-2 py-1.5"
                      value={form.workBaseMiles}
                      onChange={(e) => setForm((f) => ({ ...f, workBaseMiles: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs text-gray-500">Work pace offset (sec/mi — blank for no pace target)</span>
                    <input
                      className="w-full border rounded px-2 py-1.5"
                      value={form.workPaceOffsetSecPerMile}
                      onChange={(e) => setForm((f) => ({ ...f, workPaceOffsetSecPerMile: e.target.value }))}
                    />
                  </label>
                </div>
              )}
              {form.tempo5kMode === "segments" && (
                <div className="space-y-2">
                  {form.tempoMilesSegs.map((row, i) => (
                    <div key={i} className="flex flex-wrap gap-2 items-end">
                      <label>
                        <span className="text-xs text-gray-500">Miles</span>
                        <input
                          placeholder="Miles"
                          className="block w-24 border rounded px-2 py-1"
                          value={row.miles}
                          onChange={(e) => {
                            const next = [...form.tempoMilesSegs];
                            next[i] = { ...row, miles: e.target.value };
                            setForm((f) => ({ ...f, tempoMilesSegs: next }));
                          }}
                        />
                      </label>
                      <PaceKeySelect
                        value={row.paceKey ?? ""}
                        onChange={(paceKey) => {
                          const next = [...form.tempoMilesSegs];
                          next[i] = { ...row, paceKey };
                          setForm((f) => ({ ...f, tempoMilesSegs: next }));
                        }}
                      />
                      <label>
                        <span className="text-xs text-gray-500">Offset vs 5K (sec/mi)</span>
                        <input
                          placeholder="Pace off."
                          className="block w-28 border rounded px-2 py-1"
                          value={row.pace}
                          onChange={(e) => {
                            const next = [...form.tempoMilesSegs];
                            next[i] = { ...row, pace: e.target.value };
                            setForm((f) => ({ ...f, tempoMilesSegs: next }));
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="text-xs text-red-600"
                        onClick={() => {
                          const next = form.tempoMilesSegs.filter((_, j) => j !== i);
                          setForm((f) => ({ ...f, tempoMilesSegs: next.length ? next : [{ miles: "", paceKey: "", pace: "" }] }));
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-sm text-orange-700"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        tempoMilesSegs: [...f.tempoMilesSegs, { miles: "", paceKey: "", pace: "" }],
                      }))
                    }
                  >
                    + Add work segment
                  </button>
                </div>
              )}
              {form.tempo5kMode === "blockRepeat" && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    Define tempo mile segments in order (one cycle). Below that, set how many times that whole cycle
                    repeats and timed recovery between cycles. Recovery pace uses the offset vs 5K for the light jog.
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-800">Segments in one cycle</p>
                    {form.tempoBlockSegs.map((row, i) => (
                      <div key={i} className="flex flex-wrap gap-2 items-end">
                        <label>
                          <span className="text-xs text-gray-500">Miles</span>
                          <input
                            type="text"
                            className="block w-24 border rounded px-2 py-1"
                            value={row.miles}
                            onChange={(e) => {
                              const next = [...form.tempoBlockSegs];
                              next[i] = { ...row, miles: e.target.value };
                              setForm((f) => ({ ...f, tempoBlockSegs: next }));
                            }}
                          />
                        </label>
                        <PaceKeySelect
                          value={row.paceKey ?? ""}
                          onChange={(paceKey) => {
                            const next = [...form.tempoBlockSegs];
                            next[i] = { ...row, paceKey };
                            setForm((f) => ({ ...f, tempoBlockSegs: next }));
                          }}
                        />
                        <label>
                          <span className="text-xs text-gray-500">Offset vs 5K (sec/mi)</span>
                          <input
                            type="text"
                            className="block w-28 border rounded px-2 py-1"
                            value={row.pace}
                            onChange={(e) => {
                              const next = [...form.tempoBlockSegs];
                              next[i] = { ...row, pace: e.target.value };
                              setForm((f) => ({ ...f, tempoBlockSegs: next }));
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="text-xs text-red-600"
                          onClick={() => {
                            const next = form.tempoBlockSegs.filter((_, j) => j !== i);
                            setForm((f) => ({
                              ...f,
                              tempoBlockSegs: next.length ? next : [{ miles: "", paceKey: "", pace: "" }],
                            }));
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-sm text-orange-700"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          tempoBlockSegs: [...f.tempoBlockSegs, { miles: "", paceKey: "", pace: "" }],
                        }))
                      }
                    >
                      + Add segment to group
                    </button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                    <h4 className="text-xs font-semibold text-gray-800">Repeat & recovery between whole cycles</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label>
                        <span className="text-xs text-gray-500">Repeat count</span>
                        <input
                          type="text"
                          className="w-full border rounded px-2 py-1.5"
                          value={form.tempoBlockRepeatCount}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, tempoBlockRepeatCount: e.target.value }))
                          }
                        />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="text-xs text-gray-500">Rest between cycles (sec)</span>
                        <input
                          type="text"
                          className="w-full max-w-xs border rounded px-2 py-1.5"
                          value={form.tempoBlockRecoverySec}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, tempoBlockRecoverySec: e.target.value }))
                          }
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-xs text-gray-500">Recovery pace offset (sec/mi — blank for no pace target)</span>
                      <input
                        type="text"
                        className="w-full max-w-xs border rounded px-2 py-1.5 mt-0.5"
                        value={form.recoveryPaceOffsetSecPerMile}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, recoveryPaceOffsetSecPerMile: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
            <div className={sectionCard}>
              <div className={sectionHeaderRow}>
                <h3 className="text-sm font-semibold text-gray-900">Cooldown</h3>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={form.noCooldown}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setForm((f) => ({
                        ...f,
                        noCooldown: v,
                        ...(v ? { cooldownMiles: "", cooldownPaceOffsetSecPerMile: "" } : {}),
                      }));
                    }}
                  />
                  No cooldown
                </label>
              </div>
              <p className="text-xs text-gray-500">
                {form.tempo5kMode === "segments" || form.tempo5kMode === "blockRepeat"
                  ? WC_HELP.progressionWc5kTempoC
                  : WC_HELP.steadyWc15}
              </p>
              {!form.noCooldown && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label>
                    <span className="text-xs text-gray-500">Miles (optional)</span>
                    <input
                      className="w-full border rounded px-2 py-1.5"
                      value={form.cooldownMiles}
                      onChange={(e) => setForm((f) => ({ ...f, cooldownMiles: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs text-gray-500">Cooldown pace offset (sec/mi — blank for no pace target)</span>
                    <input
                      className="w-full border rounded px-2 py-1.5"
                      value={form.cooldownPaceOffsetSecPerMile}
                      onChange={(e) => setForm((f) => ({ ...f, cooldownPaceOffsetSecPerMile: e.target.value }))}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {wt === "Tempo" && isMP && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              MP-anchored tempo: each % is a share of the scheduled run. Pace in the work block is from the
              athlete’s plan (goal time), not entered here.
            </p>
            <div className={sectionCard}>
              <h3 className="text-sm font-semibold text-gray-900">Warmup</h3>
              <label>
                <span className="text-xs text-gray-500">Warmup %</span>
                <input
                  className="w-full max-w-xs border rounded px-2 py-1.5"
                  value={form.warmupFractionPct}
                  onChange={(e) => setForm((f) => ({ ...f, warmupFractionPct: e.target.value }))}
                />
              </label>
            </div>
            <div className={sectionCard}>
              <h3 className="text-sm font-semibold text-gray-900">Work</h3>
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
                {WC_HELP.mpWorkCardNoteTempo}
              </p>
              <label>
                <span className="text-xs text-gray-500">Work (at goal MP) %</span>
                <input
                  className="w-full max-w-xs border rounded px-2 py-1.5"
                  value={form.workFractionPct}
                  onChange={(e) => setForm((f) => ({ ...f, workFractionPct: e.target.value }))}
                />
              </label>
            </div>
            <div className={sectionCard}>
              <h3 className="text-sm font-semibold text-gray-900">Cooldown</h3>
              <label>
                <span className="text-xs text-gray-500">Cooldown %</span>
                <input
                  className="w-full max-w-xs border rounded px-2 py-1.5"
                  value={form.cooldownFractionPct}
                  onChange={(e) => setForm((f) => ({ ...f, cooldownFractionPct: e.target.value }))}
                />
              </label>
            </div>
          </div>
        )}

        {wt === "Intervals" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Intervals: warmup, rep work, recovery jogs, then cooldown — same order as materialized segments. Reps
              and recovery are optional. Warmup and cooldown: absolute miles, not a % of the run; if you leave
              miles blank, the engine can default each to 15% of the scheduled run (interval paths in the builder).
            </p>
            <div className={sectionCard}>
              <div className={sectionHeaderRow}>
                <h3 className="text-sm font-semibold text-gray-900">Warmup</h3>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={form.noWarmup}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setForm((f) => ({
                        ...f,
                        noWarmup: v,
                        ...(v ? { warmupMiles: "", warmupPaceOffsetSecPerMile: "" } : {}),
                      }));
                    }}
                  />
                  No warmup
                </label>
              </div>
              <p className="text-xs text-gray-500">{WC_HELP.steadyWc15}</p>
              {!form.noWarmup && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <label>
                    <span className="text-xs text-gray-500">Miles (optional)</span>
                    <input
                      className="w-full border rounded px-2 py-1.5"
                      value={form.warmupMiles}
                      onChange={(e) => setForm((f) => ({ ...f, warmupMiles: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs text-gray-500">Warmup pace offset (sec/mi — blank for no pace target)</span>
                    <input
                      className="w-full border rounded px-2 py-1.5"
                      value={form.warmupPaceOffsetSecPerMile}
                      onChange={(e) => setForm((f) => ({ ...f, warmupPaceOffsetSecPerMile: e.target.value }))}
                    />
                  </label>
                </div>
              )}
            </div>
            <div className={sectionCard}>
              <div className={sectionHeaderRow}>
                <h3 className="text-sm font-semibold text-gray-900">Work</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, intervalMode: "flat" }))}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      form.intervalMode === "flat"
                        ? "bg-orange-100 text-orange-900 ring-1 ring-orange-300"
                        : "bg-white text-gray-600 ring-1 ring-slate-200"
                    }`}
                  >
                    Rep ladder (flat)
                  </button>
                  <button
                    type="button"
                    title="Rolling 400s, fast-float pairs, alternating strides"
                    onClick={() => setForm((f) => ({ ...f, intervalMode: "blockRepeat" }))}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      form.intervalMode === "blockRepeat"
                        ? "bg-orange-100 text-orange-900 ring-1 ring-orange-300"
                        : "bg-white text-gray-600 ring-1 ring-slate-200"
                    }`}
                  >
                    Block repeat
                  </button>
                </div>
              </div>
              {form.intervalMode === "flat" ? (
                <>
                  <p className="text-xs text-gray-500 space-y-1">
                    <span className="block">
                      Rep groups: distance, pace offset vs 5K, and reps per group. Rows expand in listed order: all reps
                      of row 1, then row 2, etc.
                    </span>
                    <span className="block text-gray-600 mt-1">
                      Rolling 400s or fast→float alternation: use <strong className="font-medium">Block repeat</strong> —
                      one cycle lists every stride in sequence; repeat count is full cycles (ABAB…), not reps on two ladder
                      rows.
                    </span>
                  </p>
                  {form.intervalSegs.map((row, i) => (
                    <div key={i} className="flex flex-wrap gap-2 items-end mb-2">
                      <label>
                        <span className="text-xs text-gray-500">Distance (m)</span>
                        <input
                          placeholder="Distance (m)"
                          className="block w-28 border rounded px-2 py-1"
                          value={row.distanceMeters}
                          onChange={(e) => {
                            const next = [...form.intervalSegs];
                            next[i] = { ...row, distanceMeters: e.target.value };
                            setForm((f) => ({ ...f, intervalSegs: next }));
                          }}
                        />
                      </label>
                      <PaceKeySelect
                        value={row.paceKey ?? ""}
                        onChange={(paceKey) => {
                          const next = [...form.intervalSegs];
                          next[i] = { ...row, paceKey };
                          setForm((f) => ({ ...f, intervalSegs: next }));
                        }}
                      />
                      <label>
                        <span className="text-xs text-gray-500">Offset vs 5K (sec/mi)</span>
                        <input
                          placeholder="Pace off."
                          className="block w-24 border rounded px-2 py-1"
                          value={row.pace}
                          onChange={(e) => {
                            const next = [...form.intervalSegs];
                            next[i] = { ...row, pace: e.target.value };
                            setForm((f) => ({ ...f, intervalSegs: next }));
                          }}
                        />
                      </label>
                      <label>
                        <span className="text-xs text-gray-500">Reps</span>
                        <input
                          placeholder="Reps"
                          className="block w-16 border rounded px-2 py-1"
                          value={row.reps}
                          onChange={(e) => {
                            const next = [...form.intervalSegs];
                            next[i] = { ...row, reps: e.target.value };
                            setForm((f) => ({ ...f, intervalSegs: next }));
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="text-xs text-red-600"
                        onClick={() => {
                          const next = form.intervalSegs.filter((_, j) => j !== i);
                          setForm((f) => ({
                            ...f,
                            intervalSegs: next.length ? next : [{ distanceMeters: "", paceKey: "", pace: "", reps: "1" }],
                          }));
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-sm text-orange-700"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        intervalSegs: [...f.intervalSegs, { distanceMeters: "", paceKey: "", pace: "", reps: "1" }],
                      }))
                    }
                  >
                    + Add rep group
                  </button>
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                    <h4 className="text-xs font-semibold text-gray-800">Recovery (between reps)</h4>
                    <p className="text-xs text-gray-500">{WC_HELP.intervalRepLadderRecovery}</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      <label>
                        <span className="text-xs text-gray-500">Time (seconds)</span>
                        <input
                          className="w-full border rounded px-2 py-1.5"
                          value={form.recoveryDurationSeconds}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, recoveryDurationSeconds: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span className="text-xs text-gray-500">Distance (m)</span>
                        <input
                          className="w-full border rounded px-2 py-1.5"
                          value={form.recoveryDistanceMeters}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, recoveryDistanceMeters: e.target.value }))
                          }
                        />
                      </label>
                      <label className="sm:col-span-2 lg:col-span-1">
                        <span className="text-xs text-gray-500">Recovery pace offset (sec/mi — blank for no pace target)</span>
                        <input
                          className="w-full border rounded px-2 py-1.5"
                          value={form.recoveryPaceOffsetSecPerMile}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, recoveryPaceOffsetSecPerMile: e.target.value }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">{WC_HELP.intervalBlockRepeatWork}</p>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-800">Segments in one cycle</p>
                    {form.intervalBlockSegs.map((row, i) => (
                      <div key={i} className="flex flex-wrap gap-2 items-end">
                        <label>
                          <span className="text-xs text-gray-500">Distance (m)</span>
                          <input
                            type="text"
                            className="block w-28 border rounded px-2 py-1"
                            value={row.distanceMeters}
                            onChange={(e) => {
                              const next = [...form.intervalBlockSegs];
                              next[i] = { ...row, distanceMeters: e.target.value };
                              setForm((f) => ({ ...f, intervalBlockSegs: next }));
                            }}
                          />
                        </label>
                        <PaceKeySelect
                          value={row.paceKey ?? ""}
                          onChange={(paceKey) => {
                            const next = [...form.intervalBlockSegs];
                            next[i] = { ...row, paceKey };
                            setForm((f) => ({ ...f, intervalBlockSegs: next }));
                          }}
                        />
                        <label>
                          <span className="text-xs text-gray-500">Offset vs 5K (sec/mi)</span>
                          <input
                            type="text"
                            className="block w-28 border rounded px-2 py-1"
                            value={row.pace}
                            onChange={(e) => {
                              const next = [...form.intervalBlockSegs];
                              next[i] = { ...row, pace: e.target.value };
                              setForm((f) => ({ ...f, intervalBlockSegs: next }));
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="text-xs text-red-600"
                          onClick={() => {
                            const next = form.intervalBlockSegs.filter((_, j) => j !== i);
                            setForm((f) => ({
                              ...f,
                              intervalBlockSegs: next.length
                                ? next
                                : [{ distanceMeters: "", paceKey: "", pace: "" }],
                            }));
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-sm text-orange-700"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          intervalBlockSegs: [
                            ...f.intervalBlockSegs,
                            { distanceMeters: "", paceKey: "", pace: "" },
                          ],
                        }))
                      }
                    >
                      + Add segment to block
                    </button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                    <h4 className="text-xs font-semibold text-gray-800">Repeat & recovery between whole cycles</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label>
                        <span className="text-xs text-gray-500">Repeat count</span>
                        <input
                          type="text"
                          className="w-full border rounded px-2 py-1.5"
                          value={form.intervalBlockRepeatCount}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, intervalBlockRepeatCount: e.target.value }))
                          }
                        />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="text-xs text-gray-500">Rest between cycles (sec)</span>
                        <input
                          type="text"
                          className="w-full max-w-xs border rounded px-2 py-1.5"
                          value={form.intervalBlockRecoverySec}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, intervalBlockRecoverySec: e.target.value }))
                          }
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-xs text-gray-500">Recovery pace offset (sec/mi — blank for no pace target)</span>
                      <input
                        type="text"
                        className="w-full max-w-xs border rounded px-2 py-1.5 mt-0.5"
                        value={form.recoveryPaceOffsetSecPerMile}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, recoveryPaceOffsetSecPerMile: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
            <div className={sectionCard}>
              <div className={sectionHeaderRow}>
                <h3 className="text-sm font-semibold text-gray-900">Cooldown</h3>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={form.noCooldown}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setForm((f) => ({
                        ...f,
                        noCooldown: v,
                        ...(v ? { cooldownMiles: "", cooldownPaceOffsetSecPerMile: "" } : {}),
                      }));
                    }}
                  />
                  No cooldown
                </label>
              </div>
              <p className="text-xs text-gray-500">{WC_HELP.steadyWc15}</p>
              {!form.noCooldown && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <label>
                    <span className="text-xs text-gray-500">Miles (optional)</span>
                    <input
                      className="w-full border rounded px-2 py-1.5"
                      value={form.cooldownMiles}
                      onChange={(e) => setForm((f) => ({ ...f, cooldownMiles: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs text-gray-500">Cooldown pace offset (sec/mi — blank for no pace target)</span>
                    <input
                      className="w-full border rounded px-2 py-1.5"
                      value={form.cooldownPaceOffsetSecPerMile}
                      onChange={(e) => setForm((f) => ({ ...f, cooldownPaceOffsetSecPerMile: e.target.value }))}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {wt === "Race" && (
          <div className={sectionCard}>
            <h3 className="text-sm font-semibold text-gray-900">Work</h3>
            <p className="text-xs text-gray-500">
              Optional finisher — default materialization is full distance at or near target race pace.
            </p>
            <label>
              <span className="text-xs text-gray-500">Pace offset (sec/mi — blank for no pace target)</span>
              <input
                className="w-full max-w-xs border rounded px-2 py-1.5"
                value={form.workPaceOffsetSecPerMile}
                onChange={(e) => setForm((f) => ({ ...f, workPaceOffsetSecPerMile: e.target.value }))}
              />
            </label>
          </div>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-gray-600">Optional: HR, notes</summary>
          <div className="mt-2 grid sm:grid-cols-2 gap-2">
            <label>
              <span className="text-xs">HR zone</span>
              <input
                className="w-full border rounded px-2 py-1.5"
                value={form.intendedHeartRateZone}
                onChange={(e) => setForm((f) => ({ ...f, intendedHeartRateZone: e.target.value }))}
              />
            </label>
            <label>
              <span className="text-xs">HR BPM low</span>
              <input
                className="w-full border rounded px-2 py-1.5"
                value={form.intendedHRBpmLow}
                onChange={(e) => setForm((f) => ({ ...f, intendedHRBpmLow: e.target.value }))}
              />
            </label>
            <label>
              <span className="text-xs">HR BPM high</span>
              <input
                className="w-full border rounded px-2 py-1.5"
                value={form.intendedHRBpmHigh}
                onChange={(e) => setForm((f) => ({ ...f, intendedHRBpmHigh: e.target.value }))}
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-xs">Notes</span>
              <textarea
                className="w-full border rounded px-2 py-1.5"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
          </div>
        </details>

        {err && <p className="text-red-600 text-sm">{err}</p>}
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-lg">
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
