import { prisma } from "@/lib/prisma";
import { forwardProdPresetStaffRequest } from "@/lib/training/prod-preset-staff-proxy";
import type { PresetIngestRowInput } from "@/lib/training/preset-ingest-canon";
import { normalizeTargetDistance } from "@/lib/training/preset-ingest-canon";
import { normalizeSlug } from "@/lib/training/plan-entity-slugs";
import { randomUUID } from "crypto";

async function resolvePersonaIdBySlug(slug: string): Promise<string | null> {
  const t = slug.trim();
  if (!t) return null;
  const row = await prisma.training_plan_persona.findFirst({
    where: { slug: t },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function importPresetIngestRowToProd(opts: {
  row: PresetIngestRowInput;
  authorization: string;
  staffId: string;
}): Promise<
  | { ok: true; presetId: string; buildPresetId: string }
  | { ok: false; error: string; status?: number }
> {
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
  const buildPresetId = randomUUID();

  const minWeeklyMiles = Math.round(opts.row.minWeeklyMiles!);
  const maxWeeklyMiles = Math.round(opts.row.maxWeeklyMiles!);

  const pushRes = await forwardProdPresetStaffRequest({
    authorization: opts.authorization,
    staffId: opts.staffId,
    path: "/api/training/plan-preset/prodpush",
    method: "POST",
    body: {
      lastSyncedByStaffId: opts.staffId,
      plan: {
        id: presetId,
        title,
        slug,
        targetDistanceLabel: dist.value || null,
        minWeeklyMiles,
        maxWeeklyMiles,
        personaId,
        buildPresetId,
      },
      buildPreset: {
        id: buildPresetId,
        name: `${title} build`,
        startLongRunMiles: opts.row.startLongRunMiles,
        peakLongRunMiles: opts.row.peakLongRunMiles,
        maxWeeklyMiles,
      },
    },
  });

  const pushJson = (await pushRes.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
  };

  if (!pushRes.ok || pushJson.success === false) {
    return {
      ok: false,
      status: pushRes.status,
      error: pushJson.error || `Prod sync failed (${pushRes.status})`,
    };
  }

  await mirrorIngestRowToTrainingManageLocal({
    presetId,
    slug,
    title,
    targetDistanceLabel: dist.value || null,
    minWeeklyMiles,
    maxWeeklyMiles,
    personaId,
    buildPresetId,
    startLongRunMiles: opts.row.startLongRunMiles!,
    peakLongRunMiles: opts.row.peakLongRunMiles!,
  });

  return { ok: true, presetId, buildPresetId };
}

async function mirrorIngestRowToTrainingManageLocal(opts: {
  presetId: string;
  slug: string;
  title: string;
  targetDistanceLabel: string | null;
  minWeeklyMiles: number;
  maxWeeklyMiles: number;
  personaId: string | null;
  buildPresetId: string;
  startLongRunMiles: number;
  peakLongRunMiles: number;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.build_preset.upsert({
      where: { id: opts.buildPresetId },
      create: {
        id: opts.buildPresetId,
        name: `${opts.title} build`,
        startLongRunMiles: opts.startLongRunMiles,
        peakLongRunMiles: opts.peakLongRunMiles,
        maxWeeklyMiles: opts.maxWeeklyMiles,
      },
      update: {
        name: `${opts.title} build`,
        startLongRunMiles: opts.startLongRunMiles,
        peakLongRunMiles: opts.peakLongRunMiles,
        maxWeeklyMiles: opts.maxWeeklyMiles,
      },
    });

    await tx.training_plan_preset.upsert({
      where: { id: opts.presetId },
      create: {
        id: opts.presetId,
        slug: opts.slug,
        title: opts.title,
        description: "",
        targetDistanceLabel: opts.targetDistanceLabel,
        minWeeklyMiles: opts.minWeeklyMiles,
        maxWeeklyMiles: opts.maxWeeklyMiles,
        personaId: opts.personaId,
        buildPresetId: opts.buildPresetId,
      },
      update: {
        title: opts.title,
        slug: opts.slug,
        targetDistanceLabel: opts.targetDistanceLabel,
        minWeeklyMiles: opts.minWeeklyMiles,
        maxWeeklyMiles: opts.maxWeeklyMiles,
        personaId: opts.personaId,
        buildPresetId: opts.buildPresetId,
      },
    });
  });
}
