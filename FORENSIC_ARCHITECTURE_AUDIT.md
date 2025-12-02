# FORENSIC ARCHITECTURE AUDIT
## GoFast Training MVP - Current State Report

**Date:** December 2, 2024  
**Purpose:** Complete forensic analysis of the codebase AS IT EXISTS  
**Methodology:** Direct file reading, no assumptions, no context from previous sessions

---

## 1. PRISMA SCHEMA - COMPLETE INVENTORY

### 1.1 All Models Present

1. **Athlete** (lines 13-87)
2. **AthleteActivity** (lines 89-124)
3. **Race** (lines 127-145) - **DEPRECATED**
4. **RaceRegistry** (lines 148-167) - **NEW**
5. **TrainingPlan** (lines 169-199)
6. **TrainingDayPlanned** (lines 201-227)
7. **TrainingPlanFiveKPace** (lines 230-246) - **SNAPSHOT TABLE**
8. **TrainingPlanPreferredDays** (lines 249-265) - **SNAPSHOT TABLE**
9. **TrainingDayExecuted** (lines 267-292)
10. **GoFastCompany** (lines 298-313)

---

## 2. ATHLETE MODEL - DETAILED ANALYSIS

### 2.1 5K Pace Fields - EXACT STATE

**✅ IMPLEMENTED:**
- `canonicalFiveKPace: String?` (line 39) - **NEW CANONICAL FIELD**
- `preferredRunDays: Int[]` (line 40) - **NEW CANONICAL FIELD**

**⚠️ LEGACY (DEPRECATED BUT PRESENT):**
- `myCurrentPace: String?` (line 43) - **LEGACY, KEPT FOR MIGRATION**
- `myWeeklyMileage: Int?` (line 44) - **LEGACY**
- `myTrainingGoal: String?` (line 45) - **LEGACY**
- `myTargetRace: String?` (line 47) - **LEGACY**

**ANSWER:** Yes, Athlete model contains BOTH:
- ✅ `canonicalFiveKPace` (new canonical field)
- ⚠️ `myCurrentPace` (legacy field, deprecated but still present)

---

### 2.2 Snapshot/Junction Tables - EXACT STATE

**✅ IMPLEMENTED:**
1. **TrainingPlanFiveKPace** (lines 230-246)
   - `id`, `trainingPlanId`, `athleteId`, `fiveKPace: String`
   - `@@unique([trainingPlanId])` - One snapshot per plan
   - Relations to `TrainingPlan` and `Athlete`

2. **TrainingPlanPreferredDays** (lines 249-265)
   - `id`, `trainingPlanId`, `athleteId`, `preferredDays: Int[]`
   - `@@unique([trainingPlanId])` - One snapshot per plan
   - Relations to `TrainingPlan` and `Athlete`

**ANSWER:** ✅ YES - Both snapshot tables exist and are properly structured.

---

### 2.3 RaceRegistry - EXACT STATE

**✅ IMPLEMENTED:**
- **RaceRegistry model** (lines 148-167)
  - Fields: `id`, `name`, `distance`, `date`, `city`, `state`, `country`, `createdBy`, `isGlobal`
  - Relation: `trainingPlans TrainingPlan[]`
  - Table name: `race_registry`

**⚠️ ALSO PRESENT:**
- **Race model** (lines 127-145) - **DEPRECATED**
  - Comment: "Legacy Race model - deprecated, use RaceRegistry instead"
  - No relation to TrainingPlan (commented out)

**ANSWER:** ✅ YES - RaceRegistry exists. Race model also exists but is deprecated.

---

### 2.4 TrainingPlan Race Reference - EXACT STATE

**TrainingPlan model** (lines 169-199):
- `raceRegistryId: String` (line 172) - **References RaceRegistry**
- Relation: `raceRegistry RaceRegistry @relation(...)` (line 193)
- **NO `raceId` field present**

**ANSWER:** ✅ TrainingPlan references `RaceRegistry`, NOT `Race`.

---

### 2.5 TrainingPlan Direct Fields - EXACT STATE

**TrainingPlan model fields:**
- `id: String`
- `athleteId: String`
- `raceRegistryId: String` ✅
- `trainingPlanName: String`
- `trainingPlanGoalTime: String?`
- `trainingPlanStartDate: DateTime`
- `trainingPlanTotalWeeks: Int`
- `status: String @default("draft")`
- `createdAt`, `updatedAt`

**REMOVED (NOT PRESENT):**
- ❌ `trainingPlanBaseline5k` - **NOT IN SCHEMA**
- ❌ `trainingPlanBaselineWeeklyMileage` - **NOT IN SCHEMA**
- ❌ `trainingPlanAdaptive5kTime` - **NOT IN SCHEMA**
- ❌ `trainingPlanGoalPace` - **NOT IN SCHEMA**

**Relations:**
- `athlete`, `raceRegistry`, `plannedDays`, `trainingPlanFiveKPace?`, `trainingPlanPreferredDays?`

**ANSWER:** TrainingPlan has minimal fields. Baseline/adaptive fields removed. Snapshots live in junction tables.

---

### 2.6 TrainingDayPlanned - EXACT STATE

**TrainingDayPlanned model** (lines 201-227):
- `id: String`
- `trainingPlanId: String`
- `athleteId: String`
- `weekIndex: Int`
- `dayIndex: Int` - **Comment: "MUST be 1-7 (1=Monday, 7=Sunday)"** ✅
- `phase: String`
- `date: DateTime` - **Comment: "Computed date (calculated by backend, not from AI)"** ✅
- `plannedData: Json`
- `createdAt`, `updatedAt`
- `@@unique([trainingPlanId, weekIndex, dayIndex])`

**REMOVED:**
- ❌ `dayName: String?` - **NOT IN SCHEMA**

**ANSWER:** ✅ `dayIndex` is 1-7. `date` is computed by backend. `dayName` removed.

---

### 2.7 TrainingDayExecuted - EXACT STATE

**TrainingDayExecuted model** (lines 267-292):
- `id: String`
- `athleteId: String`
- `activityId: String? @unique` - **Links to AthleteActivity**
- `weekIndex: Int`
- `dayIndex: Int` - **No comment about range**
- `date: DateTime`
- `plannedData: Json?`
- `analysis: Json?`
- `feedback: Json?`
- `createdAt`, `updatedAt`
- Relation: `athlete Athlete`

**NOTES:**
- No relation to `TrainingPlan` or `TrainingPlanExecution`
- No `executionId` field
- Standalone execution record

**ANSWER:** TrainingDayExecuted is a shell container linking `AthleteActivity` to planned days.

---

## 3. LIB/SERVICES - COMPLETE ANALYSIS

### 3.1 plan-generator.ts - EXACT STATE

**File:** `lib/services/plan-generator.ts` (230 lines)

#### 3.1.1 Date Generation from AI

**Prompt Analysis (lines 60-118):**
- Line 82: "DO NOT generate calendar dates. We will compute dates ourselves."
- Line 108: "CRITICAL RULES: - DO NOT generate calendar dates."
- Line 38: Comment: "// NO date field - dates computed by backend"

**WeekDay Interface (lines 18-39):**
- ✅ NO `date` field
- Only: `dayIndex: number` and `plannedData`

**ANSWER:** ✅ AI does NOT generate dates. Dates are computed by backend.

---

#### 3.1.2 dayIndex Range

**WeekDay Interface (line 19):**
- `dayIndex: number; // 1-7 (1=Monday, 7=Sunday)`

**Prompt (line 109):**
- "dayIndex MUST be 1-7 (1=Monday, 2=Tuesday, ..., 7=Sunday)"

**Example JSON in prompt (line 91):**
- `"dayIndex": 1`

**ANSWER:** ✅ dayIndex is 1-7, NOT 0-6.

---

#### 3.1.3 Date Computation Utilities

**Function:** `calculateTrainingDayDate` (lines 69-84 in `lib/utils/dates.ts`)
- Parameters: `planStartDate: Date`, `weekIndex: number`, `dayIndex: number`
- Formula: `(weekIndex * 7) + (dayIndex - 1)` days from start
- Comment: "dayIndex 1 = Monday, so we need to adjust"

**Usage in plan-generator.ts (line 205):**
- `const computedDate = calculateTrainingDayDate(planStartDate, week.weekIndex, day.dayIndex);`

**ANSWER:** ✅ Date computation utility exists and is used.

---

#### 3.1.4 saveTrainingPlanToDB - Race Reference

**Function:** `saveTrainingPlanToDB` (lines 158-228)

**Parameters:**
- `athleteId: string`
- `raceRegistryId: string` ✅ (line 160)
- `planStartDate: Date`
- `plan: GeneratedPlan`
- `inputs: TrainingInputs`

**TrainingPlan Creation (lines 168-178):**
- Uses `raceRegistryId` ✅
- Creates `TrainingPlanFiveKPace` snapshot (lines 181-187) ✅
- Creates `TrainingPlanPreferredDays` snapshot (lines 190-198) ✅
- Creates all `TrainingDayPlanned` records with computed dates (lines 201-222) ✅

**ANSWER:** ✅ Uses `raceRegistryId`, NOT `raceId`. Creates snapshots. Computes dates.

---

### 3.2 dates.ts - EXACT STATE

**File:** `lib/utils/dates.ts` (86 lines)

**Functions:**
1. `getStartOfDay(date: Date): Date`
2. `getEndOfDay(date: Date): Date`
3. `formatDate(date: Date | string): string`
4. `formatDateShort(date: Date | string): string`
5. `getDayName(dayIndex: number): string` - **Accepts 1-7, converts to 0-6 for array**
6. `isToday(date: Date | string): boolean`
7. `calculateTrainingDayDate(...)` - **NEW** ✅

**ANSWER:** ✅ Date utilities exist, including `calculateTrainingDayDate` for computing training day dates.

---

### 3.3 analysis.ts - EXACT STATE

**File:** `lib/services/analysis.ts` (144 lines)

**Functions:**
1. `computeGoFastScore(athleteId, executedDayId): Promise<GoFastScore>`
2. `updateCanonicalFiveKPace(athleteId, qualityScore): Promise<string>` ✅

**updateCanonicalFiveKPace (lines 92-123):**
- Uses `athlete.canonicalFiveKPace` ✅ (line 105)
- Falls back to `athlete.myCurrentPace` (legacy)
- Updates `canonicalFiveKPace` field ✅ (line 118)

**ANSWER:** ✅ Analysis service updates canonical 5K pace, not plan-specific.

---

### 3.4 extraction.ts - EXACT STATE

**File:** `lib/services/extraction.ts` (86 lines)

**Status:** ✅ EXISTS but appears UNUSED in current flow

**Interface:** `ExtractedTrainingInputs`
- Fields: `raceName`, `raceDate`, `raceDistance`, `goalTime`, `baseline5k`, `weeklyMileage`, `preferredRunDays`
- Uses old field names (`baseline5k`, not `canonicalFiveKPace`)

**ANSWER:** ⚠️ Extraction service exists but uses old field names and appears unused in MVP1 flow.

---

## 4. APP/API - COMPLETE ROUTE ANALYSIS

### 4.1 Routes Using Old Schema

#### `/api/onboarding/save` (route.ts, lines 1-125)

**Uses OLD Race model:**
- Line 57: `prisma.race.findFirst(...)`
- Line 72: `prisma.race.create(...)`
- Returns `race` object (lines 110-115)

**Uses LEGACY Athlete fields:**
- Line 84: `myTargetRace: raceName`
- Line 85: `myTrainingGoal: goalTime`
- Line 86: `myCurrentPace: current5k`
- Returns legacy fields (lines 104-108)

**ANSWER:** ❌ **MISMATCH** - Uses deprecated `Race` model and legacy athlete fields.

---

#### `/api/onboarding/inference` (route.ts, lines 1-116)

**Status:** ✅ Only generates inference text, doesn't save to DB
- No schema dependencies
- Uses OpenAI only

**ANSWER:** ✅ No schema issues (doesn't touch DB).

---

### 4.2 Routes Using New Schema

#### `/api/training/hub` (route.ts, lines 1-146)

**Uses NEW schema:**
- Line 24: `include: { raceRegistry: true, trainingPlanFiveKPace: true }` ✅
- Line 95: `activePlan.raceRegistry` ✅
- Line 92: `activePlan.trainingPlanFiveKPace?.fiveKPace` ✅

**ANSWER:** ✅ Uses RaceRegistry and snapshot tables correctly.

---

#### `/api/training/plan` (route.ts, lines 1-77)

**Status:** ✅ Reads TrainingPlan only, no schema-specific logic
- No direct field references
- Calculates phases from `trainingPlanTotalWeeks`

**ANSWER:** ✅ No schema issues.

---

#### `/api/training/plan/[weekIndex]` (route.ts, lines 1-103)

**Uses TrainingDayPlanned:**
- Line 34: Queries by `weekIndex` and `dayIndex`
- Line 85: Returns `dayIndex` directly (assumes 1-7)

**ANSWER:** ✅ Uses dayIndex correctly (no conversion).

---

#### `/api/training/day/[dayId]` (route.ts, lines 1-93)

**Uses TrainingDayPlanned:**
- Line 74: Returns `dayIndex` directly
- No date computation

**ANSWER:** ✅ No schema issues.

---

#### `/api/training/match/[dayId]` (route.ts, lines 1-120)

**Uses NEW schema:**
- Line 4: Imports `updateCanonicalFiveKPace` ✅
- Line 107: Calls `updateCanonicalFiveKPace(athleteId, score.overallScore)` ✅

**ANSWER:** ✅ Uses canonical update function correctly.

---

### 4.3 Missing Routes

**NOT FOUND:**
- ❌ `/api/race-registry` - No route to create/manage RaceRegistry
- ❌ `/api/athlete/canonical` - No route to update canonical 5K pace or preferred days
- ❌ `/api/training/plan/generate` - No route that calls `saveTrainingPlanToDB`

**ANSWER:** ❌ **MISSING** - No API routes for RaceRegistry CRUD or canonical updates.

---

## 5. CRITICAL MISMATCHES - SUMMARY

### 5.1 Schema vs. Code Mismatches

1. **❌ `/api/onboarding/save` uses deprecated `Race` model**
   - Schema has `RaceRegistry`, but route creates `Race`
   - Should create `RaceRegistry` entry instead

2. **❌ `/api/onboarding/save` uses legacy athlete fields**
   - Updates `myCurrentPace`, `myTargetRace`, `myTrainingGoal`
   - Should update `canonicalFiveKPace` instead

3. **❌ No route to create `RaceRegistry` entries**
   - Schema has `RaceRegistry` model
   - No API endpoint to create/manage races

4. **❌ No route to update canonical fields**
   - Schema has `canonicalFiveKPace` and `preferredRunDays`
   - No API endpoint to update these

5. **❌ No route to generate training plans**
   - `plan-generator.ts` has `saveTrainingPlanToDB` function
   - No API route calls it

---

### 5.2 What IS Implemented

✅ **Schema:**
- RaceRegistry model exists
- Snapshot tables (TrainingPlanFiveKPace, TrainingPlanPreferredDays) exist
- TrainingPlan references RaceRegistry
- TrainingDayPlanned uses dayIndex 1-7
- Athlete has canonicalFiveKPace and preferredRunDays

✅ **Services:**
- plan-generator.ts uses raceRegistryId
- plan-generator.ts computes dates (no AI dates)
- plan-generator.ts uses dayIndex 1-7
- plan-generator.ts creates snapshots
- Date utilities exist
- Analysis updates canonical 5K pace

✅ **Some Routes:**
- `/api/training/hub` uses RaceRegistry and snapshots
- `/api/training/match/[dayId]` updates canonical pace

---

### 5.3 What IS NOT Implemented

❌ **API Routes:**
- RaceRegistry CRUD operations
- Canonical field updates (5K pace, preferred days)
- Training plan generation endpoint
- Race creation during onboarding

❌ **Onboarding Flow:**
- Still uses deprecated Race model
- Still uses legacy athlete fields
- Doesn't create RaceRegistry entries
- Doesn't set canonicalFiveKPace

❌ **Frontend Integration:**
- No way to create races (RaceRegistry)
- No way to update canonical data
- No way to generate training plans

---

## 6. ARCHITECTURE GAPS

### 6.1 Missing API Endpoints

1. **POST `/api/race-registry`** - Create race in registry
2. **GET `/api/race-registry`** - List races (with filtering)
3. **PUT `/api/athlete/canonical`** - Update canonicalFiveKPace and preferredRunDays
4. **POST `/api/training/plan/generate`** - Generate and save training plan

### 6.2 Broken Flows

1. **Onboarding → Plan Generation:**
   - Onboarding saves to legacy fields
   - No connection to plan generation
   - Plan generation expects RaceRegistry, but onboarding creates Race

2. **Canonical Updates:**
   - Analysis service updates canonical pace
   - But no user-facing way to set initial canonical pace
   - No way to update preferred days

---

## 7. FINAL VERDICT

### ✅ SCHEMA: 95% Complete
- All models exist and are correctly structured
- Snapshot tables implemented
- RaceRegistry implemented
- dayIndex 1-7 implemented
- Date computation implemented

### ⚠️ SERVICES: 90% Complete
- plan-generator.ts is correct
- Date utilities exist
- Analysis service updates canonical fields
- Extraction service exists but unused

### ❌ API ROUTES: 40% Complete
- Training viewing routes work
- Onboarding routes use OLD schema
- Missing RaceRegistry routes
- Missing canonical update routes
- Missing plan generation route

### ❌ INTEGRATION: 20% Complete
- No end-to-end flow from onboarding → plan generation
- No way to create races
- No way to update canonical data
- Frontend cannot generate plans

---

## 8. RECOMMENDATIONS (Facts Only, No Implementation)

1. **Fix `/api/onboarding/save`:**
   - Replace `Race` creation with `RaceRegistry` creation
   - Update `canonicalFiveKPace` instead of `myCurrentPace`
   - Return `raceRegistryId` instead of `race.id`

2. **Create `/api/race-registry` routes:**
   - POST to create race
   - GET to list races
   - Support filtering by distance, date, location

3. **Create `/api/athlete/canonical` route:**
   - PUT to update `canonicalFiveKPace` and `preferredRunDays`
   - Used for profile settings

4. **Create `/api/training/plan/generate` route:**
   - Accepts `raceRegistryId`, `planStartDate`, `goalTime`
   - Calls `generateTrainingPlanAI` and `saveTrainingPlanToDB`
   - Returns `trainingPlanId`

5. **Remove or update extraction.ts:**
   - Either delete if unused
   - Or update to use `canonicalFiveKPace` instead of `baseline5k`

---

**END OF FORENSIC AUDIT**

