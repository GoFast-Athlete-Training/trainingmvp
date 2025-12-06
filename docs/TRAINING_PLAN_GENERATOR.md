# Training Plan Generator Service

**Purpose:** Generate personalized training plans using OpenAI GPT-4o-mini with progressive/incremental generation  
**Location:** `lib/training/plan-generator.ts`  
**API Endpoints:** 
- `POST /api/training-plan/generate` - Generate phases + Week 1 (returns for review)
- `PUT /api/training-plan/generate` - Confirm and save phases + Week 1
- `POST /api/training-plan/week/generate` - Generate individual weeks (2, 3, 4, etc.) on-demand

---

## Overview

The Training Plan Generator is an AI-powered service that creates training plans using a **progressive/incremental generation model**:

1. **Initial Generation:** Creates phase structure (base, build, peak, taper) with `weekCount` + **Week 1 only**
2. **Confirmation:** Saves phases + Week 1 to database after user review
3. **Progressive Generation:** Generates weeks 2, 3, 4, etc. on-demand as needed

This approach allows for:
- Faster initial generation (only Week 1, not all weeks)
- User review before committing to database
- Adaptive generation based on previous week execution data
- Lower API costs (generate weeks as needed)

The service uses a **cascade structure**: `phases[] → weeks[] → days[]` with structured workouts (warmup/workout/cooldown Lap arrays).

---

## Service Architecture

### Entry Points
**File:** `app/api/training-plan/generate/route.ts`  
- `POST` - Generate phases + Week 1 (returns for review, doesn't save)
- `PUT` - Confirm and save phases + Week 1 to database

**File:** `app/api/training-plan/week/generate/route.ts`  
- `POST` - Generate individual weeks (2, 3, 4, etc.) on-demand

### Core Services
**File:** `lib/training/plan-generator.ts`  
- `generateTrainingPlanAI(inputs: TrainingInputs): Promise<GeneratedPlan>` - Generates phases + Week 1
- `generateWeekAI(inputs: WeeklyGenerationInputs): Promise<GeneratedWeek>` - Generates single week

### Alternative Implementation
**File:** `lib/training/promptEngine.ts`  
- `runTrainingPlanGenerator(trainingPlanId, promptId)` - Database-driven prompt configuration (alternative/experimental path)

### Data Flow

#### Initial Generation (POST /api/training-plan/generate)
```
1. API Route receives trainingPlanId
   ↓
2. Validates draft plan exists, has goal time, start date, and race attached
   ↓
3. Loads athlete's current 5K pace and baseline metrics
   ↓
4. Calculates goalRacePace and predictedRacePace (if not already set)
   ↓
5. Calls generateTrainingPlanAI() with inputs
   ↓
6. OpenAI generates phases (with weekCount) + Week 1 only
   ↓
7. Parses JSON response and validates structure
   ↓
8. Returns plan for user review (does NOT save to database)
```

#### Confirmation (PUT /api/training-plan/generate)
```
1. API Route receives trainingPlanId + generated plan
   ↓
2. Validates plan exists and belongs to athlete
   ↓
3. Prisma transaction:
   - Updates TrainingPlan status to "active"
   - Sets goalRacePace and predictedRacePace
   - Creates TrainingPlanPhase records (with weekCount only)
   - Creates TrainingPlanWeek for Week 1
   - Creates TrainingPlanDay records for Week 1
   - Creates AthleteTrainingPlan junction entry
   - Computes dates, week mileage, phase mileage totals
   ↓
4. Returns trainingPlanId
```

#### Progressive Weekly Generation (POST /api/training-plan/week/generate)
```
1. API Route receives trainingPlanId + weekNumber
   ↓
2. Validates plan is active and previous week exists
   ↓
3. Loads previous week execution data (if available)
   ↓
4. Determines which phase this week belongs to
   ↓
5. Calls generateWeekAI() with context
   ↓
6. OpenAI generates single week (7 days)
   ↓
7. Parses and validates week structure
   ↓
8. Prisma transaction:
   - Creates TrainingPlanWeek record
   - Creates TrainingPlanDay records (7 days)
   - Updates phase totalMiles
   ↓
9. Returns week data
```

---

## Inputs

### TrainingInputs Interface (Initial Generation)
```typescript
export interface TrainingInputs {
  raceName: string;              // e.g., "Boston Marathon"
  raceDistance: string;          // e.g., "marathon", "half", "5k", "10k"
  raceMiles?: number;            // Optional: miles for accurate calculations
  goalTime: string;              // e.g., "3:30:00" (HH:MM:SS format)
  fiveKPace: string;             // e.g., "7:30" (mm:ss format per mile) - current fitness
  predictedRacePace: string;     // e.g., "8:00" (mm:ss) - predicted pace based on 5K fitness
  goalRacePace: string;           // e.g., "7:45" (mm:ss) - goal pace from goal time
  currentWeeklyMileage: number;  // Baseline weekly mileage - start here and build up gradually
  preferredDays: number[];       // Preferred training days (1=Monday, 7=Sunday)
  totalWeeks: number;             // Calculated from race date - plan start date
  planStartDate: Date;           // Actual start date - used to determine day of week patterns
}
```

### WeeklyGenerationInputs Interface (Progressive Generation)
```typescript
export interface WeeklyGenerationInputs {
  trainingPlanId: string;
  weekNumber: number;            // Which week to generate (2, 3, 4, etc.)
  phaseName: string;              // Which phase this week belongs to
  previousWeekMileage?: number;   // Total miles from previous week (for progression)
  previousWeekExecution?: {       // Execution data from previous week (for adaptive training)
    completedDays: number;
    totalMiles: number;
    averagePace?: string;
    notes?: string;
  };
  raceName: string;
  raceDistance: string;
  goalTime: string;
  fiveKPace: string;
  predictedRacePace: string;
  goalRacePace: string;
  currentWeeklyMileage: number;   // Baseline
  preferredDays: number[];
  planStartDate: Date;
}
```

### Where Inputs Come From

| Input | Source | Location |
|-------|--------|----------|
| `raceName` | `Race.name` | Direct relation: `trainingPlan.race.name` |
| `raceDistance` | `Race.raceType` | Direct relation: `trainingPlan.race.raceType` |
| `raceMiles` | `Race.miles` | Direct relation: `trainingPlan.race.miles` |
| `goalTime` | `TrainingPlan.goalTime` | Draft plan field |
| `fiveKPace` | `TrainingPlan.current5KPace` or `Athlete.fiveKPace` | Plan baseline or athlete profile |
| `predictedRacePace` | Calculated from 5K pace | `pace-prediction.ts` |
| `goalRacePace` | Calculated from goal time | `goal-race-pace.ts` |
| `currentWeeklyMileage` | `TrainingPlan.currentWeeklyMileage` | Plan baseline (required) |
| `preferredDays` | `TrainingPlan.preferredDays` | Plan field (defaults to Mon-Sat if not set) |
| `totalWeeks` | `TrainingPlan.totalWeeks` | Calculated when plan created |
| `planStartDate` | `TrainingPlan.startDate` | Plan start date |

---

## The OpenAI Prompt

### System Message
```
You are a professional running coach. Generate complete training plans. Always return valid JSON only.
```

### User Message (Full Prompt)

**Note:** This prompt generates ONLY phases (with weekCount) and Week 1. Future weeks are generated progressively via `/api/training-plan/week/generate`.

```
You are a professional running coach creating a training plan using the GoFast Training Model.

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
- Preferred Training Days: ${inputs.preferredDays} (1=Monday, 7=Sunday)
- Total Weeks: ${inputs.totalWeeks}
- Plan Start Date: ${startDateStr} (${startDayName}, dayNumber ${startDayNumber})

Pace Usage Guidelines:
- Use predictedRacePace for: Sustainable weekly mileage planning, default "easy" run pacing, base phase workouts
- Use goalRacePace for: Late-phase tempo workouts, race-specific pace work, long run pacing in peak phase
- Use 5K pace for: Interval workouts (VO2 max), speed work, high-intensity training

CRITICAL RULES:

A. PHASE ORDER (MANDATORY):
- Phases MUST be generated in this EXACT order: "base", "build", "peak", "taper"
- All four phases must be present
- Order cannot be changed or rearranged

B. START DATE RULE:
- Week 1 MUST align to the actual plan start date
- If the start date lands mid-week, fill the remaining days lightly (rest or short easy runs)
- Week numbering MUST stay global (weekNumber = 1..N)

C. GRADUAL PROGRESSION RULE (CRITICAL):
- Start at current baseline: ${inputs.currentWeeklyMileage} miles/week
- Build up gradually week by week (increase by 5-10% per week)
- Peak mileage should be appropriate for the race distance
- DO NOT jump from baseline to peak immediately

D. DAY BEFORE RACE RULE (CRITICAL):
- The day before the race MUST ALWAYS be rest (all arrays empty) OR 1-2 mile shakeout run
- NEVER assign intensity, intervals, tempo, or long runs the day before the race

E. MILEAGE RULES (CRITICAL):
- Easy days must total 3-5 miles (sum of warmup + workout + cooldown)
- Moderate days must total 4-7 miles
- Long run days must be 6-12 miles in Week 1, scaling gradually each week
- Recovery days must total 2-4 miles
- Rest days must have EMPTY warmup, workout, and cooldown arrays (all three arrays empty)
- A day with ANY workout MUST have mileage (cannot be zero miles)
- Do NOT generate zero-mile run days except pure rest days

F. PREFERRED TRAINING DAY ENFORCEMENT (CRITICAL):
- If the athlete prefers a day: It MUST be a run, unless it's a scheduled rest day by design
- If the athlete does NOT prefer a day: It should default to rest or very light recovery
- Typical pattern: Tuesday (easy/moderate), Wednesday (moderate/tempo), Thursday (intervals/tempo), Saturday (long run), Sunday (recovery), Monday + Friday (rest unless Peak phase)

G. WARMUP / WORKOUT / COOLDOWN GUARANTEES (CRITICAL):
For ANY run day (non-rest):
- warmup MUST have at least 1 lap of 0.5-1.0 miles (paceGoal null)
- workout MUST have at least 1 lap: distanceMiles >= 2.0 for easy/moderate days, interval days may have multiple short laps
- cooldown MUST have at least 1 lap of 0.5-1.0 miles (paceGoal null)
- paceGoal must be "mm:ss" format (e.g., "7:20") or null for easy/recovery
- This prevents empty arrays on run days

H. START-DATE ALIGNMENT RULES:
- Week 1 MUST align to the actual plan start date
- If the start date lands mid-week, fill the remaining days lightly
- Week numbering MUST stay global (weekNumber = 1..N)

I. RACE-WEEK & SHAKEOUT RULES:
- The day BEFORE the race MUST be a rest day (all arrays empty)
- Two days before the race MUST be a 2-4 mile shakeout run
- No hard workouts during race week

J. DAILY MILEAGE CALCULATION RULES:
- totalMiles = sum(warmup.laps.distanceMiles) + sum(workout.laps.distanceMiles) + sum(cooldown.laps.distanceMiles)
- totalMiles must match the intended type of day (easy: 3-5, moderate: 4-7, long: 6-12, recovery: 2-4)
- No negative or zero-mile run days (except pure rest days)

K. STRUCTURED LAP FORMAT:
- Each day MUST have "warmup", "workout", "cooldown" arrays
- Rest days: ALL arrays must be empty []
- Run days: warmup and cooldown must have at least 1 lap each, workout must have at least 1 lap
- Each lap MUST have: lapIndex (number, starts at 1), distanceMiles (number, must be > 0), paceGoal (string | null, format "mm:ss")

L. CRITICAL OUTPUT RULES:
- DO NOT generate calendar dates. We will compute dates ourselves.
- DO NOT generate weeks 2, 3, 4, 5, etc. ONLY generate week 1.
- DO NOT include "weeks" array inside phases. Phases should ONLY have "name" and "weekCount".
- Structure MUST be exactly: { "totalWeeks": number, "phases": [...], "week": {...} }
- Each phase MUST have ONLY "name" and "weekCount" - NO "weeks" property
- Week 1 MUST have "weekNumber": 1 and exactly 7 days

VALIDATION REQUIREMENTS:
- Week 1 MAY have fewer than 7 days if plan starts mid-week (partial first week)
- Weeks 2+ MUST have exactly 7 days
- Each day MUST include warmup/workout/cooldown arrays
- A run day cannot have empty arrays (must have at least 1 lap in warmup, workout, and cooldown)
- Rest days must have ALL arrays empty
- lapIndex MUST be sequential (1, 2, 3...) within each array - NOT all the same number!
- distanceMiles must be > 0 for any lap
- paceGoal must be "mm:ss" format (e.g., "7:20") or null
- Daily mileage must match day type (easy: 3-5, moderate: 4-7, long: 6-12, recovery: 2-4)

Expected JSON structure:
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
      { "dayNumber": 1, "warmup": [...], "workout": [...], "cooldown": [...] },
      ... (7 days total, each with proper mileage)
    ]
  }
}

Return ONLY the JSON object, nothing else.
```

---

## OpenAI API Configuration

### Model
- **Model:** `gpt-4o-mini` (not gpt-4, not gpt-3.5)
- **Temperature:** `0.7` (moderate creativity)
- **Max Tokens:** `2000` (reduced since we only generate phases + week 1)
- **Response Format:** `{ type: 'json_object' }` (ensures valid JSON output)

### API Call
```typescript
const openai = getOpenAIClient(); // Initializes OpenAI with OPENAI_API_KEY

const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    {
      role: 'system',
      content: 'You are a professional running coach. Generate complete training plans. Always return valid JSON only.',
    },
    {
      role: 'user',
      content: prompt, // Full prompt string (see above)
    },
  ],
  temperature: 0.7,
  max_tokens: 4000,
});
```

### Response Parsing & Validation
```typescript
const content = response.choices[0]?.message?.content;
// Clean JSON response (remove markdown code blocks if present)
const cleaned = content.replace(/```json|```/g, '').trim();
const parsed = JSON.parse(cleaned) as GeneratedPlan;

// Validate structure
if (!parsed.phases || !Array.isArray(parsed.phases)) {
  throw new Error('Invalid plan structure: missing phases array');
}

// Validate phase structure
for (const phase of parsed.phases) {
  if (!phase.name || !phase.weeks || !Array.isArray(phase.weeks)) {
    throw new Error(`Invalid phase structure: ${JSON.stringify(phase)}`);
  }
  for (const week of phase.weeks) {
    if (!week.weekNumber || !week.days || !Array.isArray(week.days)) {
      throw new Error(`Invalid week structure: ${JSON.stringify(week)}`);
    }
    if (week.days.length !== 7) {
      throw new Error(`Week ${week.weekNumber} must have exactly 7 days, got ${week.days.length}`);
    }
    for (const day of week.days) {
      if (!day.dayNumber || !day.warmup || !day.workout || !day.cooldown) {
        throw new Error(`Invalid day structure: ${JSON.stringify(day)}`);
      }
    }
  }
}
```

---

## Output Structure

### GeneratedPlan Interface (Initial Generation - Phases + Week 1 Only)

```typescript
export interface GeneratedPlan {
  totalWeeks: number;
  phases: TrainingPlanPhase[]; // Phases with weekCount only (NO weeks array)
  week: TrainingPlanWeek;       // Week 1 only
}

export interface TrainingPlanPhase {
  name: string;              // "base" | "build" | "peak" | "taper"
  weekCount: number;          // How many weeks in this phase
  totalMiles?: number;        // Optional - computed later (not in initial generation)
  weeks?: TrainingPlanWeek[];  // NOT included in initial generation - only weekCount
}

export interface TrainingPlanWeek {
  weekNumber: number;         // Global week 1-N (within entire plan)
  days: TrainingPlanDay[];    // Exactly 7 days (or partial for Week 1 if starts mid-week)
}

export interface TrainingPlanDay {
  dayNumber: number;           // 1-7 (1=Monday, 7=Sunday)
  warmup: TrainingPlanLap[];  // Lap array
  workout: TrainingPlanLap[]; // Lap array
  cooldown: TrainingPlanLap[]; // Lap array
  notes?: string;
}

export interface TrainingPlanLap {
  lapIndex: number;           // Sequential within warmup/workout/cooldown (starts at 1, must increment)
  distanceMiles: number;       // 0.25, 1.0, etc (must be > 0)
  paceGoal: string | null;     // "7:20" (mm:ss format) or null for easy/recovery
  hrGoal?: string | null;      // "Z2", "Z3", "Z4", "Z5" or null (optional)
}
```

### GeneratedWeek Interface (Progressive Generation)

```typescript
export interface GeneratedWeek {
  weekNumber: number;
  days: TrainingPlanDay[];    // Exactly 7 days
}
```

**Note:** Week 1 may be partial if the plan starts mid-week. The number of days in Week 1 depends on the start day:
- Monday start = 7 days
- Friday start = 3 days (Fri, Sat, Sun)
- Sunday start = 1 day (Sun only)

### Example Output (Initial Generation)

```json
{
  "totalWeeks": 16,
  "phases": [
    {
      "name": "base",
      "weekCount": 4
    },
    {
      "name": "build",
      "weekCount": 6
    },
    {
      "name": "peak",
      "weekCount": 3
    },
    {
      "name": "taper",
      "weekCount": 3
    }
  ],
  "week": {
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
      },
      {
        "dayNumber": 2,
        "warmup": [],
        "workout": [],
        "cooldown": [],
        "notes": "Rest day"
      }
      // ... remaining days (may be partial week if starts mid-week)
    ]
  }
}
```

**Key Points:**
- Phases contain **only** `name` and `weekCount` - NO `weeks` array
- Only Week 1 is included in the response
- Week 1 may have fewer than 7 days if plan starts mid-week
- Subsequent weeks are generated via `/api/training-plan/week/generate`

### Key Differences from Old Structure

| Old Structure | New Structure |
|--------------|---------------|
| `weeks[]` (flat array) | `phases[] → weeks[]` (nested) |
| `weekIndex` (per-week index) | `weekNumber` (global 1-N) |
| `dayIndex` (1-7) | `dayNumber` (1-7) |
| `plannedData` (JSON blob) | `warmup[]`, `workout[]`, `cooldown[]` (structured Lap arrays) |
| `phase` (string on week) | `name` (string on phase object) |
| No phase objects | `TrainingPlanPhase` with `weekCount`, `totalMiles` |

---

## How Data Is Saved

### Initial Save (PUT /api/training-plan/generate)

All database operations happen in a **single atomic transaction**:

```typescript
const result = await prisma.$transaction(async (tx) => {
  // 1. Update TrainingPlan status to "active"
  const updatedPlan = await tx.trainingPlan.update({
    where: { id: trainingPlanId },
    data: {
      status: 'active',
      goalRacePace: goalRacePaceSec,
      predictedRacePace: predictedRacePaceSec,
    },
  });

  // 2. Create phases (with weekCount only, no weeks array)
  const phaseMap = new Map<string, string>(); // phase name -> phase id
  for (const phaseData of generatedPlan.phases) {
    const phase = await tx.trainingPlanPhase.create({
      data: {
        planId: trainingPlanId,
        name: phaseData.name,
        weekCount: phaseData.weekCount,
        totalMiles: null, // Will be computed later as weeks are generated
      },
    });
    phaseMap.set(phaseData.name, phase.id);
  }

  // 3. Determine which phase Week 1 belongs to
  let currentWeek = 1;
  let week1PhaseId: string | null = null;
  for (const phaseData of generatedPlan.phases) {
    if (currentWeek <= phaseData.weekCount) {
      week1PhaseId = phaseMap.get(phaseData.name)!;
      break;
    }
    currentWeek += phaseData.weekCount;
  }

  // 4. Create Week 1 only
  const week1Data = generatedPlan.week;
  let week1Miles = 0;
  for (const dayData of week1Data.days) {
    const warmupMiles = dayData.warmup.reduce((sum, lap) => sum + lap.distanceMiles, 0);
    const workoutMiles = dayData.workout.reduce((sum, lap) => sum + lap.distanceMiles, 0);
    const cooldownMiles = dayData.cooldown.reduce((sum, lap) => sum + lap.distanceMiles, 0);
    week1Miles += warmupMiles + workoutMiles + cooldownMiles;
  }

  const week1 = await tx.trainingPlanWeek.create({
    data: {
      planId: trainingPlanId,
      phaseId: week1PhaseId,
      weekNumber: 1,
      miles: week1Miles > 0 ? week1Miles : null,
    },
  });

  // 5. Create days for Week 1 (may be partial week)
  for (const dayData of week1Data.days) {
    const computedDate = calculateTrainingDayDateFromWeek(
      planStartDate,
      1,
      dayData.dayNumber,
      true // allowPartialFirstWeek
    );
    
    const dayOfWeek = getDayOfWeek(computedDate);

    await tx.trainingPlanDay.create({
      data: {
        planId: trainingPlanId,
        phaseId: week1PhaseId,
        weekId: week1.id,
        date: computedDate,
        dayOfWeek: dayOfWeek,
        warmup: dayData.warmup as any,
        workout: dayData.workout as any,
        cooldown: dayData.cooldown as any,
        notes: dayData.notes || null,
      },
    });
  }

  // 6. Update phase totalMiles for Week 1's phase
  if (week1Miles > 0) {
    await tx.trainingPlanPhase.update({
      where: { id: week1PhaseId },
      data: { totalMiles: week1Miles },
    });
  }

  // 7. Ensure AthleteTrainingPlan junction entry exists
  const existingJunction = await tx.athleteTrainingPlan.findUnique({
    where: {
      athleteId_trainingPlanId: {
        athleteId,
        trainingPlanId: trainingPlanId,
      },
    },
  });

  if (!existingJunction) {
    await tx.athleteTrainingPlan.create({
      data: {
        athleteId,
        trainingPlanId: trainingPlanId,
        assignedAt: new Date(),
      },
    });
  }

  return updatedPlan.id;
});
```

### Progressive Weekly Save (POST /api/training-plan/week/generate)

```typescript
const result = await prisma.$transaction(async (tx) => {
  // 1. Determine which phase this week belongs to
  let currentWeek = 1;
  let targetPhaseId: string | null = null;
  for (const phase of plan.phases) {
    if (weekNumber <= currentWeek + phase.weekCount - 1) {
      targetPhaseId = phase.id;
      break;
    }
    currentWeek += phase.weekCount;
  }

  // 2. Calculate week mileage
  let weekMiles = 0;
  for (const dayData of generatedWeek.days) {
    const warmupMiles = dayData.warmup.reduce((sum, lap) => sum + lap.distanceMiles, 0);
    const workoutMiles = dayData.workout.reduce((sum, lap) => sum + lap.distanceMiles, 0);
    const cooldownMiles = dayData.cooldown.reduce((sum, lap) => sum + lap.distanceMiles, 0);
    weekMiles += warmupMiles + workoutMiles + cooldownMiles;
  }

  // 3. Create week
  const week = await tx.trainingPlanWeek.create({
    data: {
      planId: trainingPlanId,
      phaseId: targetPhaseId,
      weekNumber: weekNumber,
      miles: weekMiles > 0 ? weekMiles : null,
    },
  });

  // 4. Create days (always 7 days for weeks 2+)
  for (const dayData of generatedWeek.days) {
    const computedDate = calculateTrainingDayDateFromWeek(
      planStartDate,
      weekNumber,
      dayData.dayNumber,
      false // no partial weeks after Week 1
    );
    
    const dayOfWeek = getDayOfWeek(computedDate);

    await tx.trainingPlanDay.create({
      data: {
        planId: trainingPlanId,
        phaseId: targetPhaseId,
        weekId: week.id,
        date: computedDate,
        dayOfWeek: dayOfWeek,
        warmup: dayData.warmup as any,
        workout: dayData.workout as any,
        cooldown: dayData.cooldown as any,
        notes: dayData.notes || null,
      },
    });
  }

  // 5. Update phase totalMiles
  const phase = await tx.trainingPlanPhase.findUnique({
    where: { id: targetPhaseId },
    include: { weeks: true },
  });

  if (phase) {
    const totalMiles = phase.weeks.reduce((sum, week) => sum + (week.miles || 0), 0);
    await tx.trainingPlanPhase.update({
      where: { id: targetPhaseId },
      data: { totalMiles: totalMiles },
    });
  }

  return week.id;
});
```

### Date Calculation

**Function:** `calculateTrainingDayDateFromWeek(planStartDate, weekNumber, dayNumber, allowPartialFirstWeek)`

**Formula:**
- For Week 1 with partial weeks: Uses actual start date and dayNumber mapping
- For Week 2+: `((weekNumber - 1) * 7) + (dayNumber - 1)` days from planStartDate

**Examples:**
- Week 1 starting Monday, Day 1 (Monday) = `planStartDate + 0 days`
- Week 1 starting Monday, Day 2 (Tuesday) = `planStartDate + 1 day`
- Week 1 starting Friday, Day 5 (Friday) = `planStartDate + 0 days` (first day of partial week)
- Week 2, Day 1 (Monday) = `planStartDate + 7 days`
- Week 2, Day 2 (Tuesday) = `planStartDate + 8 days`

### Mileage Calculation

**Week Miles:**
- Sum of all `distanceMiles` from `warmup[]`, `workout[]`, `cooldown[]` arrays across all 7 days

**Phase Miles:**
- Sum of all `week.miles` for all weeks in that phase

### Database Records Created

#### Initial Save (PUT /api/training-plan/generate)
1. **TrainingPlan** (updated)
   - `status`: `"draft"` → `"active"`
   - `goalRacePace`: Calculated from goal time
   - `predictedRacePace`: Calculated from 5K pace

2. **TrainingPlanPhase** (created - 4 phases)
   - `planId`: FK to TrainingPlan
   - `name`: "base" | "build" | "peak" | "taper"
   - `weekCount`: Number of weeks in phase
   - `totalMiles`: Initially set to Week 1 mileage (updated as more weeks are generated)

3. **TrainingPlanWeek** (created - Week 1 only)
   - `planId`: FK to TrainingPlan
   - `phaseId`: FK to TrainingPlanPhase
   - `weekNumber`: 1
   - `miles`: Computed sum of day miles

4. **TrainingPlanDay** (created - Week 1 days only, may be partial)
   - `planId`: FK to TrainingPlan
   - `phaseId`: FK to TrainingPlanPhase
   - `weekId`: FK to TrainingPlanWeek
   - `date`: Computed actual calendar date
   - `dayOfWeek`: Day name (Monday, Tuesday, etc.)
   - `dayNumber`: 1-7 (Monday-Sunday)
   - `warmup`: JSON array of Lap objects
   - `workout`: JSON array of Lap objects
   - `cooldown`: JSON array of Lap objects
   - `notes`: Optional string

5. **AthleteTrainingPlan** (created if doesn't exist)
   - Links athlete to training plan
   - `assignedAt`: Current timestamp

**Initial Records:** **4 phases + 1 week + ~7 days = ~12 records** (much smaller than generating all weeks)

#### Progressive Weekly Save (POST /api/training-plan/week/generate)
- **TrainingPlanWeek** (created - one per call)
- **TrainingPlanDay** (created - 7 days per week)
- **TrainingPlanPhase** (updated - `totalMiles` recalculated)

**Total Records (after all weeks generated):** For a 16-week plan = **4 phases + 16 weeks + 112 days = 132 records**

---

## Key Design Decisions

### ✅ What Works Well

1. **Progressive Generation:** Faster initial load (only Week 1), lower API costs, user review before commit
2. **Cascade Structure:** Clear hierarchy (phases → weeks → days) matches mental model
3. **Structured Workouts:** Warmup/workout/cooldown Lap arrays are explicit and queryable
4. **Atomic Transactions:** All database operations succeed or fail together
5. **Date Computation:** Backend calculates dates, not AI (more reliable)
6. **Partial First Week:** Handles plans starting mid-week gracefully
7. **Validation:** Structure validation ensures AI output matches expected format
8. **Mileage Totals:** Computed automatically from Lap arrays
9. **Phase Distribution:** Clear rules for base/build/peak/taper allocation
10. **Adaptive Generation:** Can use previous week execution data for future weeks
11. **Preferred Days:** Respects athlete's training day preferences

### ⚠️ Current Limitations

1. **No Error Recovery:** If OpenAI fails, entire transaction fails
2. **No Regeneration:** Can't regenerate a single week (would need to delete and recreate)
3. **No Lap Validation:** Doesn't validate Lap structure (lapIndex sequence, distanceMiles > 0, paceGoal format)
4. **Fixed Model:** Hardcoded to `gpt-4o-mini` (no model selection)
5. **No Retry Logic:** Single API call, no retries on failure
6. **No Streaming:** Waits for complete response
7. **No Caching:** Always calls OpenAI, even for similar inputs
8. **No Versioning:** Can't regenerate plan and keep old version
9. **Sequential Week Generation:** Weeks must be generated in order (can't skip to week 5 without 2-4)
10. **No Batch Generation:** Can't generate multiple weeks at once

### 🔄 Refactoring Considerations

#### Potential Improvements

1. **Enhanced Progressive Generation** ✅ (Partially Implemented)
   - ✅ Generate Week 1 initially
   - ✅ Generate weeks 2+ on-demand
   - ⚠️ Allow regeneration of specific weeks (currently not supported)
   - ⚠️ Support batch generation (multiple weeks at once)
   - ⚠️ Support plan updates mid-cycle

2. **Validation Layer**
   - Validate Lap structure (lapIndex sequence, distanceMiles > 0, paceGoal format)
   - Check phase distribution matches rules
   - Verify all weeks have 7 days
   - Validate weekNumber sequence (no gaps, no duplicates)

3. **Error Handling**
   - Retry logic with exponential backoff
   - Partial save on partial failure
   - Better error messages for users

4. **Model Selection**
   - Allow different models for different plan lengths
   - Fallback to cheaper model if primary fails
   - A/B testing different models

5. **Streaming Response**
   - Stream phases as they're generated
   - Show progress to user
   - Save incrementally

6. **Caching**
   - Cache similar plans (same race + goal time + weeks)
   - Template-based generation for common scenarios
   - Reduce API costs

7. **Versioning**
   - Keep old plan versions when regenerating
   - Allow comparison between versions
   - Support "revert to previous plan"

8. **Prompt Engineering**
   - More detailed phase instructions
   - Race-specific guidance (marathon vs 5K)
   - Athlete experience level consideration
   - Injury prevention guidelines
   - Better Lap structure examples

9. **Post-Processing**
   - Validate mileage progression
   - Check rest day distribution
   - Ensure phase transitions are smooth
   - Add recovery weeks automatically
   - Validate paceGoal consistency

10. **Testing**
    - Unit tests for date calculation
    - Mock OpenAI responses for testing
    - Integration tests for full flow
    - Load testing for concurrent generations
    - Validation tests for cascade structure

---

## Environment Variables

### Required
```bash
OPENAI_API_KEY=sk-...  # OpenAI API key for GPT-4o-mini
```

### Where It's Used
- `lib/training/plan-generator.ts` - `getOpenAIClient()` function

---

## Error Handling

### Current Error Cases

1. **Missing API Key**
   ```typescript
   throw new Error('OPENAI_API_KEY environment variable is required');
   ```

2. **No OpenAI Response**
   ```typescript
   if (!content) {
     throw new Error('No response from OpenAI');
   }
   ```

3. **JSON Parse Failure**
   ```typescript
   catch (error) {
     console.error('Error generating training plan:', error);
     throw new Error('Failed to generate training plan');
   }
   ```

4. **Structure Validation Failure**
   ```typescript
   if (!parsed.phases || !Array.isArray(parsed.phases)) {
     throw new Error('Invalid plan structure: missing phases array');
   }
   // ... additional validation errors
   ```

5. **Database Transaction Failure**
   - Entire transaction rolls back
   - No partial data saved
   - Error returned to API route

### API Route Error Responses

- **400 Bad Request:** Missing required fields, invalid plan state, validation failure
- **401 Unauthorized:** Authentication failure
- **403 Forbidden:** Plan doesn't belong to athlete
- **404 Not Found:** Plan or athlete not found
- **500 Internal Server Error:** OpenAI failure, database error

---

## Performance Considerations

### Current Performance

#### Initial Generation (POST /api/training-plan/generate)
- **API Call Time:** ~3-8 seconds (only Week 1, not all weeks)
- **Response Time:** ~3-8 seconds (no database write)
- **User Review:** User can review before committing

#### Confirmation (PUT /api/training-plan/generate)
- **Database Write Time:** ~0.5-1 second (~12 records: 4 phases + 1 week + ~7 days)
- **Total Time:** ~0.5-1 second

#### Progressive Weekly Generation (POST /api/training-plan/week/generate)
- **API Call Time:** ~2-5 seconds per week (single week generation)
- **Database Write Time:** ~0.2-0.5 seconds per week (1 week + 7 days)
- **Total Time:** ~2.2-5.5 seconds per week

**Total Time for 16-week plan:**
- Initial: ~3-8 seconds
- Confirmation: ~0.5-1 second
- Weeks 2-16: ~33-82 seconds (15 weeks × ~2.2-5.5 seconds)
- **Grand Total:** ~37-91 seconds (but spread over time as weeks are needed)

### Bottlenecks

1. **OpenAI API:** Slowest part (network + processing)
2. **Sequential Week Generation:** Weeks must be generated one at a time
3. **Database Writes:** Multiple sequential creates (though much smaller per operation)

### Optimization Opportunities

1. **Batch Week Generation:** Generate multiple weeks in parallel
2. **Async Processing:** Queue week generation, notify when complete
3. **Database Optimization:** Use bulk inserts for multiple weeks
4. **Caching:** Cache similar week patterns
5. **Prefetching:** Generate next week before athlete reaches it
6. **Template-Based Generation:** Use templates for common week patterns

---

## Testing Strategy

### Unit Tests Needed

```typescript
// Test date calculation
describe('calculateTrainingDayDate', () => {
  it('calculates correct date for week 1, day 1', () => {
    const startDate = new Date('2025-01-01');
    const date = calculateTrainingDayDate(startDate, 1, 1);
    expect(date).toEqual(new Date('2025-01-01'));
  });
  
  it('calculates correct date for week 2, day 1', () => {
    const startDate = new Date('2025-01-01');
    const date = calculateTrainingDayDate(startDate, 2, 1);
    expect(date).toEqual(new Date('2025-01-08'));
  });
});

// Test cascade structure validation
describe('generateTrainingPlanAI', () => {
  it('validates phases array exists', () => {
    // Mock invalid response (no phases)
  });
  
  it('validates each week has 7 days', () => {
    // Mock response with week having 6 days
  });
  
  it('validates day structure (warmup/workout/cooldown)', () => {
    // Mock response with missing warmup array
  });
});
```

### Integration Tests Needed

```typescript
// Test initial generation flow
describe('POST /api/training-plan/generate', () => {
  it('generates phases + Week 1 only (does not save)', async () => {
    // Create draft plan
    // Call generate endpoint
    // Verify response contains phases (with weekCount only) + Week 1
    // Verify NO database records created (returns for review)
  });
  
  it('validates partial first week when starting mid-week', async () => {
    // Create plan starting on Friday
    // Call generate endpoint
    // Verify Week 1 has only 3 days (Fri, Sat, Sun)
  });
});

// Test confirmation flow
describe('PUT /api/training-plan/generate', () => {
  it('saves phases + Week 1 to database', async () => {
    // Generate plan (POST)
    // Confirm plan (PUT)
    // Verify 4 TrainingPlanPhase records created
    // Verify 1 TrainingPlanWeek record created (Week 1)
    // Verify TrainingPlanDay records created for Week 1
    // Verify plan status updated to "active"
  });
  
  it('rolls back on database failure', async () => {
    // Generate plan (POST)
    // Mock database failure during confirmation
    // Verify no partial data saved
  });
  
  it('computes week and phase mileage totals', async () => {
    // Generate and confirm plan
    // Verify week.miles is sum of day miles
    // Verify phase.totalMiles is sum of week miles (only Week 1 so far)
  });
});

// Test progressive weekly generation
describe('POST /api/training-plan/week/generate', () => {
  it('generates Week 2 after Week 1 exists', async () => {
    // Create active plan with Week 1
    // Call week generate endpoint for weekNumber=2
    // Verify 1 TrainingPlanWeek record created (Week 2)
    // Verify 7 TrainingPlanDay records created
    // Verify phase totalMiles updated
  });
  
  it('requires previous week to exist', async () => {
    // Create active plan with Week 1
    // Try to generate Week 3 without Week 2
    // Verify error: previous week must exist
  });
  
  it('uses previous week execution data for adaptive generation', async () => {
    // Create active plan with Week 1
    // Create execution data for Week 1
    // Generate Week 2
    // Verify prompt includes previous week execution context
  });
});
```

---

## Progressive Generation Workflow

### Complete User Flow

```
1. User creates draft TrainingPlan
   ↓
2. User sets goal time, start date, attaches race
   ↓
3. User clicks "Generate Plan"
   ↓
4. POST /api/training-plan/generate
   - Validates plan state
   - Calculates paces
   - Calls OpenAI (generates phases + Week 1)
   - Returns plan for review (doesn't save)
   ↓
5. User reviews phases and Week 1
   ↓
6. User clicks "Confirm Plan"
   ↓
7. PUT /api/training-plan/generate
   - Saves phases + Week 1 to database
   - Marks plan as "active"
   ↓
8. Plan is now active with Week 1
   ↓
9. As athlete progresses, weeks 2+ are generated on-demand:
   - POST /api/training-plan/week/generate?weekNumber=2
   - POST /api/training-plan/week/generate?weekNumber=3
   - etc.
   ↓
10. Each week generation:
    - Validates previous week exists
    - Loads previous week execution data (if available)
    - Calls OpenAI (generates single week)
    - Saves week + days to database
```

### Benefits of Progressive Model

1. **Faster Initial Load:** Only Week 1 generated initially (~3-8s vs ~7-18s for all weeks)
2. **User Review:** User can review before committing to database
3. **Lower API Costs:** Only generate weeks as needed
4. **Adaptive:** Can use previous week execution data for better future weeks
5. **Flexible:** Can adjust generation strategy based on athlete progress

---

**Last Updated:** 2025-01-XX  
**Status:** Production (MVP1) - Progressive/Incremental Generation Model  
**Next Review:** After progressive generation testing
