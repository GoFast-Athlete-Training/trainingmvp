export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { runOpenAiJsonAgent } from "@/lib/training/openai-json";
import { validatePersonaDraft } from "@/lib/training/persona-draft";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You name a GoFast training persona from a staff description.

Define who the athlete is. Do not invent weekly miles, long runs, taper, or catalogue workouts.

Output JSON:
{
  "title": "staff label",
  "capability": "NON_RUNNER"|"BEGINNER"|"RECREATIONAL"|"COMPETITIVE"|"ELITE",
  "dedication": "LOW"|"MODERATE"|"HIGH"|"ELITE"|null,
  "personaGoalLabel": "short goal, e.g. aggressive marathon build",
  "intentSummary": "one sentence: we are trying to ...",
  "athletePersonaSummary": "who this athlete is, in a few sentences",
  "targetDistanceLabel": "5K"|"10K"|"Half Marathon"|"Marathon"|null,
  "goalKind": "RACE"|"TRAINING_BLOCK"
}`;

export async function POST(request: NextRequest) {
  const auth = await assertTrainingManagerAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { description?: string };
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) {
    return NextResponse.json(
      { success: false, error: "Describe who this athlete is." },
      { status: 400 },
    );
  }

  try {
    const raw = await runOpenAiJsonAgent<Record<string, unknown>>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: description,
    });
    return NextResponse.json({ success: true, draft: validatePersonaDraft(raw, description) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not build a persona";
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}
