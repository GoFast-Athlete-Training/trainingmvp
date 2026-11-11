export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolvePlanPresetProdStaff } from "@/lib/training/plan-preset-prod-forward";
import { loadPresetValidateRow } from "@/lib/training/preset-validate-load";
import { buildPresetPatchExportCsv } from "@/lib/training/preset-patch-csv";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const ctx = await resolvePlanPresetProdStaff(request);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const row = await loadPresetValidateRow(id);
  if (!row) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Preset not in Training Manage — save from the wizard once or import so patch CSV can run.",
      },
      { status: 404 },
    );
  }

  const csv = buildPresetPatchExportCsv(row);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="preset-${row.slug || id}-patch.csv"`,
    },
  });
}
