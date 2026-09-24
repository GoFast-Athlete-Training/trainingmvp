export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { runOpenAiJsonAgent } from "@/lib/training/openai-json";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  await params;

  const body = (await request.json().catch(() => ({}))) as { draft?: string };
  const draft = typeof body.draft === "string" ? body.draft.trim() : "";
  if (!draft) {
    return NextResponse.json(
      { success: false, error: "Write a public description first, then clean up." },
      { status: 400 },
    );
  }

  try {
    const result = await runOpenAiJsonAgent<{ publicDescription: string }>({
      systemPrompt: `You polish athlete-facing training plan copy for GoFast.
Output JSON: { "publicDescription": "..." }
Keep the same meaning. Fix grammar and tone: encouraging, clear, no jargon.
Do not add schedules, mileages, workout names, or new claims. Do not mention staff notes.`,
      userPrompt: draft,
    });
    const text = result.publicDescription?.trim();
    if (!text) {
      return NextResponse.json({ success: false, error: "Empty draft" }, { status: 502 });
    }
    return NextResponse.json({ success: true, publicDescription: text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI failed";
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}
