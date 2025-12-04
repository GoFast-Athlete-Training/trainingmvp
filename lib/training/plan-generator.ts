import OpenAI from 'openai';
import { TRAINING_PHASE_ORDER, validatePhaseOrder } from '@/config/training-phases';

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export interface TrainingInputs {
  raceName: string;
  raceDistance: string; // raceType string (marathon, half, etc.) for display
  raceMiles?: number; // Optional: miles for accurate calculations
  goalTime: string;
  fiveKPace: string; // mm:ss format - from athlete.fiveKPace (current fitness)
  predictedRacePace: string; // mm:ss format - predicted race pace based on 5K fitness
  goalRacePace: string; // mm:ss format - goal race pace from goal time
  currentWeeklyMileage: number; // Baseline weekly mileage - start here and build up gradually
  totalWeeks: number; // Calculated externally
  planStartDate: Date; // Actual start date - used to determine day of week patterns
}

// Lap format: stored in warmup/workout/cooldown JSON arrays
export interface TrainingPlanLap {
  lapIndex: number; // Local within warmup/workout/cooldown
  distanceMiles: number; // 0.25, 1.0, etc
  paceGoal: string | null; // "7:20" or null
}

// Day: belongs to week, contains structured workout
export interface TrainingPlanDay {
  dayNumber: number; // 1-7 (1=Monday, 7=Sunday)
  warmup: TrainingPlanLap[]; // Lap array
  workout: TrainingPlanLap[]; // Lap array
  cooldown: TrainingPlanLap[]; // Lap array
  notes?: string;
}

// Week: belongs to phase, contains days
export interface TrainingPlanWeek {
  weekNumber: number; // Global week 1-N (within entire plan)
  days: TrainingPlanDay[]; // Exactly 7 days
}

// Phase: Base / Build / Peak / Taper
export interface TrainingPlanPhase {
  name: string; // "base" | "build" | "peak" | "taper"
  weekCount: number; // How many weeks in this phase
  totalMiles?: number; // Optional - computed later
  weeks: TrainingPlanWeek[]; // Weeks belonging to this phase
}

// Generated Plan: Complete cascade structure
export interface GeneratedPlan {
  totalWeeks: number;
  phases: TrainingPlanPhase[]; // phases[] → weeks[] → days[]
}

/**
 * Generate a complete training plan using OpenAI
 * Creates ALL weeks and days immediately (not incrementally)
 */
export async function generateTrainingPlanAI(
  inputs: TrainingInputs
): Promise<GeneratedPlan> {
  // Determine day of week the plan starts on
  const startDate = new Date(inputs.planStartDate);
  const startDayOfWeek = startDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const startDayName = dayNames[startDayOfWeek];
  
  // Convert to our 1-7 system (1=Monday, 7=Sunday)
  const startDayNumber = startDayOfWeek === 0 ? 7 : startDayOfWeek;
  
  // Format dates for AI context
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
  const todayDay = String(today.getDate()).padStart(2, '0');
  const todayDateStr = `${todayMonth}/${todayDay}/${todayYear}`;
  
  const startYear = startDate.getFullYear();
  const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
  const startDay = String(startDate.getDate()).padStart(2, '0');
  const startDateStr = `${startMonth}/${startDay}/${startYear}`;
  
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
- Athlete current 5K pace: ${inputs.fiveKPace} per mile (baseline fitness)
- Predicted race pace (based on fitness): ${inputs.predictedRacePace} per mile (realistic pace today)
- Goal race pace (target for race day): ${inputs.goalRacePace} per mile (training target)
- Current Weekly Mileage: ${inputs.currentWeeklyMileage} miles/week (BASELINE - start here and build up gradually)
- Total Weeks: ${inputs.totalWeeks}
- Plan Start Date: ${startDateStr} (${startDayName}, dayNumber ${startDayNumber})

Pace Usage Guidelines:
- Use predictedRacePace (${inputs.predictedRacePace}/mile) for:
  * Sustainable weekly mileage planning
  * Default "easy" run pacing
  * Base phase workouts
- Use goalRacePace (${inputs.goalRacePace}/mile) for:
  * Late-phase tempo workouts
  * Race-specific pace work
  * Long run pacing in peak phase
- Use 5K pace (${inputs.fiveKPace}/mile) for:
  * Interval workouts (VO2 max)
  * Speed work
  * High-intensity training

You must return EXACT JSON ONLY (no markdown, no explanation):
{
  "totalWeeks": ${inputs.totalWeeks},
  "phases": [
    {
      "name": "base",
      "weekCount": 4,
      "weeks": [
        {
          "weekNumber": 1,
          "days": [
            {
              "dayNumber": 1,
              "warmup": [
                {
                  "lapIndex": 1,
                  "distanceMiles": 0.5,
                  "paceGoal": null
                }
              ],
              "workout": [
                {
                  "lapIndex": 1,
                  "distanceMiles": 4.0,
                  "paceGoal": "8:30"
                }
              ],
              "cooldown": [
                {
                  "lapIndex": 1,
                  "distanceMiles": 0.5,
                  "paceGoal": null
                }
              ],
              "notes": "Easy run, conversational pace"
            }
          ]
        }
      ]
    }
  ]
}

CRITICAL RULES:

A. PHASE ORDER (MANDATORY):
- Phases MUST be generated in this EXACT order:
  1. "base"
  2. "build"
  3. "peak"
  4. "taper"
- All four phases must be present
- Order cannot be changed or rearranged

B. START DATE RULE:
- Today is ${todayDateStr}. The plan starts on ${startDateStr} (${startDayName}).
- If the plan start date is mid-week (not Monday), the first week should be light:
  - Light easy running only
  - No structured workouts (intervals, tempo, etc.)
  - No excessive mileage
  - Finish out the week safely
- Full structured training begins the following Monday
- The backend will map days to actual calendar dates

C. GRADUAL PROGRESSION RULE (CRITICAL):
- Start at current baseline: ${inputs.currentWeeklyMileage} miles/week
- Build up gradually week by week (increase by 5-10% per week)
- Peak mileage should be appropriate for the race distance:
  * Marathon: Peak at 40-60 miles/week
  * Half Marathon: Peak at 30-45 miles/week
  * 10K: Peak at 25-35 miles/week
  * 5K: Peak at 20-30 miles/week
- DO NOT jump from ${inputs.currentWeeklyMileage} miles to peak immediately - build gradually over the base/build phases
- Weekly mileage should increase gradually in base phase, peak in build/peak phases, then taper down in taper phase

D. DAY BEFORE RACE RULE (CRITICAL):
- The day before the race MUST ALWAYS be:
  - Rest (empty workout array), OR
  - 1-2 mile shakeout run at very easy pace
- NEVER assign intensity, intervals, tempo, or long runs the day before the race
- This is the LAST day of the plan

D. DAY-OF-WEEK TRAINING PATTERNS (CRITICAL):
- Respect traditional day-of-week training patterns:
  - Monday: Recovery/easy day (after weekend long run)
  - Tuesday: Workout day (intervals, tempo, or speed work)
  - Wednesday: Easy/recovery day
  - Thursday: Speed work or tempo day (traditional speed day)
  - Friday: Recovery/easy day (prep for weekend)
  - Saturday: Long run day (traditional long run day)
  - Sunday: Easy recovery or rest day (after long run)
  
- The plan starts on ${startDayName} (dayNumber ${startDayNumber})
- If starting mid-week, maintain these patterns:
  - If starting Thursday: First Thursday = speed day, Friday = recovery, Saturday = long run
  - If starting Friday: First Friday = recovery, Saturday = long run
  - If starting Saturday: First Saturday = long run (but lighter if partial week)
  - Always respect the day-of-week pattern, even in partial first week
  
- Every week MUST follow Monday-Sunday structure:
  - dayNumber 1 = Monday
  - dayNumber 2 = Tuesday
  - dayNumber 3 = Wednesday
  - dayNumber 4 = Thursday (speed day)
  - dayNumber 5 = Friday (recovery)
  - dayNumber 6 = Saturday (long run)
  - dayNumber 7 = Sunday (recovery/rest)
- Each week MUST have exactly 7 days (dayNumber 1 through 7)
- The backend will map these dayNumbers to actual calendar dates based on the plan start date

E. STRUCTURED LAP FORMAT:
- Each day MUST have "warmup", "workout", "cooldown" arrays (can be empty [])
- Each lap MUST have:
  - lapIndex (number, starts at 1 within each array)
  - distanceMiles (number, e.g., 0.25, 1.0, 4.0)
  - paceGoal (string | null, format "mm:ss" like "7:20" or null for easy/recovery)

F. GENERAL RULES:
- DO NOT generate calendar dates. We will compute dates ourselves.
- Structure MUST be: phases[] → weeks[] → days[]
- Each phase MUST have "weekCount" (number of weeks in that phase)
- Each week MUST have "weekNumber" (global 1-N across entire plan)
- Generate ALL phases, ALL weeks, ALL days
- Phase distribution: base ~25%, build ~35%, peak ~20%, taper remaining
- Progress mileage gradually across weeks
- Include rest days appropriately (empty workout array or easy pace)
- Return complete plan with all phases, weeks, and days
- DO NOT create adaptive metrics, summaries, or preferred days

Return ONLY the JSON object, nothing else.`;

  try {
    const openai = getOpenAIClient();
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

    // Validate structure
    if (!parsed.phases || !Array.isArray(parsed.phases)) {
      throw new Error('Invalid plan structure: missing phases array');
    }

    // Validate phase order (CRITICAL)
    if (!validatePhaseOrder(parsed.phases)) {
      throw new Error(
        `Invalid phase order. Phases must be in this exact order: ${TRAINING_PHASE_ORDER.join(', ')}. ` +
        `Received: ${parsed.phases.map(p => p.name).join(', ')}`
      );
    }

    // Validate phase structure
    for (const phase of parsed.phases) {
      if (!phase.name || !phase.weeks || !Array.isArray(phase.weeks)) {
        throw new Error(`Invalid phase structure: ${JSON.stringify(phase)}`);
      }
      // Validate phase name is one of the allowed phases
      if (!TRAINING_PHASE_ORDER.includes(phase.name as any)) {
        throw new Error(`Invalid phase name: ${phase.name}. Must be one of: ${TRAINING_PHASE_ORDER.join(', ')}`);
      }
      for (const week of phase.weeks) {
        if (!week.weekNumber || !week.days || !Array.isArray(week.days)) {
          throw new Error(`Invalid week structure: ${JSON.stringify(week)}`);
        }
        if (week.days.length !== 7) {
          throw new Error(`Week ${week.weekNumber} must have exactly 7 days, got ${week.days.length}`);
        }
        for (const day of week.days) {
          if (!day.dayNumber || day.dayNumber < 1 || day.dayNumber > 7) {
            throw new Error(`Invalid dayNumber: ${day.dayNumber}. Must be 1-7 (Monday-Sunday)`);
          }
          if (!day.warmup || !day.workout || !day.cooldown) {
            throw new Error(`Invalid day structure: missing warmup/workout/cooldown arrays`);
          }
          // Validate lap structure
          [...day.warmup, ...day.workout, ...day.cooldown].forEach((lap, index) => {
            if (!lap.lapIndex || typeof lap.lapIndex !== 'number') {
              throw new Error(`Invalid lap structure: lapIndex must be a number`);
            }
            if (!lap.distanceMiles || typeof lap.distanceMiles !== 'number') {
              throw new Error(`Invalid lap structure: distanceMiles must be a number`);
            }
            if (lap.paceGoal !== null && typeof lap.paceGoal !== 'string') {
              throw new Error(`Invalid lap structure: paceGoal must be string or null`);
            }
          });
        }
      }
    }

    return parsed;
  } catch (error) {
    console.error('Error generating training plan:', error);
    throw new Error('Failed to generate training plan');
  }
}


