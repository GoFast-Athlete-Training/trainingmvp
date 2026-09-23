export const dynamic = "force-dynamic";

import { assertStaffForward } from "@/lib/staff-forward-auth";
import {
  importBuildPreset,
  type ProductPresetImportPayload,
} from "@/lib/training/preset-import";
import { NextRequest, NextResponse } from "next/server";

/** Human lane — upsert one product preset by preserved id (Bearer + x-gofast-staff-id). */
export async function POST(request: NextRequest) {
  const auth = assertStaffForward(request);
  if (!auth.ok) return auth.response;

  let body: ProductPresetImportPayload;
  try {
    body = (await request.json()) as ProductPresetImportPayload;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.preset || typeof body.preset !== "object") {
    return NextResponse.json({ success: false, error: "preset object is required" }, { status: 400 });
  }

  try {
    const result = await importBuildPreset(body);
    return NextResponse.json({ success: true, presetId: result.presetId });
  } catch (err: unknown) {
    console.error("plan-preset import:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
