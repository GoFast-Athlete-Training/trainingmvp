export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { runOpenAiJsonAgent } from "@/lib/training/openai-json";
import {
  PRESET_INGEST_CSV_COLUMNS,
  rowFromRecord,
  validatePresetIngestRow,
  type PresetIngestPreviewRow,
} from "@/lib/training/preset-ingest-canon";
import { NextRequest, NextResponse } from "next/server";

type AiResponse = {
  rows?: Record<string, unknown>[];
};

export async function POST(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = body.text?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ success: false, error: "text is required" }, { status: 400 });
  }

  try {
    const parsed = await runOpenAiJsonAgent<AiResponse>({
      systemPrompt: `You extract training plan preset rows for staff import.
Return JSON: { "rows": [ ... ] }.
Each row uses these string/number fields only (omit unknown): ${PRESET_INGEST_CSV_COLUMNS.join(", ")}.
Use targetDistance labels like Marathon, Half Marathon, 5K, 10K.
Numbers must be JSON numbers, not strings.`,
      userPrompt: text,
    });

    const rawRows = Array.isArray(parsed.rows) ? parsed.rows : [];
    const previews: PresetIngestPreviewRow[] = rawRows.map((raw, idx) => {
      const record: Record<string, string> = {};
      for (const col of PRESET_INGEST_CSV_COLUMNS) {
        const v = raw[col];
        if (v == null) continue;
        record[col] = String(v);
      }
      const input = rowFromRecord(record);
      return validatePresetIngestRow(input, idx + 1);
    });

    return NextResponse.json({ success: true, rows: previews });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Parse failed";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
