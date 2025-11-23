import OpenAI from 'openai';
import { prisma } from '../prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface TrainingInputs {
  raceName: string;
  raceDate: string;
  raceDistance: string;
  goalTime: string;
  baseline5k: string;
  weeklyMileage: number;
  preferredRunDays?: number[];
  athleteAge?: number;
}

export interface WeekDay {
  dayIndex: number;
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
  date: string;
}

export interface Week {
  weekIndex: number;
  phase: string;
  days: WeekDay[];
}

export interface GeneratedPlan {
  totalWeeks: number;
  phaseOverview: {
    base: { startWeek: number; endWeek: number };
    build: { startWeek: number; endWeek: number };
    peak: { startWeek: number; endWeek: number };
    taper: { startWeek: number; endWeek: number };
  };
  weeklyMileagePlan: number[];
  weeks: Week[];
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

Calculate weeks until race: ${Math.ceil(
    (new Date(inputs.raceDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 7)
  )} weeks

Inputs:
- Race: ${inputs.raceName} (${inputs.raceDistance})
- Race Date: ${inputs.raceDate}
- Goal Time: ${inputs.goalTime}
- Baseline 5K Pace: ${inputs.baseline5k} per mile
- Current Weekly Mileage: ${inputs.weeklyMileage} miles
- Preferred Run Days: ${inputs.preferredRunDays?.join(', ') || 'Not specified'}

You must return EXACT JSON ONLY (no markdown, no explanation):
{
  "totalWeeks": 18,
  "phaseOverview": {
    "base": { "startWeek": 0, "endWeek": 4 },
    "build": { "startWeek": 5, "endWeek": 11 },
    "peak": { "startWeek": 12, "endWeek": 15 },
    "taper": { "startWeek": 16, "endWeek": 17 }
  },
  "weeklyMileagePlan": [20, 22, 24, ...],
  "weeks": [
    {
      "weekIndex": 0,
      "phase": "base",
      "days": [
        {
          "dayIndex": 0,
          "plannedData": {
            "type": "easy",
            "mileage": 4,
            "paceRange": "8:30-9:00",
            "hrZone": "2",
            "hrRange": "130-150",
            "label": "Easy Run",
            "description": "Comfortable pace, conversational"
          },
          "date": "2025-02-01"
        }
      ]
    }
  ]
}

Rules:
- Generate ALL weeks from start date to race date
- Each week has 7 days (dayIndex 0-6, Monday-Sunday)
- Calculate dates starting from today or specified start date
- Include rest days appropriately
- Progress mileage gradually
- Match phases to weeks correctly
- Return complete plan with all weeks and days

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

/**
 * Save generated plan to database
 * Creates TrainingPlan and ALL TrainingDayPlanned records
 */
export async function saveTrainingPlanToDB(
  athleteId: string,
  raceId: string,
  plan: GeneratedPlan,
  inputs: TrainingInputs
): Promise<string> {
  // Create TrainingPlan
  const trainingPlan = await prisma.trainingPlan.create({
    data: {
      athleteId,
      raceId,
      trainingPlanName: `${inputs.raceName} Training Plan`,
      trainingPlanGoalTime: inputs.goalTime,
      trainingPlanBaseline5k: inputs.baseline5k,
      trainingPlanBaselineWeeklyMileage: inputs.weeklyMileage,
      trainingPlanStartDate: new Date(),
      trainingPlanTotalWeeks: plan.totalWeeks,
      status: 'active',
    },
  });

  // Create ALL TrainingDayPlanned records
  const dayRecords = [];
  for (const week of plan.weeks) {
    for (const day of week.days) {
      dayRecords.push({
        trainingPlanId: trainingPlan.id,
        athleteId,
        date: new Date(day.date),
        weekIndex: week.weekIndex,
        dayIndex: day.dayIndex,
        dayName: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][
          day.dayIndex
        ],
        phase: week.phase,
        plannedData: day.plannedData,
      });
    }
  }

  await prisma.trainingDayPlanned.createMany({
    data: dayRecords,
  });

  return trainingPlan.id;
}

