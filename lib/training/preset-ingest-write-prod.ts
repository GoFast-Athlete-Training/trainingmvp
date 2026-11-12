import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyPhaseShapeFields } from "@/lib/training/apply-phase-shape";
import { forwardProdPresetStaffRequest } from "@/lib/training/prod-preset-staff-proxy";
import type { PresetIngestRowInput } from "@/lib/training/preset-ingest-canon";
import { normalizeTargetDistance } from "@/lib/training/preset-ingest-canon";
import { normalizeSlug } from "@/lib/training/plan-entity-slugs";
import { parseRaceWeekDayMilesCell, PHASE_NAME_FIELDS, PHASE_SLOT_FIELDS } from "@/lib/training/preset-shape-columns";
import { pushPresetToProd } from "@/lib/training/push-preset-to-prod";

async function resolvePersonaIdBySlug(slug: string): Promise<string | null> {
  const t = slug.trim();
  if (!t) return null;
  const row = await prisma.training_plan_persona.findFirst({
    where: { slug: t },
    select: { id: true },
  });
  return row?.id ?? null;
}

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
  const dist = normalizeTargetDistance(opts.row.targetDistance);
  if (dist.error) {
    return { ok: false, error: dist.error };
  }

  let personaId: string | null = null;
  if (opts.row.personaSlug.trim()) {
    personaId = await resolvePersonaIdBySlug(opts.row.personaSlug);
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
  const phaseCheck = await applyPhaseShapeFields({ fields: phaseFields, dryRun: true });
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
    preset?: { id: string; title: string; slug: string };
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
  const slug =
    createJson.preset.slug?.trim() ||
    normalizeSlug(title).slice(0, 80) ||
    `preset-${presetId.slice(-6)}`;

  const applied = await applyPhaseShapeFields({ fields: phaseFields });
  if (applied.errors.length > 0) {
    return { ok: false, error: applied.errors.join("; ") };
  }

  const minWeeklyMiles = Math.round(opts.row.minWeeklyMiles!);
  const maxWeeklyMiles = Math.round(opts.row.maxWeeklyMiles!);
  const nudge = Math.round(opts.row.paceNudgeSecPerMile ?? 0);

  const planWrite: Prisma.training_plan_presetUncheckedCreateInput = {
    id: presetId,
    slug,
    title,
    description: "",
    targetDistanceLabel: dist.value || null,
    minWeeklyMiles,
    maxWeeklyMiles,
    personaId,
    paceNudgeSecPerMile: Number.isFinite(nudge) ? Math.max(-180, Math.min(180, nudge)) : 0,
    entryLongRunMiles: opts.row.entryLongRunMiles,
    peakLongRunMiles: opts.row.peakLongRunMiles,
    baseEndWeeklyMiles:
      opts.row.baseEndWeeklyMiles == null ? null : Math.round(opts.row.baseEndWeeklyMiles),
    longRunCutback: opts.row.longRunCutback,
    taperWeek1TotalMiles: opts.row.taperWeek1TotalMiles,
    taperWeek1LongRunMiles: opts.row.taperWeek1LongRunMiles,
    taperWeek2TotalMiles: opts.row.taperWeek2TotalMiles,
    taperWeek2LongRunMiles: opts.row.taperWeek2LongRunMiles,
    raceWeekDayMiles: dayMiles.length > 0 ? dayMiles : Prisma.DbNull,
    baseBuildPhasePresetId: applied.pointers.baseBuildPhasePresetId ?? null,
    buildToPeakPhasePresetId: applied.pointers.buildToPeakPhasePresetId ?? null,
    taperPhasePresetId: applied.pointers.taperPhasePresetId ?? null,
    raceWeekPhasePresetId: applied.pointers.raceWeekPhasePresetId ?? null,
  };

  const { id, ...planUpdate } = planWrite;
  void id;
  await prisma.training_plan_preset.upsert({
    where: { id: presetId },
    create: planWrite,
    update: planUpdate as Prisma.training_plan_presetUncheckedUpdateInput,
  });

  const push = await pushPresetToProd({
    presetId,
    authorization: opts.authorization,
    staffId: opts.staffId,
  });
  if (!push.ok) {
    return { ok: false, status: push.status, error: push.error };
  }

  return { ok: true, presetId };
}
