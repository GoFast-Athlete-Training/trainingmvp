export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { forwardProdPresetStaffRequest } from "@/lib/training/prod-preset-staff-proxy";
import { NextRequest, NextResponse } from "next/server";

const include = {
  longRunConfig: { select: { id: true, name: true } },
  easyConfig: { select: { id: true, name: true } },
  tempoConfig: { select: { id: true, name: true } },
  intervalsConfig: { select: { id: true, name: true } },
} as const;

function serialize(row: {
  id: string;
  name: string;
  description: string | null;
  longRunConfigId: string | null;
  easyConfigId: string | null;
  tempoConfigId: string | null;
  intervalsConfigId: string | null;
  longRunConfig?: { id: string; name: string } | null;
  easyConfig?: { id: string; name: string } | null;
  tempoConfig?: { id: string; name: string } | null;
  intervalsConfig?: { id: string; name: string } | null;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    longRunConfigId: row.longRunConfigId,
    easyConfigId: row.easyConfigId,
    tempoConfigId: row.tempoConfigId,
    intervalsConfigId: row.intervalsConfigId,
    longRunConfig: row.longRunConfig ?? null,
    easyConfig: row.easyConfig ?? null,
    tempoConfig: row.tempoConfig ?? null,
    intervalsConfig: row.intervalsConfig ?? null,
  };
}

async function mirrorToProd(
  request: NextRequest,
  staffId: string,
  phase: ReturnType<typeof serialize>,
) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!authorization) return null;
  return forwardProdPresetStaffRequest({
    authorization,
    staffId,
    path: "/api/training/phase-preset",
    method: "POST",
    body: phase,
  });
}

export async function GET(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const rows = await prisma.phase_preset.findMany({
    orderBy: { updatedAt: "desc" },
    include,
  });
  return NextResponse.json({ success: true, phasePresets: rows.map(serialize) });
}

export async function POST(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { name?: string; description?: string };
  const row = await prisma.phase_preset.create({
    data: {
      name: body.name?.trim() || "New phase preset",
      description: body.description?.trim() || null,
    },
    include,
  });
  const phase = serialize(row);
  const prod = await mirrorToProd(request, auth.manager.id, phase);
  if (prod && !prod.ok) {
    const text = await prod.text();
    return NextResponse.json(
      {
        success: false,
        error: "Saved in Training Manage but prod sync failed",
        phasePreset: phase,
        prodSyncError: text.slice(0, 500),
      },
      { status: 502 },
    );
  }
  return NextResponse.json({ success: true, phasePreset: phase });
}
