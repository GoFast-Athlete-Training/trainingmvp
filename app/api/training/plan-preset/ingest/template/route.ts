export const dynamic = "force-dynamic";

import { presetIngestTemplateCsv } from "@/lib/training/preset-ingest-canon";
import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const csv = presetIngestTemplateCsv();
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plan-preset-ingest-template.csv"',
    },
  });
}
