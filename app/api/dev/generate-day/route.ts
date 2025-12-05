export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Simple type for validation (not used in DB)
interface TrainingDay {
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // "Monday", "Tuesday", etc.
  totalMiles: number;
  workoutType: string; // "long_run", "easy", "tempo", "intervals", "rest"
  description: string;
  laps: Array<{
    lapNumber: number; // Sequential 1, 2, 3...
    distanceMiles: number; // > 0
    paceTarget: string; // "mm:ss" format or "easy"
    hrTarget: string; // "135-145" or "Z2", etc.
  }>;
}

/**
 * DEV SANDBOX: Generate a single training day JSON
 * POST /api/dev/generate-day
 * Returns raw JSON from GPT for prompt experimentation
 */
export async function POST(request: NextRequest) {
  try {
    const prompt = `You are a professional running coach. Produce ONE training day in EXACTLY this JSON structure:

{
  "date": "2025-12-05",
  "dayOfWeek": "Friday",
  "totalMiles": 14.0,
  "workoutType": "long_run",
  "description": "Steady aerobic long run with slight negative split.",
  "laps": [
    {
      "lapNumber": 1,
      "distanceMiles": 1.0,
      "paceTarget": "8:15",
      "hrTarget": "135-145"
    },
    {
      "lapNumber": 2,
      "distanceMiles": 1.0,
      "paceTarget": "8:10",
      "hrTarget": "135-145"
    }
  ]
}

CRITICAL RULES:
- Return ONLY valid JSON, nothing else
- Every mile should be its own lap (if 14 miles, you need 14 laps)
- lapNumber must be sequential (1, 2, 3, 4...)
- totalMiles must equal the sum of all laps' distanceMiles
- workoutType must be one of: "long_run", "easy", "tempo", "intervals", "rest"
- paceTarget format: "mm:ss" (e.g., "8:15") or "easy" for recovery
- hrTarget format: "135-145" (bpm range) or "Z2", "Z3", "Z4", "Z5" (zones)
- date format: YYYY-MM-DD
- dayOfWeek: Full name ("Monday", "Tuesday", etc.)

Example for a 5-mile easy run:
{
  "date": "2025-12-06",
  "dayOfWeek": "Saturday",
  "totalMiles": 5.0,
  "workoutType": "easy",
  "description": "Easy recovery run at conversational pace.",
  "laps": [
    { "lapNumber": 1, "distanceMiles": 1.0, "paceTarget": "8:30", "hrTarget": "Z2" },
    { "lapNumber": 2, "distanceMiles": 1.0, "paceTarget": "8:30", "hrTarget": "Z2" },
    { "lapNumber": 3, "distanceMiles": 1.0, "paceTarget": "8:30", "hrTarget": "Z2" },
    { "lapNumber": 4, "distanceMiles": 1.0, "paceTarget": "8:30", "hrTarget": "Z2" },
    { "lapNumber": 5, "distanceMiles": 1.0, "paceTarget": "8:30", "hrTarget": "Z2" }
  ]
}

Generate a realistic training day. Return ONLY the JSON object.`;

    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional running coach. Generate training day JSON. Always return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }, // Force JSON output
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Clean JSON response
    let cleaned = content.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    // Parse JSON
    let parsed: TrainingDay;
    try {
      parsed = JSON.parse(cleaned) as TrainingDay;
    } catch (parseError: any) {
      console.error('❌ JSON Parse Error:', parseError.message);
      console.error('❌ JSON Content:', cleaned.substring(0, 500));
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse AI response as JSON',
          details: parseError.message,
          rawResponse: cleaned.substring(0, 1000), // Return first 1000 chars for debugging
        },
        { status: 500 }
      );
    }

    // Basic validation
    if (!parsed.date || !parsed.dayOfWeek || !parsed.laps || !Array.isArray(parsed.laps)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid day structure: missing required fields',
          parsed,
        },
        { status: 500 }
      );
    }

    // Validate totalMiles matches sum of laps
    const calculatedTotal = parsed.laps.reduce((sum, lap) => sum + lap.distanceMiles, 0);
    if (Math.abs(calculatedTotal - parsed.totalMiles) > 0.01) {
      console.warn(`⚠️ Total miles mismatch: stated ${parsed.totalMiles}, calculated ${calculatedTotal}`);
    }

    // Return the parsed JSON exactly as GPT generated it
    return NextResponse.json({
      success: true,
      day: parsed,
      rawJson: cleaned, // Also return raw JSON string for inspection
    });
  } catch (error: any) {
    console.error('❌ GENERATE DAY: Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate training day',
        details: error?.message,
      },
      { status: 500 }
    );
  }
}

