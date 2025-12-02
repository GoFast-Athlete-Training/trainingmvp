# FORENSIC TRAINING PLAN REPORT
## Raw Code Analysis - TrainingMVP Repository

**Date:** Generated from actual codebase scan
**Method:** Direct code inspection, no assumptions

---

## 1. TRAINING PLAN MODELS (Prisma Schema)

### EXACT SCHEMA LOCATION
**File:** `prisma/schema.prisma`
**Lines:** 91-181

### TrainingPlan Model (Lines 91-125)
```prisma
model TrainingPlan {
  id        String @id @default(cuid())
  athleteId String
  raceId    String

  // PLAN IDENTITY
  trainingPlanName String

  // CYCLE-LEVEL GOALS
  trainingPlanGoalTime              String
  trainingPlanGoalPace              String?
  trainingPlanBaseline5k            String
  trainingPlanBaselineWeeklyMileage Int?

  // PLAN STRUCTURE
  trainingPlanStartDate  DateTime
  trainingPlanTotalWeeks Int

  // MONEY METRIC
  trainingPlanAdaptive5kTime String?

  // STATUS
  status String @default("draft")

  // Relations
  athlete     Athlete                 @relation(...)
  race        Race                    @relation(...)
  plannedDays TrainingDayPlanned[]
}
```

**KEY FINDINGS:**
- NO phaseOverview field in database
- NO weeklyMileagePlan array in database
- Phases are NOT stored in TrainingPlan model
- Only `trainingPlanTotalWeeks` is stored

### TrainingDayPlanned Model (Lines 127-154)
```prisma
model TrainingDayPlanned {
  id             String  @id @default(cuid())
  trainingPlanId String
  athleteId      String

  // Day Identification
  date      DateTime
  weekIndex Int          // ← Stored as integer
  dayIndex  Int          // ← Stored as integer (0-6)
  dayName   String?

  // Training Context
  phase String           // ← Stored as string ("base", "build", "peak", "taper")

  // PLANNED WORKOUT
  plannedData Json       // ← ALL workout data in JSON

  // Relations
  trainingPlan TrainingPlan @relation(...)
  athlete      Athlete      @relation(...)

  @@unique([trainingPlanId, weekIndex, dayIndex])
}
```

**KEY FINDINGS:**
- `weekIndex` and `dayIndex` are stored as integers
- `phase` is stored as string per day
- `plannedData` is JSON blob (no schema enforcement)
- Unique constraint on (trainingPlanId, weekIndex, dayIndex)

### TrainingDayExecuted Model (Lines 156-181)
```prisma
model TrainingDayExecuted {
  id        String @id @default(cuid())
  athleteId String

  // THE LINK - shell container for AthleteActivity
  activityId String? @unique

  // Optional metadata
  weekIndex Int
  dayIndex  Int
  date      DateTime

  // Snapshot/computed fields
  plannedData Json?
  analysis    Json?
  feedback    Json?

  // Relations
  athlete Athlete @relation(...)
}
```

**KEY FINDINGS:**
- Executed days copy weekIndex/dayIndex from planned days
- No direct link to TrainingDayPlanned (linked by date)
- All analysis stored as JSON

### NO ENUMS FOUND
- No enum for phases
- No enum for workout types
- No enum for status
- All strings are free-form

---

## 2. DANIELS/BLOCK/PHASE/PERIOD REFERENCES

### SEARCH RESULTS
**Pattern:** `Daniels|block|phase|period|cup|periodization|base|build|peak|taper|VO2|threshold`

### FINDINGS:
- ❌ **NO "Daniels" references** found in codebase
- ❌ **NO "block" references** found
- ❌ **NO "cup" references** found
- ❌ **NO "periodization" references** found
- ❌ **NO "VO2" references** found
- ❌ **NO "threshold" references** found

### PHASE REFERENCES FOUND:
1. **`lib/services/plan-generator.ts`** (Lines 69-73)
   - Prompt text mentions: "Base Phase", "Build Phase", "Peak Phase", "Taper Phase"
   - Percentages: ~25%, ~35%, ~20%, remaining

2. **`app/api/training/plan/route.ts`** (Lines 30-33)
   - Hardcoded phase calculation:
     ```typescript
     const baseWeeks = Math.floor(totalWeeks * 0.25);
     const buildWeeks = Math.floor(totalWeeks * 0.35);
     const peakWeeks = Math.floor(totalWeeks * 0.2);
     const taperWeeks = totalWeeks - baseWeeks - buildWeeks - peakWeeks;
     ```

3. **Database Schema** (`prisma/schema.prisma` Line 139)
   - `phase String` field on TrainingDayPlanned
   - No enum, just free-form string

**CONCLUSION:** Phases exist as strings in database and are calculated on-the-fly, but NO structured periodization model exists.

---

## 3. AI PLAN GENERATOR

### FILE LOCATION
**File:** `lib/services/plan-generator.ts`
**Full Path:** `/Users/adamcole/Documents/GoFast/trainingmvp/lib/services/plan-generator.ts`
**Lines:** 1-223

### EXACT IMPLEMENTATION

#### Interface Definitions (Lines 8-58)
```typescript
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
    segments?: Array<{...}>;
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
```

#### OpenAI Prompt (Lines 67-136)
**Model:** `gpt-4o-mini`
**Temperature:** 0.7
**Max Tokens:** 4000

**Prompt Structure:**
1. Instructs AI to use "GoFast Training Model"
2. Defines phases with percentages:
   - Base: ~25%
   - Build: ~35%
   - Peak: ~20%
   - Taper: remaining
3. Defines workout types: easy, tempo, intervals, long_run, rest
4. Calculates weeks until race
5. Asks for complete JSON with ALL weeks and days

**Key Instruction:**
```
- Generate ALL weeks from start date to race date
- Each week has 7 days (dayIndex 0-6, Monday-Sunday)
- Calculate dates starting from today or specified start date
- Include rest days appropriately
- Progress mileage gradually
- Match phases to weeks correctly
- Return complete plan with all weeks and days
```

#### Save Function (Lines 176-221)
```typescript
export async function saveTrainingPlanToDB(
  athleteId: string,
  raceId: string,
  plan: GeneratedPlan,
  inputs: TrainingInputs
): Promise<string>
```

**What Gets Saved:**
1. Creates `TrainingPlan` record
2. Loops through `plan.weeks` array
3. Loops through each week's `days` array
4. Creates `TrainingDayPlanned` record for EACH day
5. Sets `weekIndex` from `week.weekIndex`
6. Sets `dayIndex` from `day.dayIndex`
7. Sets `phase` from `week.phase`
8. Sets `plannedData` from `day.plannedData` (as JSON)

**CRITICAL FINDING:** `phaseOverview` and `weeklyMileagePlan` from GeneratedPlan are NOT saved to database. Only individual days with their phase strings are saved.

---

## 4. LEFTOVER SERVICE LOGIC

### SEARCH RESULTS
**Pattern:** `cup|weekStructure|template|planLength|periodization`

**FINDINGS:**
- ❌ **NO matches found** for any of these terms
- ❌ **NO old architecture remnants** found in trainingmvp repo

### SERVICES DIRECTORY
**Location:** `lib/services/`
**Files:**
1. `analysis.ts` - GoFastScore computation
2. `extraction.ts` - OpenAI extraction utilities
3. `match-logic.ts` - Garmin activity matching
4. `plan-generator.ts` - AI plan generation

**CONCLUSION:** Clean codebase, no legacy code found.

---

## 5. MIGRATION COMMENTS / TODOs

### SEARCH RESULTS
**Pattern:** `TODO|FIXME|MIGRATION|REFACTOR|LEGACY|OLD|REMOVE`

### FINDINGS:

1. **`GOFAST_TRAINING_ARCHITECTURE.md`**
   - Multiple TODOs about refactoring "onboarding" → "training-setup"
   - TODO: Auto-create training plan after setup

2. **`app/api/training/plan/route.ts` (Line 63)**
   - Comment: `// Get weekly mileage (simplified - would need to calculate from planned days)`
   - Weekly mileage array is empty: `Array.from({ length: totalWeeks }, () => 0)`

3. **`app/api/onboarding/save/route.ts` (Line 68)**
   - Comment: `// Create new race (use a future date as placeholder, user can update later)`

**CONCLUSION:** Minor TODOs found, but no major migration issues.

---

## 6. UTILITIES USED BY PLAN GENERATOR

### DATE UTILITIES
**File:** `lib/utils/dates.ts`
**Functions:**
- `getStartOfDay(date: Date): Date`
- `getEndOfDay(date: Date): Date`
- `formatDate(date: Date | string): string`
- `formatDateShort(date: Date | string): string`
- `getDayName(dayIndex: number): string` - Maps 0-6 to day names
- `isToday(date: Date | string): boolean`

**USAGE:** Used in API routes for date filtering, NOT in plan generator itself.

### PACE UTILITIES
**File:** `lib/utils/pace.ts`
**Functions:**
- `parsePaceToSeconds(pace: string): number`
- `secondsToPaceString(seconds: number): string`
- `mpsToPaceString(mps: number): string`
- `formatPace(pace: string | null | undefined): string`
- `calculateGoalPace(goalTime: string, raceDistance: number): string`
- `getRaceDistanceMiles(raceType: string): number`

**USAGE:** Used in onboarding/setup, NOT in plan generator.

### PLAN GENERATOR DEPENDENCIES
**Direct Dependencies:**
- `openai` package (OpenAI SDK)
- `prisma` client
- NO other utilities

**CONCLUSION:** Plan generator is self-contained, uses OpenAI directly, no helper utilities.

---

## 7. weekIndex/dayIndex SOURCE OF TRUTH

### WHERE THEY ARE CREATED

#### 1. AI Generation (plan-generator.ts)
**Lines 199-212:**
```typescript
for (const week of plan.weeks) {
  for (const day of week.days) {
    dayRecords.push({
      trainingPlanId: trainingPlan.id,
      athleteId,
      date: new Date(day.date),
      weekIndex: week.weekIndex,    // ← From AI response
      dayIndex: day.dayIndex,       // ← From AI response
      dayName: ['Monday', 'Tuesday', ...][day.dayIndex],
      phase: week.phase,            // ← From AI response
      plannedData: day.plannedData, // ← From AI response
    });
  }
}
```

**SOURCE:** AI generates weekIndex and dayIndex in JSON response.

#### 2. AI Prompt Instructions (plan-generator.ts Line 129)
```
- Each week has 7 days (dayIndex 0-6, Monday-Sunday)
```

**CONSTRAINT:** AI is instructed that dayIndex must be 0-6.

#### 3. Database Storage
- `weekIndex: Int` - Stored as integer
- `dayIndex: Int` - Stored as integer
- Unique constraint: `@@unique([trainingPlanId, weekIndex, dayIndex])`

#### 4. Usage in API Routes

**`app/api/training/plan/[weekIndex]/route.ts` (Line 38):**
```typescript
const plannedDays = await prisma.trainingDayPlanned.findMany({
  where: {
    athleteId,
    trainingPlanId: activePlan.id,
    weekIndex,  // ← Used as query filter
  },
  orderBy: {
    dayIndex: 'asc',  // ← Used for sorting
  },
});
```

**`app/api/training/hub/route.ts` (Lines 86-88):**
```typescript
const planStart = new Date(activePlan.trainingPlanStartDate);
const daysSinceStart = Math.floor((today.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24));
const currentWeek = Math.floor(daysSinceStart / 7);  // ← Calculated from dates
```

**CRITICAL FINDING:** 
- `weekIndex` is AI-generated and stored
- `currentWeek` is calculated on-the-fly from dates
- These may NOT match if plan start date changes

### WHERE THEY ARE INTERPRETED

1. **Week View:** `app/training/plan/[weekIndex]/page.tsx`
   - Uses `weekIndex` from URL param
   - Queries database by `weekIndex`

2. **Day View:** `app/training/day/[dayId]/page.tsx`
   - Uses `dayId` (not weekIndex/dayIndex)
   - Gets day from database by ID

3. **Match Logic:** `lib/services/match-logic.ts`
   - Copies `weekIndex` and `dayIndex` from planned day to executed day

### VALIDATION
- ❌ **NO validation** found for weekIndex bounds
- ❌ **NO validation** found for dayIndex (0-6)
- ❌ **NO validation** that all 7 days exist per week
- Database unique constraint prevents duplicates, but doesn't enforce completeness

**CONCLUSION:** 
- Weeks are **AI-generated** (not fixed templates)
- dayIndex is **enforced by AI prompt** (0-6)
- weekIndex is **arbitrary** (AI decides based on total weeks)
- NO validation ensures plan completeness

---

## 8. CLEAN RAW FORENSIC REPORT

### EXACT CURRENT STATE

#### ✅ WHAT EXISTS:

1. **Database Models:**
   - `TrainingPlan` - Top-level plan (no phase data stored)
   - `TrainingDayPlanned` - Individual days with weekIndex, dayIndex, phase (string)
   - `TrainingDayExecuted` - Completed workouts

2. **AI Plan Generator:**
   - Uses OpenAI `gpt-4o-mini`
   - Generates complete plan (all weeks/days) in one call
   - Returns JSON with phaseOverview and weeklyMileagePlan
   - **BUT:** phaseOverview and weeklyMileagePlan are NOT saved to DB

3. **Phase System:**
   - Phases exist as strings: "base", "build", "peak", "taper"
   - Stored per day in `TrainingDayPlanned.phase`
   - Calculated on-the-fly in API routes using hardcoded percentages:
     - Base: 25%
     - Build: 35%
     - Peak: 20%
     - Taper: remaining

4. **Week/Day Structure:**
   - `weekIndex`: Integer, AI-generated, stored in DB
   - `dayIndex`: Integer (0-6), AI-generated, stored in DB
   - Each week should have 7 days (enforced by AI prompt, not code)

5. **Workout Data:**
   - All stored in `plannedData` JSON field
   - No schema enforcement
   - Types: "easy", "tempo", "intervals", "long_run", "rest"

#### ❌ WHAT DOES NOT EXIST:

1. **NO Daniels-style logic**
   - No VDOT calculations
   - No pace zones based on Daniels
   - No structured periodization model

2. **NO Templates**
   - No pre-defined workout templates
   - No week templates
   - Everything is AI-generated

3. **NO Fixed Week Structure**
   - Weeks are dynamically generated by AI
   - No validation that structure is correct
   - No minimum/maximum week constraints

4. **NO Encoded Structure**
   - Everything is JSON
   - No enums
   - No type safety for workout types
   - No validation schemas

5. **NO Phase Overview Storage**
   - `phaseOverview` from AI response is discarded
   - Recalculated on-the-fly in API routes
   - May not match actual stored phase strings

6. **NO Weekly Mileage Plan Storage**
   - `weeklyMileagePlan` from AI response is discarded
   - API route returns empty array: `[0, 0, 0, ...]`
   - Would need to calculate from planned days

### HOW PLANS ARE ACTUALLY GENERATED:

1. **Input:** Race info, goal time, baseline 5K, weekly mileage
2. **AI Call:** Single OpenAI call generates complete plan
3. **Response:** JSON with all weeks, all days, phaseOverview, weeklyMileagePlan
4. **Save:** Only individual days saved to `TrainingDayPlanned`
5. **Loss:** phaseOverview and weeklyMileagePlan are NOT persisted

### HOW PHASES ARE ACTUALLY DETERMINED:

1. **AI Generation:** AI assigns phase string to each week
2. **Storage:** Phase stored per day (from week.phase)
3. **API Calculation:** Hardcoded percentages recalculate phases:
   ```typescript
   baseWeeks = Math.floor(totalWeeks * 0.25)
   buildWeeks = Math.floor(totalWeeks * 0.35)
   peakWeeks = Math.floor(totalWeeks * 0.2)
   taperWeeks = totalWeeks - baseWeeks - buildWeeks - peakWeeks
   ```
4. **Mismatch Risk:** Calculated phases may not match stored phase strings

### HOW WEEKS ARE ACTUALLY COUNTED:

1. **AI Generation:** AI decides weekIndex based on total weeks
2. **Storage:** weekIndex stored as integer
3. **Current Week Calculation:** Calculated from dates:
   ```typescript
   daysSinceStart = (today - planStart) / (1000 * 60 * 60 * 24)
   currentWeek = Math.floor(daysSinceStart / 7)
   ```
4. **Potential Issue:** currentWeek may not match stored weekIndex if dates shift

### MISSING PIECES AFTER NEXT.JS MIGRATION:

1. **Phase Overview:** Not stored, recalculated (may be wrong)
2. **Weekly Mileage Plan:** Not stored, returns empty array
3. **Plan Validation:** No checks that all weeks/days exist
4. **Date Consistency:** No validation that dates match weekIndex
5. **Workout Type Safety:** No enum/validation for workout types

### WHAT THE PLAN GENERATOR ACTUALLY PRODUCES:

**Input:**
- Race name, date, distance
- Goal time
- Baseline 5K pace
- Weekly mileage

**Output (GeneratedPlan):**
- `totalWeeks`: Number
- `phaseOverview`: Object with startWeek/endWeek for each phase
- `weeklyMileagePlan`: Array of numbers (one per week)
- `weeks`: Array of Week objects
  - Each Week has: `weekIndex`, `phase`, `days[]`
  - Each Day has: `dayIndex`, `plannedData`, `date`

**What Gets Saved:**
- TrainingPlan record (name, goals, totalWeeks, status)
- TrainingDayPlanned records (one per day)
  - weekIndex, dayIndex, phase, plannedData (JSON), date

**What Gets Lost:**
- phaseOverview object
- weeklyMileagePlan array
- Week-level metadata

---

## FINAL VERDICT

### ARCHITECTURE TYPE:
**Pure AI-Generated Plans** - No templates, no fixed structure, no periodization model

### PHASE SYSTEM:
**String-Based, Not Structured** - Phases are strings stored per day, recalculated on-the-fly

### WEEK STRUCTURE:
**AI-Determined** - AI decides weekIndex, no validation, may have gaps

### DATA LOSS:
**Significant** - phaseOverview and weeklyMileagePlan from AI are discarded

### VALIDATION:
**Minimal** - Only database unique constraint, no business logic validation

### PERIODIZATION:
**None** - No structured model, just percentages in prompt and API routes

---

**END OF FORENSIC REPORT**

