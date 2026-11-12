export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { prisma } from "@/lib/prisma";
import { forwardProdPresetStaffRequest } from "@/lib/training/prod-preset-staff-proxy";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

const include = {
  longRunConfig: { select: { id: true, name: true } },
  easyConfig: { select: { id: true, name: true } },
  tempoConfig: { select: { id: true, name: true } },
  intervalsConfig: { select: { id: true, name: true } },
} as const;

function configId(body: Record<string, unknown>, key: string): string | null | undefined {
  if (!(key in body)) return undefined;
  const raw = body[key];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const row = await prisma.phase_preset.findUnique({ where: { id }, include });
  if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, phasePreset: row });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim() || "Phase";
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  for (const key of ["longRunConfigId", "easyConfigId", "tempoConfigId", "intervalsConfigId"] as const) {
    const value = configId(body, key);
    if (value !== undefined) data[key] = value;
  }

  const row = await prisma.phase_preset.update({ where: { id }, data, include }).catch(() => null);
  if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (authorization) {
    const prod = await forwardProdPresetStaffRequest({
      authorization,
      staffId: auth.manager.id,
      path: "/api/training/phase-preset",
      method: "POST",
      body: {
        id: row.id,
        name: row.name,
        description: row.description,
        longRunConfigId: row.longRunConfigId,
        easyConfigId: row.easyConfigId,
        tempoConfigId: row.tempoConfigId,
        intervalsConfigId: row.intervalsConfigId,
      },
    });
    if (!prod.ok) {
      const text = await prod.text();
      return NextResponse.json(
        {
          success: false,
          error: "Saved in Training Manage but prod sync failed",
          prodSyncError: text.slice(0, 500),
          phasePreset: row,
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ success: true, phasePreset: row });
}
