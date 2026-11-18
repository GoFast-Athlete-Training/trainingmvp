export const dynamic = "force-dynamic";

import { assertTrainingManagerAuth } from "@/lib/auth/training-manager-auth";
import { runOpenAiJsonAgent } from "@/lib/training/openai-json";
import { validatePersonaDraft } from "@/lib/training/persona-draft";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You build a GoFast training persona from a staff description of an athlete.

The persona describes who the athlete is and how they should be coached. It is not a training plan. Do not invent weekly miles, long-run distances, days per week, paces, taper, phases, or catalogue workouts.

Preserve stated numbers and ranges exactly. If the athlete says 45–50 miles per week, weeklyMileage.value is "45–50 miles per week". Do not round, widen, or replace that range. If a number was not written, omit it.

Each trainingProfile attribute is { "value": string, "source": "explicit" | "inferred" } or null.
- explicit: the description states it.
- inferred: a qualitative judgment the description supports, with no new numbers.
Use null when the description does not support the attribute.

High intensity is not high mileage. Wanting a PR is not a dedication level. Set dedication to null unless the description explicitly names a dedication or commitment level (low, moderate, high, or elite). Leave workoutFrequencyCap null unless a sessions-per-week count is written; put that count in trainingFrequency only when it was written.

capability is the coarse enum NON_RUNNER, BEGINNER, RECREATIONAL, COMPETITIVE, or ELITE.
An advanced or Boston-qualifying athlete is COMPETITIVE unless the description says elite or professional.
experience is the finer label, such as "Advanced".

primaryGoal keeps the stated performance goal, including marathon PR and Boston Qualifying when both are mentioned.
targetDistance is the race distance they are training for, such as "Marathon".

trainingPriorities is the coaching strategy for this athlete, inside their stated constraints. For a marathoner, name threshold work, marathon-pace workouts, progressive long runs, and recovery, and hold volume at the stated mileage instead of raising it. No generic motivation.

intentSummary repeats trainingPriorities.
athletePersonaSummary is two sentences that still name experience, weekly mileage, intensity tolerance, volume tolerance, and sustainable training when those were stated.

Output JSON:
{
  "title": "short staff label",
  "capability": "COMPETITIVE",
  "dedication": null,
  "workoutFrequencyCap": null,
  "personaGoalLabel": "short goal",
  "intentSummary": "coaching priorities paragraph",
  "athletePersonaSummary": "identity that keeps mileage, intensity, volume, and sustainability",
  "targetDistanceLabel": "Marathon",
  "goalKind": "RACE",
  "trainingProfile": {
    "experience": { "value": "Advanced", "source": "explicit" },
    "primaryGoal": { "value": "Marathon PR and Boston Qualifying", "source": "explicit" },
    "targetDistance": { "value": "Marathon", "source": "explicit" },
    "weeklyMileage": { "value": "45–50 miles per week", "source": "explicit" },
    "volumeTolerance": { "value": "Moderate", "source": "explicit" },
    "intensityTolerance": { "value": "High", "source": "explicit" },
    "trainingFrequency": null,
    "aerobicFoundation": null,
    "recoveryConsiderations": { "value": "Protect recovery while balancing work and family", "source": "explicit" },
    "lifestyleConstraints": { "value": "Work, family, and recovery", "source": "explicit" },
    "coachingPhilosophy": { "value": "Keep training sustainable and do not add volume", "source": "explicit" },
    "trainingPriorities": { "value": "Prioritize marathon-specific intensity inside the stated mileage.", "source": "inferred" }
  }
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
