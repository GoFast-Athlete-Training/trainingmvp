# Training Plan Generator Service

**Purpose:** Generate complete, personalized training plans using OpenAI GPT-4o-mini  
**Location:** `lib/training/plan-generator.ts`  
**API Endpoint:** `POST /api/training-plan/generate`

---

## Overview

The Training Plan Generator is an AI-powered service that creates complete, week-by-week training plans based on:
- Race information (name, distance)
- Goal time
- Athlete's current 5K pace
- Total weeks until race

The service generates **all phases, weeks, and days immediately** (not incrementally), then saves them to the database in a single atomic transaction using the new **cascade structure**: `phases[] → weeks[] → days[]`.

---

## Service Architecture

### Entry Point
**File:** `app/api/training-plan/generate/route.ts`  
**Function:** `POST(request: NextRequest)`

### Core Service
**File:** `lib/training/plan-generator.ts`  
**Function:** `generateTrainingPlanAI(inputs: TrainingInputs): Promise<GeneratedPlan>`

### Data Flow

```
1. API Route receives trainingPlanId
   ↓
2. Validates draft plan exists, has goal time, start date, and race attached
   ↓
3. Loads athlete's current 5K pace
   ↓
4. Calculates goalPace5K (if not already set)
   ↓
5. Calls generateTrainingPlanAI() with inputs
   ↓
6. OpenAI generates complete plan (all phases, all weeks, all days)
   ↓
7. Parses JSON response and validates cascade structure
   ↓
8. Prisma transaction:
   - Updates TrainingPlan status to "active"
   - Sets goalPace5K
   - Creates AthleteTrainingPlan junction entry
   - Creates cascade: TrainingPlanPhase → TrainingPlanWeek → TrainingPlanDay
   - Computes dates, week mileage, phase mileage totals
   ↓
9. Returns trainingPlanId
```

---

## Inputs

### TrainingInputs Interface
```typescript
export interface TrainingInputs {
  raceName: string;        // e.g., "Boston Marathon"
  raceDistance: string;    // e.g., "marathon", "half", "5k", "10k"
  goalTime: string;        // e.g., "3:30:00" (HH:MM:SS format)
  fiveKPace: string;       // e.g., "7:30" (mm:ss format per mile)
  totalWeeks: number;      // Calculated from race date - plan start date
}
```

### Where Inputs Come From

| Input | Source | Location |
|-------|--------|----------|
| `raceName` | `Race.name` | Junction table: `raceTrainingPlans[0].race.name` |
| `raceDistance` | `Race.distance` | Junction table: `raceTrainingPlans[0].race.distance` |
| `goalTime` | `TrainingPlan.goalTime` | Draft plan field |
| `fiveKPace` | `Athlete.fiveKPace` | Athlete profile (current fitness) |
| `totalWeeks` | `TrainingPlan.totalWeeks` | Calculated when plan created |

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
- Each week MUST have exactly 7 days
- Each day MUST include warmup/workout/cooldown arrays
- A run day cannot have empty arrays (must have at least 1 lap in warmup, workout, and cooldown)
- Rest days must have ALL arrays empty
- lapIndex starts at 1 within each array
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

### GeneratedPlan Interface (NEW CASCADE STRUCTURE)

```typescript
export interface GeneratedPlan {
  totalWeeks: number;
  phases: TrainingPlanPhase[]; // phases[] → weeks[] → days[]
}

export interface TrainingPlanPhase {
  name: string;              // "base" | "build" | "peak" | "taper"
  weekCount: number;          // How many weeks in this phase
  totalMiles?: number;        // Optional - computed later
  weeks: TrainingPlanWeek[];  // Weeks belonging to this phase
}

export interface TrainingPlanWeek {
  weekNumber: number;         // Global week 1-N (within entire plan)
  days: TrainingPlanDay[];    // Exactly 7 days
}

export interface TrainingPlanDay {
  dayNumber: number;           // 1-7 (1=Monday, 7=Sunday)
  warmup: TrainingPlanLap[];  // Lap array
  workout: TrainingPlanLap[]; // Lap array
  cooldown: TrainingPlanLap[]; // Lap array
  notes?: string;
}

export interface TrainingPlanLap {
  lapIndex: number;           // Local within warmup/workout/cooldown (starts at 1)
  distanceMiles: number;      // 0.25, 1.0, etc
  paceGoal: string | null;   // "7:20" or null for easy/recovery
}
```

### Example Output

```json
{
  "totalWeeks": 16,
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
            },
            {
              "dayNumber": 2,
              "warmup": [],
              "workout": [],
              "cooldown": [],
              "notes": "Rest day"
            },
            // ... 5 more days (total 7 days per week)
          ]
        },
        {
          "weekNumber": 2,
          "days": [
            // ... 7 days
          ]
        },
        // ... 2 more weeks (total 4 weeks in base phase)
      ]
    },
    {
      "name": "build",
      "weekCount": 6,
      "weeks": [
        {
          "weekNumber": 5,
          "days": [
            // ... 7 days
          ]
        },
        // ... 5 more weeks
      ]
    },
    {
      "name": "peak",
      "weekCount": 3,
      "weeks": [
        // ... 3 weeks
      ]
    },
    {
      "name": "taper",
      "weekCount": 3,
      "weeks": [
        // ... 3 weeks
      ]
    }
  ]
}
```

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

### Prisma Transaction Flow

All database operations happen in a **single atomic transaction** to ensure data consistency:

```typescript
const result = await prisma.$transaction(async (tx) => {
  // 1. Update TrainingPlan status to "active"
  const updatedPlan = await tx.trainingPlan.update({
    where: { id: trainingPlanId },
    data: {
      status: 'active',
      goalPace5K: goalPace5K, // Calculated from goal time + race distance
    },
  });

  // 2. Create AthleteTrainingPlan junction entry
  await tx.athleteTrainingPlan.create({
    data: {
      athleteId,
      trainingPlanId: trainingPlanId,
      assignedAt: new Date(),
    },
  });

  // 3. Create cascade: phases → weeks → days
  for (const phaseData of plan.phases) {
    // Create phase
    const phase = await tx.trainingPlanPhase.create({
      data: {
        planId: trainingPlanId,
        name: phaseData.name,
        weekCount: phaseData.weekCount,
        totalMiles: phaseData.totalMiles || null,
      },
    });

    // Create weeks for this phase
    for (const weekData of phaseData.weeks) {
      // Calculate total miles for the week from all days
      let weekMiles = 0;
      for (const dayData of weekData.days) {
        const warmupMiles = dayData.warmup.reduce((sum, lap) => sum + lap.distanceMiles, 0);
        const workoutMiles = dayData.workout.reduce((sum, lap) => sum + lap.distanceMiles, 0);
        const cooldownMiles = dayData.cooldown.reduce((sum, lap) => sum + lap.distanceMiles, 0);
        weekMiles += warmupMiles + workoutMiles + cooldownMiles;
      }

      const week = await tx.trainingPlanWeek.create({
        data: {
          planId: trainingPlanId,
          phaseId: phase.id,
          weekNumber: weekData.weekNumber,
          miles: weekMiles > 0 ? weekMiles : null,
        },
      });

      // Create days for this week
      for (const dayData of weekData.days) {
        // Compute date: ((weekNumber - 1) * 7) + (dayNumber - 1) days from planStartDate
        const daysToAdd = ((weekData.weekNumber - 1) * 7) + (dayData.dayNumber - 1);
        const computedDate = new Date(planStartDate);
        computedDate.setDate(computedDate.getDate() + daysToAdd);

        await tx.trainingPlanDay.create({
          data: {
            planId: trainingPlanId,
            phaseId: phase.id,
            weekId: week.id,
            date: computedDate,
            dayNumber: dayData.dayNumber,
            warmup: dayData.warmup as any,      // JSON array
            workout: dayData.workout as any,    // JSON array
            cooldown: dayData.cooldown as any,  // JSON array
            notes: dayData.notes || null,
          },
        });
      }
    }
  }

  // 4. Compute phase totalMiles (sum of all week miles in phase)
  const phases = await tx.trainingPlanPhase.findMany({
    where: { planId: trainingPlanId },
    include: { weeks: true },
  });

  for (const phase of phases) {
    const totalMiles = phase.weeks.reduce((sum, week) => sum + (week.miles || 0), 0);
    if (totalMiles > 0) {
      await tx.trainingPlanPhase.update({
        where: { id: phase.id },
        data: { totalMiles: totalMiles },
      });
    }
  }

  return updatedPlan.id;
});
```

### Date Calculation

**Formula:**
```typescript
const daysToAdd = ((weekNumber - 1) * 7) + (dayNumber - 1);
const computedDate = new Date(planStartDate);
computedDate.setDate(computedDate.getDate() + daysToAdd);
```

**Examples:**
- Week 1, Day 1 (Monday) = `planStartDate + 0 days`
- Week 1, Day 2 (Tuesday) = `planStartDate + 1 day`
- Week 2, Day 1 (Monday) = `planStartDate + 7 days`
- Week 2, Day 2 (Tuesday) = `planStartDate + 8 days`

### Mileage Calculation

**Week Miles:**
- Sum of all `distanceMiles` from `warmup[]`, `workout[]`, `cooldown[]` arrays across all 7 days

**Phase Miles:**
- Sum of all `week.miles` for all weeks in that phase

### Database Records Created

1. **TrainingPlan** (updated)
   - `status`: `"draft"` → `"active"`
   - `goalPace5K`: Set if not already calculated

2. **AthleteTrainingPlan** (created)
   - Links athlete to training plan
   - `assignedAt`: Current timestamp

3. **TrainingPlanPhase** (created - one per phase)
   - `planId`: FK to TrainingPlan
   - `name`: "base" | "build" | "peak" | "taper"
   - `weekCount`: Number of weeks in phase
   - `totalMiles`: Computed sum of week miles

4. **TrainingPlanWeek** (created - one per week)
   - `planId`: FK to TrainingPlan
   - `phaseId`: FK to TrainingPlanPhase
   - `weekNumber`: Global week number (1-N)
   - `miles`: Computed sum of day miles

5. **TrainingPlanDay** (created - one per day)
   - `planId`: FK to TrainingPlan
   - `phaseId`: FK to TrainingPlanPhase
   - `weekId`: FK to TrainingPlanWeek
   - `date`: Computed actual calendar date
   - `dayNumber`: 1-7 (Monday-Sunday)
   - `warmup`: JSON array of Lap objects
   - `workout`: JSON array of Lap objects
   - `cooldown`: JSON array of Lap objects
   - `notes`: Optional string

**Total Records:** For a 16-week plan = **4 phases + 16 weeks + 112 days = 132 records**

---

## Key Design Decisions

### ✅ What Works Well

1. **Cascade Structure:** Clear hierarchy (phases → weeks → days) matches mental model
2. **Structured Workouts:** Warmup/workout/cooldown Lap arrays are explicit and queryable
3. **Atomic Transaction:** All database operations succeed or fail together
4. **Date Computation:** Backend calculates dates, not AI (more reliable)
5. **Complete Generation:** All phases/weeks/days generated at once (no incremental loading)
6. **Validation:** Structure validation ensures AI output matches expected format
7. **Mileage Totals:** Computed automatically from Lap arrays
8. **Phase Distribution:** Clear rules for base/build/peak/taper allocation

### ⚠️ Current Limitations

1. **No Error Recovery:** If OpenAI fails, entire transaction fails
2. **No Partial Plans:** Can't generate "just week 1" or regenerate a single week
3. **No Lap Validation:** Doesn't validate Lap structure (lapIndex, distanceMiles, paceGoal)
4. **Fixed Model:** Hardcoded to `gpt-4o-mini` (no model selection)
5. **No Retry Logic:** Single API call, no retries on failure
6. **No Streaming:** Waits for complete response (could be slow for long plans)
7. **No Caching:** Always calls OpenAI, even for similar inputs
8. **No Versioning:** Can't regenerate plan and keep old version

### 🔄 Refactoring Considerations

#### Potential Improvements

1. **Incremental Generation**
   - Generate one phase at a time
   - Allow regeneration of specific phases/weeks
   - Support plan updates mid-cycle

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

- **API Call Time:** ~5-15 seconds (depends on plan length)
- **Database Write Time:** ~2-3 seconds (132 records for 16-week plan: 4 phases + 16 weeks + 112 days)
- **Total Time:** ~7-18 seconds end-to-end

### Bottlenecks

1. **OpenAI API:** Slowest part (network + processing)
2. **Database Writes:** Multiple sequential creates (phases → weeks → days)
3. **No Parallelization:** Sequential operations

### Optimization Opportunities

1. **Batch Processing:** Generate multiple plans concurrently
2. **Async Processing:** Queue generation, notify when complete
3. **Database Optimization:** Use bulk inserts, reduce indexes during insert
4. **Caching:** Cache common plan templates
5. **Parallel Phase Creation:** Create phases in parallel (if independent)

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
// Test full flow
describe('POST /api/training-plan/generate', () => {
  it('generates and saves complete cascade', async () => {
    // Create draft plan
    // Call generate endpoint
    // Verify all TrainingPlanPhase records created
    // Verify all TrainingPlanWeek records created
    // Verify all TrainingPlanDay records created
    // Verify plan status updated
  });
  
  it('rolls back on OpenAI failure', async () => {
    // Mock OpenAI failure
    // Verify no partial data saved
  });
  
  it('computes week and phase mileage totals', async () => {
    // Generate plan
    // Verify week.miles is sum of day miles
    // Verify phase.totalMiles is sum of week miles
  });
});
```

---

## Related Files

- **API Route:** `app/api/training-plan/generate/route.ts`
- **Service:** `lib/training/plan-generator.ts`
- **Save Service:** `lib/training/save-plan.ts`
- **Date Utils:** `lib/training/dates.ts`
- **Goal Pace:** `lib/training/goal-pace.ts`
- **Schema:** `prisma/schema.prisma` (TrainingPlan, TrainingPlanPhase, TrainingPlanWeek, TrainingPlanDay models)

---

## Future Enhancements

### Planned Features

1. **Plan Regeneration:** Allow regenerating specific phases/weeks
2. **Plan Comparison:** Compare old vs new plan versions
3. **Custom Phases:** Allow user to adjust phase distribution
4. **Workout Templates:** Pre-built workout library
5. **Adaptive Plans:** Adjust based on execution data
6. **Lap Editing:** Allow manual editing of warmup/workout/cooldown arrays

### Research Areas

1. **Fine-Tuned Models:** Train model on GoFast-specific plans
2. **Multi-Model Ensemble:** Combine multiple models for better results
3. **Real-Time Adjustments:** Update plan based on athlete progress
4. **Injury Prevention:** Incorporate injury risk assessment
5. **Lap Structure Optimization:** Better AI understanding of workout structure

---

**Last Updated:** 2025-01-XX  
**Status:** Production (MVP1) - Refactored to Cascade Structure  
**Next Review:** After migration testing

    // Verify all TrainingPlanDay records created
    // Verify plan status updated
  });
  
  it('rolls back on OpenAI failure', async () => {
    // Mock OpenAI failure
    // Verify no partial data saved
  });
  
  it('computes week and phase mileage totals', async () => {
    // Generate plan
    // Verify week.miles is sum of day miles
    // Verify phase.totalMiles is sum of week miles
  });
});
```

---

## Related Files

- **API Route:** `app/api/training-plan/generate/route.ts`
- **Service:** `lib/training/plan-generator.ts`
- **Save Service:** `lib/training/save-plan.ts`
- **Date Utils:** `lib/training/dates.ts`
- **Goal Pace:** `lib/training/goal-pace.ts`
- **Schema:** `prisma/schema.prisma` (TrainingPlan, TrainingPlanPhase, TrainingPlanWeek, TrainingPlanDay models)

---

## Future Enhancements

### Planned Features

1. **Plan Regeneration:** Allow regenerating specific phases/weeks
2. **Plan Comparison:** Compare old vs new plan versions
3. **Custom Phases:** Allow user to adjust phase distribution
4. **Workout Templates:** Pre-built workout library
5. **Adaptive Plans:** Adjust based on execution data
6. **Lap Editing:** Allow manual editing of warmup/workout/cooldown arrays

### Research Areas

1. **Fine-Tuned Models:** Train model on GoFast-specific plans
2. **Multi-Model Ensemble:** Combine multiple models for better results
3. **Real-Time Adjustments:** Update plan based on athlete progress
4. **Injury Prevention:** Incorporate injury risk assessment
5. **Lap Structure Optimization:** Better AI understanding of workout structure

---

**Last Updated:** 2025-01-XX  
**Status:** Production (MVP1) - Refactored to Cascade Structure  
**Next Review:** After migration testing
