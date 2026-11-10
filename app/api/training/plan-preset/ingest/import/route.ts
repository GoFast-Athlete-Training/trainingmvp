export const dynamic = "force-dynamic";

import {
  resolvePlanPresetProdStaff,
  type ProdStaffProxyContext,
} from "@/lib/training/plan-preset-prod-forward";
import {
  importPresetIngestRowToProd,
} from "@/lib/training/preset-ingest-write-prod";
import {
  rowFromRecord,
  validatePresetIngestRow,
  type PresetIngestRowInput,
} from "@/lib/training/preset-ingest-canon";
import { NextRequest, NextResponse } from "next/server";

function isRowInput(v: unknown): v is PresetIngestRowInput {
  return v != null && typeof v === "object" && typeof (v as PresetIngestRowInput).title === "string";
}

export async function POST(request: NextRequest) {
  const ctx = await resolvePlanPresetProdStaff(request);
  if (ctx instanceof NextResponse) return ctx;

  const body = (await request.json().catch(() => ({}))) as {
    rows?: unknown[];
    importValidOnly?: boolean;
  };

  const items = Array.isArray(body.rows) ? body.rows : [];
  if (items.length === 0) {
    return NextResponse.json({ success: false, error: "rows is required" }, { status: 400 });
  }

  const results: {
    rowIndex: number;
    ok: boolean;
    presetId?: string;
    error?: string;
  }[] = [];

  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    let row: PresetIngestRowInput;
    if (isRowInput(raw)) {
      row = raw;
    } else if (raw != null && typeof raw === "object") {
      row = rowFromRecord(raw as Record<string, string>);
    } else {
      results.push({ rowIndex: i + 1, ok: false, error: "Invalid row" });
      skipped += 1;
      continue;
    }

    const preview = validatePresetIngestRow(row, i + 1);
    if (!preview.valid) {
      if (body.importValidOnly) {
        results.push({ rowIndex: preview.rowIndex, ok: false, error: preview.errors.join("; ") });
        skipped += 1;
        continue;
      }
      results.push({ rowIndex: preview.rowIndex, ok: false, error: preview.errors.join("; ") });
      skipped += 1;
      continue;
    }

    const written = await importPresetIngestRowToProd({
      row: preview.row,
      authorization: (ctx as ProdStaffProxyContext).authorization,
      staffId: (ctx as ProdStaffProxyContext).staffId,
    });

    if (!written.ok) {
      results.push({ rowIndex: preview.rowIndex, ok: false, error: written.error });
      skipped += 1;
      continue;
    }

    results.push({ rowIndex: preview.rowIndex, ok: true, presetId: written.presetId });
    imported += 1;
  }

  return NextResponse.json({
    success: imported > 0,
    imported,
    skipped,
    results,
  });
}
