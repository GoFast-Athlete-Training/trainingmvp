import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface TrainingInputs {
  raceName: string;
  raceDistance: string;
  goalTime: string;
  fiveKPace: string; // mm:ss format - from athlete.fiveKPace
  totalWeeks: number; // Calculated externally
}

export interface WeekDay {
  dayIndex: number; // 1-7 (1=Monday, 7=Sunday)
  plannedData: {
    type: string;
    mileage: number;
    paceRange?: string;
    targetPace?: string;
    hrZone?: string;
    hrRange?: string;
    segments?: Array<{
      type: string;
      distance?: number;
      duration?: number;
      pace?: string;
      reps?: number;
    }>;
    label?: string;
    description?: string;
    coachNotes?: string;
  };
  // NO date field - dates computed by backend
}

export interface Week {
  weekIndex: number;
  phase: string;
  days: WeekDay[];
}

export interface GeneratedPlan {
  totalWeeks: number;
  weeks: Week[];
  // phaseOverview and weeklyMileagePlan removed - not needed
}

/**
 * Generate a complete training plan using OpenAI
 * Creates ALL weeks and days immediately (not incrementally)
 */
export async function generateTrainingPlanAI(
  inputs: TrainingInputs
): Promise<GeneratedPlan> {
  const prompt = `You are a professional running coach creating a training plan using the GoFast Training Model.

GoFast Training Model:
- Base Phase (~25% of total weeks): Foundation building, easy runs, base mileage, low intensity
- Build Phase (~35% of total weeks): Gradual mileage increase, tempo runs, intervals, strength building
- Peak Phase (~20% of total weeks): Highest mileage, race-specific workouts, pace work, tune-up races
- Taper Phase (remaining weeks): Reduce mileage 30% per week, maintain intensity, race pace work

Workout Types:
- easy: Easy pace runs for base building
- tempo: Sustained effort at threshold pace
- intervals: High-intensity intervals with recovery
- long_run: Long distance runs for endurance
- rest: Recovery days

Inputs:
- Race: ${inputs.raceName} (${inputs.raceDistance})
- Goal Time: ${inputs.goalTime}
- 5K Pace: ${inputs.fiveKPace} per mile
- Total Weeks: ${inputs.totalWeeks}

You must return EXACT JSON ONLY (no markdown, no explanation):
{
  "totalWeeks": ${inputs.totalWeeks},
  "weeks": [
    {
      "weekIndex": 1,
      "phase": "base",
      "days": [
        {
          "dayIndex": 1,
          "plannedData": {
            "type": "easy",
            "mileage": 4,
            "paceRange": "8:30-9:00",
            "hrZone": "2",
            "hrRange": "130-150",
            "label": "Easy Run",
            "description": "Comfortable pace, conversational"
          }
        }
      ]
    }
  ]
}

CRITICAL RULES:
- DO NOT generate calendar dates. We will compute dates ourselves.
- DO NOT return anything except weekIndex, dayIndex, phase, and plannedData.
- dayIndex MUST be 1-7 (1=Monday, 2=Tuesday, ..., 7=Sunday)
- Each week MUST have exactly 7 days (dayIndex 1 through 7)
- weekIndex starts at 1 (first week is 1, second week is 2, etc.)
- Generate ALL weeks from weekIndex 1 to weekIndex ${inputs.totalWeeks}
- Include rest days appropriately
- Progress mileage gradually
- Match phases to weeks correctly (base ~25%, build ~35%, peak ~20%, taper remaining)
- Return complete plan with all weeks and all days
- DO NOT create adaptive metrics, summaries, or preferred days

Return ONLY the JSON object, nothing else.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional running coach. Generate complete training plans. Always return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Clean JSON response
    const cleaned = content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as GeneratedPlan;

    return parsed;
  } catch (error) {
    console.error('Error generating training plan:', error);
    throw new Error('Failed to generate training plan');
  }
}


