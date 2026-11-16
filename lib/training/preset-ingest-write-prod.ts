import { applyPhaseShapeFields } from "@/lib/training/apply-phase-shape";
import { findPersonaBySlug } from "@/lib/training/plan-catalog-lookup";
import { forwardProdPresetStaffRequest } from "@/lib/training/prod-preset-staff-proxy";
import type { PresetIngestRowInput } from "@/lib/training/preset-ingest-canon";
import { normalizeTargetDistance } from "@/lib/training/preset-ingest-canon";
import { parseRaceWeekDayMilesCell, PHASE_NAME_FIELDS, PHASE_SLOT_FIELDS } from "@/lib/training/preset-shape-columns";

function phaseFieldMap(row: PresetIngestRowInput): Map<string, string> {
  const fields = new Map<string, string>();
  const read = (field: string) => {
    const value = row[field as keyof PresetIngestRowInput];
    return value == null ? "" : String(value);
  };
  for (const field of PHASE_NAME_FIELDS) fields.set(field, read(field));
  for (const field of PHASE_SLOT_FIELDS) fields.set(field, read(field));
  return fields;
}

export async function importPresetIngestRowToProd(opts: {
  row: PresetIngestRowInput;
  authorization: string;
  staffId: string;
}): Promise<{ ok: true; presetId: string } | { ok: false; error: string; status?: number }> {
  const prodStaff = { authorization: opts.authorization, staffId: opts.staffId };
  const dist = normalizeTargetDistance(opts.row.targetDistance);
  if (dist.error) {
    return { ok: false, error: dist.error };
  }

  let personaId: string | null = null;
  if (opts.row.personaSlug.trim()) {
    const persona = await findPersonaBySlug(opts.row.personaSlug, prodStaff);
    personaId = persona?.id ?? null;
    if (!personaId) {
      return {
        ok: false,
        error: `No persona found for slug “${opts.row.personaSlug.trim()}”.`,
      };
    }
  }

  const dayMiles = parseRaceWeekDayMilesCell(opts.row.raceWeekDayMiles);
  if ("error" in dayMiles) {
    return { ok: false, error: dayMiles.error };
  }

  const phaseFields = phaseFieldMap(opts.row);
  const phaseCheck = await applyPhaseShapeFields({ fields: phaseFields, dryRun: true, prodStaff });
  if (phaseCheck.errors.length > 0) {
    return { ok: false, error: phaseCheck.errors.join("; ") };
  }

  const title = opts.row.title.trim();
  const createRes = await forwardProdPresetStaffRequest({
    authorization: opts.authorization,
    staffId: opts.staffId,
    path: "/api/training/plan-preset",
    method: "POST",
    body: { title },
  });

  const createJson = (await createRes.json().catch(() => ({}))) as {
    preset?: { id: string };
    error?: string;
  };

  if (!createRes.ok || !createJson.preset?.id) {
    return {
      ok: false,
      status: createRes.status,
      error: createJson.error || `Create preset failed (${createRes.status})`,
    };
  }

  const presetId = createJson.preset.id;

  const applied = await applyPhaseShapeFields({ fields: phaseFields, prodStaff });
  if (applied.errors.length > 0) {
    return { ok: false, error: applied.errors.join("; ") };
  }

  const minWeeklyMiles = Math.round(opts.row.minWeeklyMiles!);
  const maxWeeklyMiles = Math.round(opts.row.maxWeeklyMiles!);
  const nudge = Math.round(opts.row.paceNudgeSecPerMile ?? 0);

  const patchBody: Record<string, unknown> = {
    title,
    description: "",
    targetDistanceLabel: dist.value || null,
    minWeeklyMiles,
    maxWeeklyMiles,
    personaId,
    paceNudgeSecPerMile: Number.isFinite(nudge) ? Math.max(-180, Math.min(180, nudge)) : 0,
    entryLongRunMiles: opts.row.entryLongRunMiles,
    peakLongRunMiles: opts.row.peakLongRunMiles,
    baseStartLongRunMiles: opts.row.baseStartLongRunMiles,
    baseEndLongRunMiles: opts.row.baseEndLongRunMiles,
    baseWeeklyMinMiles:
      opts.row.baseWeeklyMinMiles == null ? null : Math.round(opts.row.baseWeeklyMinMiles),
    baseWeeklyMaxMiles:
      opts.row.baseWeeklyMaxMiles == null ? null : Math.round(opts.row.baseWeeklyMaxMiles),
    peakWeeklyVolumeMiles:
      opts.row.peakWeeklyVolumeMiles == null ? null : Math.round(opts.row.peakWeeklyVolumeMiles),
    raceWeekMiles: opts.row.raceWeekMiles,
    baseEndWeeklyMiles:
      opts.row.baseEndWeeklyMiles == null ? null : Math.round(opts.row.baseEndWeeklyMiles),
    longRunCutback: opts.row.longRunCutback,
    taperWeek1TotalMiles: opts.row.taperWeek1TotalMiles,
    taperWeek1LongRunMiles: opts.row.taperWeek1LongRunMiles,
    taperWeek2TotalMiles: opts.row.taperWeek2TotalMiles,
    taperWeek2LongRunMiles: opts.row.taperWeek2LongRunMiles,
    raceWeekDayMiles: dayMiles.length > 0 ? dayMiles : null,
    baseBuildPhasePresetId: applied.pointers.baseBuildPhasePresetId ?? null,
    buildToPeakPhasePresetId: applied.pointers.buildToPeakPhasePresetId ?? null,
    taperPhasePresetId: applied.pointers.taperPhasePresetId ?? null,
    raceWeekPhasePresetId: applied.pointers.raceWeekPhasePresetId ?? null,
  };

  const patchRes = await forwardProdPresetStaffRequest({
    authorization: opts.authorization,
    staffId: opts.staffId,
    path: `/api/training/plan-preset/${encodeURIComponent(presetId)}`,
    method: "PATCH",
    body: patchBody,
  });

  if (!patchRes.ok) {
    const errJson = (await patchRes.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      status: patchRes.status,
      error: errJson.error || `PATCH preset failed (${patchRes.status})`,
    };
  }

  return { ok: true, presetId };
}
