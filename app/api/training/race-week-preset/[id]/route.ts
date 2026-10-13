export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { serializeRaceWeekPreset } from "@/lib/training/preset-serialize";
import {
  presetIdsLinkedToRaceWeekPreset,
  syncPresetsToProd,
} from "@/lib/training/trigger-preset-prod-sync";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const row = await prisma.race_week_preset.findUnique({
    where: { id },
  });

  if (!row) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, preset: serializeRaceWeekPreset(row) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title.trim();
  if (body.slots !== undefined) data.slots = body.slots;

  const row = await prisma.race_week_preset.update({
    where: { id },
    data,
  });

  const authorization = request.headers.get("authorization")?.trim();
  if (authorization) {
    const presetIds = await presetIdsLinkedToRaceWeekPreset(id);
    const prodSync = await syncPresetsToProd({
      presetIds,
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

  return NextResponse.json({ success: true, preset: serializeRaceWeekPreset(row) });
}
