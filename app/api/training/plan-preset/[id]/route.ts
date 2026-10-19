export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/training/plan-entity-slugs";
import { serializeBuildPreset } from "@/lib/training/preset-serialize";
import { syncPresetsToProd } from "@/lib/training/trigger-preset-prod-sync";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

const presetLinkInclude = {
  longRunConfig: { include: { positions: { orderBy: { cyclePosition: "asc" as const } } } },
  easyConfig: true,
  tempoConfig: true,
  intervalsConfig: true,
  buildPreset: { select: { id: true, name: true } },
  taperPreset: { select: { id: true, name: true } },
  raceWeekPreset: { select: { id: true, title: true } },
} as const;

function linkBuildPresetId(body: Record<string, unknown>): string | null | undefined {
  if ("buildPresetId" in body) {
    return typeof body.buildPresetId === "string" && body.buildPresetId ? body.buildPresetId : null;
  }
  if ("buildConfigId" in body) {
    return typeof body.buildConfigId === "string" && body.buildConfigId ? body.buildConfigId : null;
  }
  return undefined;
}

function linkTaperPresetId(body: Record<string, unknown>): string | null | undefined {
  if ("taperPresetId" in body) {
    return typeof body.taperPresetId === "string" && body.taperPresetId ? body.taperPresetId : null;
  }
  if ("taperConfigId" in body) {
    return typeof body.taperConfigId === "string" && body.taperConfigId ? body.taperConfigId : null;
  }
  return undefined;
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const row = await prisma.training_plan_preset.findUnique({
    where: { id },
    include: presetLinkInclude,
  });

  if (!row) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, preset: serializeBuildPreset(row) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const existing = await prisma.training_plan_preset.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    data.title = title;
    if (title) {
      const nextSlug = normalizeSlug(title).slice(0, 80);
      if (nextSlug) data.slug = nextSlug;
    }
  }
  if (typeof body.description === "string") data.description = body.description.trim();
  if (body.description === null) data.description = null;
  if (typeof body.publicDescription === "string") data.publicDescription = body.publicDescription.trim();
  if (body.publicDescription === null) data.publicDescription = null;
  if (typeof body.targetDistanceLabel === "string") {
    data.targetDistanceLabel = body.targetDistanceLabel.trim() || null;
  }
  if (body.targetDistanceLabel === null) data.targetDistanceLabel = null;
  if (typeof body.minWeeklyMiles === "number" && Number.isFinite(body.minWeeklyMiles)) {
    data.minWeeklyMiles = Math.max(1, Math.round(body.minWeeklyMiles));
  }
  if (body.maxWeeklyMiles === null) data.maxWeeklyMiles = null;
  if (typeof body.maxWeeklyMiles === "number" && Number.isFinite(body.maxWeeklyMiles)) {
    data.maxWeeklyMiles = Math.max(1, Math.round(body.maxWeeklyMiles));
  }
  if (typeof body.coachIntent === "string") data.coachIntent = body.coachIntent.trim();
  if (body.coachIntent === null) data.coachIntent = null;
  if ("personaId" in body) {
    data.personaId =
      typeof body.personaId === "string" && body.personaId.trim() ? body.personaId.trim() : null;
  }
  if ("goalId" in body) {
    data.goalId = typeof body.goalId === "string" && body.goalId.trim() ? body.goalId.trim() : null;
  }

  const buildId = linkBuildPresetId(body);
  if (buildId !== undefined) {
    if (buildId === null) {
      data.buildPresetId = null;
      data.snapPeakLongRunMiles = null;
      data.snapPeakWeeklyMiles = null;
    } else {
      const build = await prisma.build_preset.findUnique({ where: { id: buildId } });
      if (!build) {
        return NextResponse.json({ success: false, error: "Build preset not found" }, { status: 404 });
      }
      data.buildPresetId = build.id;
      data.snapPeakLongRunMiles = build.peakLongRunMiles;
      data.snapPeakWeeklyMiles = build.maxWeeklyMiles;
    }
  }

  const taperId = linkTaperPresetId(body);
  if (taperId !== undefined) {
    if (taperId === null) {
      data.taperPresetId = null;
      data.snapTaperWeek1TotalMiles = null;
      data.snapTaperWeek1LongRunMiles = null;
      data.snapTaperWeek2TotalMiles = null;
      data.snapTaperWeek2LongRunMiles = null;
    } else {
      const taper = await prisma.taper_preset.findUnique({ where: { id: taperId } });
      if (!taper) {
        return NextResponse.json({ success: false, error: "Taper preset not found" }, { status: 404 });
      }
      data.taperPresetId = taper.id;
      data.snapTaperWeek1TotalMiles = taper.week1TotalMiles;
      data.snapTaperWeek1LongRunMiles = taper.week1LongRunMiles;
      data.snapTaperWeek2TotalMiles = taper.week2TotalMiles;
      data.snapTaperWeek2LongRunMiles = taper.week2LongRunMiles;
    }
  }

  if ("raceWeekPresetId" in body) {
    if (typeof body.raceWeekPresetId !== "string" || !body.raceWeekPresetId) {
      data.raceWeekPresetId = null;
    } else {
      const raceWeek = await prisma.race_week_preset.findUnique({
        where: { id: body.raceWeekPresetId },
      });
      if (!raceWeek) {
        return NextResponse.json({ success: false, error: "Race week preset not found" }, { status: 404 });
      }
      data.raceWeekPresetId = raceWeek.id;
    }
  }

  const row = await prisma.training_plan_preset.update({
    where: { id },
    data,
    include: presetLinkInclude,
  });

  const authorization = request.headers.get("authorization")?.trim();
  if (authorization) {
    const prodSync = await syncPresetsToProd({
      presetIds: [id],
      authorization,
      staffId: auth.manager.id,
    });
    if (!prodSync.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Saved in Training Manage but prod sync failed",
          prodSyncError: prodSync.error,
          prodSyncStatus: prodSync.status,
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ success: true, preset: serializeBuildPreset(row) });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (authorization) {
    const prodRes = await (
      await import("@/lib/training/prod-preset-staff-proxy")
    ).forwardProdPresetStaffRequest({
      authorization,
      staffId: auth.manager.id,
      path: `/api/training/plan-preset/${encodeURIComponent(id)}`,
      method: "DELETE",
    });
    if (prodRes.ok) {
      await prisma.training_plan_preset.deleteMany({ where: { id } }).catch(() => undefined);
      const text = await prodRes.text();
      return new NextResponse(text || JSON.stringify({ success: true }), {
        status: prodRes.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    const errText = await prodRes.text();
    return NextResponse.json(
      { success: false, error: errText.slice(0, 500) || "Prod delete failed" },
      { status: prodRes.status >= 400 ? prodRes.status : 502 },
    );
  }

  const existing = await prisma.training_plan_preset.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  await prisma.training_plan_preset.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
