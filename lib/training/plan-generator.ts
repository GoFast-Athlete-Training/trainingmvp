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
  preferredDays: number[]; // Preferred training days (1=Monday, 7=Sunday)
  totalWeeks: number; // Calculated externally
  planStartDate: Date; // Actual start date - used to determine day of week patterns
}

// Lap format: stored in warmup/workout/cooldown JSON arrays
export interface TrainingPlanLap {
  lapIndex: number; // Sequential within warmup/workout/cooldown (1-based, must increment)
  distanceMiles: number; // 0.25, 1.0, etc (must be > 0)
  paceGoal: string | null; // "7:20" or null (mm:ss format)
  hrGoal?: string | null; // "Z2", "Z3", "Z4", "Z5" or null (optional heart rate zone)
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
  weeks?: TrainingPlanWeek[]; // Optional - only included in initial generation for week 1
}

// Generated Plan: Initial generation returns phases + week 1 only
export interface GeneratedPlan {
  totalWeeks: number;
  phases: TrainingPlanPhase[]; // phases[] with weekCount only (no weeks array)
  week: TrainingPlanWeek; // Week 1 only
}

// Weekly Generation Inputs (for generating subsequent weeks)
export interface WeeklyGenerationInputs {
  trainingPlanId: string;
  weekNumber: number; // Which week to generate (2, 3, 4, etc.)
  phaseName: string; // Which phase this week belongs to
  previousWeekMileage?: number; // Total miles from previous week (for progression)
  previousWeekExecution?: {
    completedDays: number;
    totalMiles: number;
    averagePace?: string;
    notes?: string;
  }; // Execution data from previous week (for adaptive training)
  raceName: string;
  raceDistance: string;
  goalTime: string;
  fiveKPace: string;
  predictedRacePace: string;
  goalRacePace: string;
  currentWeeklyMileage: number; // Baseline
  preferredDays: number[];
  planStartDate: Date;
}

// Generated Week: Single week structure
export interface GeneratedWeek {
  weekNumber: number;
  days: TrainingPlanDay[]; // Exactly 7 days
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
  
  // Calculate how many days are left in the week (for partial first week)
  // If starting Monday (1), generate 7 days. If starting Friday (5), generate 3 days (Fri, Sat, Sun)
  const daysRemainingInWeek = 8 - startDayNumber; // Monday=1 → 7 days, Friday=5 → 3 days, Sunday=7 → 1 day
  
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
  
  // Build list of dayNumbers to generate for Week 1
  const week1DayNumbers: number[] = [];
  for (let i = startDayNumber; i <= 7; i++) {
    week1DayNumbers.push(i);
  }
  const week1DayNames = week1DayNumbers.map(d => {
    const names = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return names[d];
  }).join(', ');
  
  const prompt = `You are a professional running coach creating a training plan using the GoFast Training Model.

CRITICAL: You MUST return ONLY phases (with weekCount) and Week 1. DO NOT generate weeks 2, 3, 4, etc.

GoFast Training Model:
- Base Phase (~25% of total weeks): Foundation building, easy runs, base mileage (20-40% of plan total), low intensity, emphasize consistency
- Build Phase (~35% of total weeks): Introduce workouts, increase weekly volume gradually, tempo runs, intervals, strength building
- Peak Phase (~20% of total weeks): Hardest weeks, highest mileage, race-specific workouts, pace work, tune-up races
- Taper Phase (remaining weeks): Reduce mileage 20-40% per week, maintain intensity, race pace work

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
- Athlete's preferred training days: ${inputs.preferredDays.map(d => {
    const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return dayNames[d];
  }).join(', ')} (dayNumbers: ${inputs.preferredDays.join(', ')})
- PRIORITIZE workouts on these preferred days when possible
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
- When assigning workouts, prioritize the athlete's preferred days (${inputs.preferredDays.join(', ')}) for key workouts like intervals, tempo runs, and long runs

E. MILEAGE RULES (CRITICAL):
- Easy days must total 3-5 miles (sum of warmup + workout + cooldown)
- Moderate days must total 4-7 miles
- Long run days must be 6-12 miles in Week 1, scaling gradually each week
- Recovery days must total 2-4 miles
- Rest days must have EMPTY warmup, workout, and cooldown arrays (all three arrays empty)
- A day with ANY workout MUST have mileage (cannot be zero miles)
- Do NOT generate zero-mile run days except pure rest days

F. PREFERRED TRAINING DAY ENFORCEMENT (MANDATORY - NOT OPTIONAL):
- Athlete's preferred training days: ${inputs.preferredDays.map(d => {
    const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return dayNames[d];
  }).join(', ')} (dayNumbers: ${inputs.preferredDays.join(', ')})

YOU MUST STRICTLY OBEY PREFERRED TRAINING DAYS:
- If a day IS preferred: It MUST be a run (with proper warmup/workout/cooldown), unless the plan calls for scheduled rest
- If a day is NOT preferred: It MUST be rest (all arrays empty) or very short recovery (2-3 miles max)
- Saturday MUST be the long run day (unless race-day proximity requires adjustment)
- Sunday MUST be a recovery run (2-4 miles easy pace)
- Tuesday/Wednesday/Thursday rotate: easy → tempo → intervals (assign based on phase and week progression)
- Monday + Friday: Rest or light recovery unless in Peak phase (then may have easy runs)

Day-of-Week Pattern (MANDATORY):
- Monday (dayNumber 1): Rest or recovery (after weekend long run)
- Tuesday (dayNumber 2): Easy/moderate run OR intervals (if preferred)
- Wednesday (dayNumber 3): Moderate or tempo run (if preferred)
- Thursday (dayNumber 4): Intervals or steady tempo (traditional speed day, if preferred)
- Friday (dayNumber 5): Rest or recovery (prep for weekend, unless preferred)
- Saturday (dayNumber 6): LONG RUN (MANDATORY if preferred, 6-12 miles in Week 1)
- Sunday (dayNumber 7): Recovery run (2-4 miles easy, MANDATORY if preferred)

G. WARMUP / WORKOUT / COOLDOWN GUARANTEES (CRITICAL):
For ANY run day (non-rest):
- warmup MUST have at least 1 lap of 0.5-1.0 miles (paceGoal null)
- workout MUST have at least 1 lap:
    * distanceMiles >= 2.0 for easy/moderate days
    * interval days may have multiple short laps (e.g., 0.25-0.5 miles each)
- cooldown MUST have at least 1 lap of 0.5-1.0 miles (paceGoal null)
- paceGoal must be "mm:ss" format (e.g., "7:20") or null for easy/recovery
- This prevents empty arrays on run days

H. START-DATE ALIGNMENT RULES:
- Week 1 MUST align to the actual plan start date provided: ${startDateStr} (${startDayName}, dayNumber ${startDayNumber})
- If the start date lands mid-week, fill the remaining days of that week lightly:
    * Prefer rest or short easy runs
    * Do NOT overload the athlete
- Week numbering MUST stay global (weekNumber = 1..N)
- All future weeks after Week 1 should follow a Monday-Sunday structure

I. RACE-WEEK & SHAKEOUT RULES:
- The day BEFORE the race MUST be a rest day (all arrays empty)
- Two days before the race MUST be a 2-4 mile shakeout run
- No hard workouts during race week

J. DAILY MILEAGE CALCULATION RULES:
For any run day:
totalMiles = sum(warmup.laps.distanceMiles) + sum(workout.laps.distanceMiles) + sum(cooldown.laps.distanceMiles)
You MUST ensure:
- totalMiles matches the intended type of day (easy: 3-5, moderate: 4-7, long: 6-12, recovery: 2-4)
- No negative or zero-mile run days (except pure rest days)

K. STRUCTURED LAP FORMAT:
- Each day MUST have "warmup", "workout", "cooldown" arrays
- Rest days: ALL arrays must be empty []
- Run days: warmup and cooldown must have at least 1 lap each, workout must have at least 1 lap
- Each lap MUST have:
  - lapIndex (number, starts at 1 within each array)
  - distanceMiles (number, e.g., 0.25, 1.0, 4.0, must be > 0)
  - paceGoal (string | null, format "mm:ss" like "7:20" or null for easy/recovery)

F. CRITICAL OUTPUT RULES:
- DO NOT generate calendar dates. We will compute dates ourselves.
- DO NOT generate weeks 2, 3, 4, 5, etc. ONLY generate week 1.
- DO NOT include "weeks" array inside phases. Phases should ONLY have "name" and "weekCount".
- Structure MUST be exactly: { "totalWeeks": number, "phases": [...], "week": {...} }
- Each phase MUST have ONLY "name" and "weekCount" - NO "weeks" property
- Phase distribution: base ~25%, build ~35%, peak ~20%, taper remaining
- Generate ONLY the phase structure (with weekCount) and Week 1
- Week 1 MUST have "weekNumber": 1
- Week 1 MUST have exactly ${daysRemainingInWeek} days (dayNumbers: ${week1DayNumbers.join(', ')}) because plan starts on ${startDayName}
- DO NOT generate days before the start date
- Progress mileage gradually - Week 1 should target approximately ${Math.round(inputs.currentWeeklyMileage * (daysRemainingInWeek / 7))} miles (proportional to ${daysRemainingInWeek} days remaining in week)
- Include rest days appropriately (all arrays empty for pure rest days)
- DO NOT create adaptive metrics, summaries, or preferred days

VALIDATION REQUIREMENTS:
- Each week MUST have exactly 7 days
- Each day MUST include warmup/workout/cooldown arrays
- A run day cannot have empty arrays (must have at least 1 lap in warmup, workout, and cooldown)
- Rest days must have ALL arrays empty
- lapIndex MUST be sequential (1, 2, 3...) within each array - NOT all the same number!
- distanceMiles must be > 0 for any lap
- paceGoal must be "mm:ss" format (e.g., "7:20") or null
- hrGoal is optional but recommended (Z2/Z3/Z4/Z5 or null)
- Daily mileage must match day type (easy: 3-5, moderate: 4-7, long: 6-12, recovery: 2-4)
- Weekly mileage MUST total approximately ${inputs.currentWeeklyMileage} miles for Week 1
- Weekly mileage = sum of ALL lap distances across all 7 days (warmup + workout + cooldown)
- Preferred training days MUST be respected (run days on preferred days, rest on non-preferred)

CRITICAL: The JSON structure must be EXACTLY this format (no variations):
{
  "totalWeeks": ${inputs.totalWeeks},
  "phases": [
    { "name": "base", "weekCount": 5 },
    { "name": "build", "weekCount": 7 },
    { "name": "peak", "weekCount": 4 },
    { "name": "taper", "weekCount": 3 }
  ],
  "week": {
    "weekNumber": 1,
    "days": [
      { "dayNumber": 1, "warmup": [], "workout": [], "cooldown": [] },
      { "dayNumber": 2, "warmup": [], "workout": [], "cooldown": [] },
      { "dayNumber": 3, "warmup": [], "workout": [], "cooldown": [] },
      { "dayNumber": 4, "warmup": [], "workout": [], "cooldown": [] },
      { "dayNumber": 5, "warmup": [], "workout": [], "cooldown": [] },
      { "dayNumber": 6, "warmup": [], "workout": [], "cooldown": [] },
      { "dayNumber": 7, "warmup": [], "workout": [], "cooldown": [] }
    ]
  }
}

DO NOT include "weeks" inside phases. DO NOT generate weeks beyond week 1. Return ONLY this JSON structure.`;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional running coach. You MUST return ONLY phases (with name and weekCount) and week 1. DO NOT generate weeks 2, 3, 4, etc. DO NOT include "weeks" array inside phases. Return ONLY valid JSON matching this exact structure: {"totalWeeks": number, "phases": [{"name": "base", "weekCount": 5}, ...], "week": {"weekNumber": 1, "days": [...]}}',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000, // Reduced since we only generate phases + week 1 now
      response_format: { type: 'json_object' }, // Force JSON mode
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Clean JSON response - remove markdown code blocks
    let cleaned = content.replace(/```json|```/g, '').trim();
    
    // Try to extract JSON if it's wrapped in other text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    // Fix common JSON issues
    // Remove trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    
    // Try to parse JSON with better error handling
    let parsed: GeneratedPlan;
    try {
      parsed = JSON.parse(cleaned) as GeneratedPlan;
    } catch (parseError: any) {
      console.error('❌ JSON Parse Error:', parseError.message);
      console.error('❌ JSON Position:', parseError.message.match(/position (\d+)/)?.[1]);
      console.error('❌ JSON Content (first 500 chars):', cleaned.substring(0, 500));
      console.error('❌ JSON Content (around error):', cleaned.substring(Math.max(0, (parseError.message.match(/position (\d+)/)?.[1] || 0) - 100), (parseError.message.match(/position (\d+)/)?.[1] || 0) + 100));
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}. This usually means the AI returned malformed JSON. Please try again.`);
    }

    // Validate structure
    if (!parsed.phases || !Array.isArray(parsed.phases)) {
      throw new Error('Invalid plan structure: missing phases array');
    }

    // Clean up phases - remove any "weeks" arrays if AI included them (should only have weekCount)
    for (const phase of parsed.phases) {
      if ('weeks' in phase) {
        console.warn('⚠️ AI included weeks array in phase, removing it. Phase should only have name and weekCount.');
        // Try to extract week 1 if it exists in the weeks array
        if (Array.isArray(phase.weeks) && phase.weeks.length > 0 && !parsed.week) {
          const week1 = phase.weeks.find((w: any) => w.weekNumber === 1);
          if (week1) {
            parsed.week = week1;
            console.log('✅ Extracted week 1 from phase.weeks array');
          }
        }
        delete phase.weeks;
      }
      // Ensure only name and weekCount exist
      const cleanedPhase = {
        name: phase.name,
        weekCount: phase.weekCount,
      };
      Object.assign(phase, cleanedPhase);
    }

    // If still no week, try to find it in any phase's weeks array (fallback)
    if (!parsed.week) {
      for (const phase of parsed.phases as any[]) {
        if (phase.weeks && Array.isArray(phase.weeks)) {
          const week1 = phase.weeks.find((w: any) => w.weekNumber === 1);
          if (week1) {
            parsed.week = week1;
            console.log('✅ Found week 1 in phase weeks array (fallback)');
            break;
          }
        }
      }
    }

    if (!parsed.week || !parsed.week.weekNumber || parsed.week.weekNumber !== 1) {
      throw new Error('Invalid plan structure: missing or invalid week 1. AI must return week 1 with weekNumber: 1');
    }

    // Validate phase order (CRITICAL)
    if (!validatePhaseOrder(parsed.phases)) {
      throw new Error(
        `Invalid phase order. Phases must be in this exact order: ${TRAINING_PHASE_ORDER.join(', ')}. ` +
        `Received: ${parsed.phases.map(p => p.name).join(', ')}`
      );
    }

    // Validate phase structure (phases should only have name and weekCount, no weeks array)
    for (const phase of parsed.phases) {
      if (!phase.name || typeof phase.weekCount !== 'number') {
        throw new Error(`Invalid phase structure: ${JSON.stringify(phase)}. Must have name and weekCount only.`);
      }
      // Validate phase name is one of the allowed phases
      if (!TRAINING_PHASE_ORDER.includes(phase.name as any)) {
        throw new Error(`Invalid phase name: ${phase.name}. Must be one of: ${TRAINING_PHASE_ORDER.join(', ')}`);
      }
    }

    // Validate week 1 structure
    const week = parsed.week;
    if (!week.days || !Array.isArray(week.days)) {
      throw new Error(`Invalid week structure: missing days array`);
    }
    if (week.days.length !== 7) {
      throw new Error(`Week 1 must have exactly 7 days, got ${week.days.length}`);
    }
    for (const day of week.days) {
      if (!day.dayNumber || day.dayNumber < 1 || day.dayNumber > 7) {
        throw new Error(`Invalid dayNumber: ${day.dayNumber}. Must be 1-7 (Monday-Sunday)`);
      }
      if (!day.warmup || !day.workout || !day.cooldown) {
        throw new Error(`Invalid day structure: missing warmup/workout/cooldown arrays`);
      }
      // Validate lap structure
      [...day.warmup, ...day.workout, ...day.cooldown].forEach((lap) => {
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

    console.log('✅ PLAN GENERATOR: Successfully parsed and validated plan:', {
      phasesCount: parsed.phases.length,
      hasWeek: !!parsed.week,
      weekDays: parsed.week?.days?.length,
    });

    return parsed;
  } catch (error: any) {
    console.error('❌ PLAN GENERATOR: Error generating training plan:', error);
    // Preserve original error message
    if (error.message) {
      throw error;
    }
    throw new Error(`Failed to generate training plan: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Generate a single week of training using OpenAI
 * Used for progressive weekly generation (week 2, 3, 4, etc.)
 */
export async function generateWeekAI(
  inputs: WeeklyGenerationInputs
): Promise<GeneratedWeek> {
  const startDate = new Date(inputs.planStartDate);
  const startDayOfWeek = startDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const startDayName = dayNames[startDayOfWeek];
  const startDayNumber = startDayOfWeek === 0 ? 7 : startDayOfWeek;

  // Build context about previous week if available
  let previousWeekContext = '';
  if (inputs.previousWeekExecution) {
    previousWeekContext = `
Previous Week Execution Summary:
- Completed Days: ${inputs.previousWeekExecution.completedDays}/7
- Total Miles: ${inputs.previousWeekExecution.totalMiles} miles
${inputs.previousWeekExecution.averagePace ? `- Average Pace: ${inputs.previousWeekExecution.averagePace}/mile` : ''}
${inputs.previousWeekExecution.notes ? `- Notes: ${inputs.previousWeekExecution.notes}` : ''}
`;
  }

  const prompt = `You are a professional running coach generating Week ${inputs.weekNumber} of a training plan.

Training Plan Context:
- Race: ${inputs.raceName} (${inputs.raceDistance})
- Goal Time: ${inputs.goalTime}
- Current Phase: ${inputs.phaseName}
- Athlete current 5K pace: ${inputs.fiveKPace} per mile
- Predicted race pace: ${inputs.predictedRacePace} per mile
- Goal race pace: ${inputs.goalRacePace} per mile
- Baseline weekly mileage: ${inputs.currentWeeklyMileage} miles/week
- Preferred training days: ${inputs.preferredDays.map(d => {
    const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return dayNames[d];
  }).join(', ')} (dayNumbers: ${inputs.preferredDays.join(', ')})
${previousWeekContext}
Week Requirements:
- Generate ONLY Week ${inputs.weekNumber} (7 days)
- Week MUST have exactly 7 days (dayNumber 1-7, Monday-Sunday)
- Progress mileage appropriately from previous week
${inputs.previousWeekMileage ? `- Previous week mileage: ${inputs.previousWeekMileage} miles` : ''}
- Follow phase-appropriate training for ${inputs.phaseName} phase
- Prioritize workouts on preferred days: ${inputs.preferredDays.join(', ')}

Day Structure:
- Each day MUST have "dayNumber" (1-7), "warmup", "workout", "cooldown" arrays
- Each lap MUST have: lapIndex (number), distanceMiles (number), paceGoal (string | null)

Return ONLY this JSON structure:
{
  "weekNumber": ${inputs.weekNumber},
  "days": [
    { "dayNumber": 1, "warmup": [...], "workout": [...], "cooldown": [...] },
    ... (7 days total)
  ]
}`;

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional running coach. Generate single weeks of training plans. Always return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000, // Single week is much smaller
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

    let parsed: GeneratedWeek;
    try {
      parsed = JSON.parse(cleaned) as GeneratedWeek;
    } catch (parseError: any) {
      console.error('❌ WEEK JSON Parse Error:', parseError.message);
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }

    // Validate week structure
    if (parsed.weekNumber !== inputs.weekNumber) {
      throw new Error(`Week number mismatch: expected ${inputs.weekNumber}, got ${parsed.weekNumber}`);
    }
    if (!parsed.days || !Array.isArray(parsed.days) || parsed.days.length !== 7) {
      throw new Error(`Week ${inputs.weekNumber} must have exactly 7 days, got ${parsed.days?.length || 0}`);
    }

    // Validate each day
    for (const day of parsed.days) {
      if (!day.dayNumber || day.dayNumber < 1 || day.dayNumber > 7) {
        throw new Error(`Invalid dayNumber: ${day.dayNumber}. Must be 1-7`);
      }
      if (!day.warmup || !day.workout || !day.cooldown) {
        throw new Error(`Invalid day structure: missing warmup/workout/cooldown arrays`);
      }
    }

    return parsed;
  } catch (error) {
    console.error(`Error generating week ${inputs.weekNumber}:`, error);
    throw error;
  }
}


