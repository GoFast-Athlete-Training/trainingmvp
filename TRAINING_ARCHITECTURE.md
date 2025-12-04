# GoFast Training System - Complete Architecture

**⚠️ THIS IS THE SINGLE SOURCE OF TRUTH ⚠️**

**Last Updated:** 2024-12-03  
**Schema Version:** Current Prisma schema  
**Status:** Active Development

---

## Table of Contents

1. [Database Schema](#database-schema)
2. [Model Relationships](#model-relationships)
3. [API Endpoints](#api-endpoints)
4. [Business Logic Rules](#business-logic-rules)
5. [Data Flow Patterns](#data-flow-patterns)
6. [Critical Constraints](#critical-constraints)
7. [Known Issues & Fixes](#known-issues--fixes)

---

## Database Schema

### Core Models

#### `Athlete`
**Table:** `Athlete` (PascalCase, NO @@map directive - matches gofastapp-mvp)

**Purpose:** Core user identity and profile

**Key Fields:**
- `id` (String, cuid) - Primary key
- `firebaseId` (String, unique) - Firebase Auth UID
- `email` (String?, optional)
- `companyId` (String, REQUIRED) - Links to GoFastCompany
- `fiveKPace` (String?, mm:ss format) - **SOURCE OF TRUTH** for 5K pace

**Relations:**
- `company` → `GoFastCompany` (many-to-one, required)
- `trainingPlans` → `TrainingPlan[]` (one-to-many, via `athleteId`)
- `athleteTrainingPlans` → `AthleteTrainingPlan[]` (junction table)
- `plannedDays` → `TrainingDayPlanned[]`
- `executedDays` → `TrainingDayExecuted[]`
- `activities` → `AthleteActivity[]`

**Critical Notes:**
- **NO `@@map("athletes")`** - Uses Prisma default PascalCase table name
- `companyId` is REQUIRED (single-tenant pattern)
- `fiveKPace` is the authoritative 5K pace value

---

#### `GoFastCompany`
**Table:** `go_fast_companies` (snake_case via @@map)

**Purpose:** Single-tenant container (all athletes belong to one company)

**Key Fields:**
- `id` (String, cuid)
- `slug` (String, unique) - e.g., "gofast"
- `name` (String)

**Relations:**
- `athletes` → `Athlete[]` (one-to-many)

**Critical Notes:**
- Single company per deployment
- Created via upsert pattern in `/api/athlete/create`

---

#### `RaceRegistry`
**Table:** `race_registry` (snake_case via @@map)

**Purpose:** Global catalogue of races (search-first registry pattern, shared across all users)

**Key Fields:**
- `id` (String, cuid)
- `name` (String)
- `distance` (String) - "marathon", "half", "5k", "10k", etc.
- `date` (DateTime)
- `city` (String?)
- `state` (String?)
- `createdBy` (String?, optional) - athleteId who first created it (for tracking, not ownership)

**Relations:**
- `raceTrainingPlans` → `RaceTrainingPlan[]` (junction table - many-to-many with TrainingPlan)

**Constraints:**
- `@@unique([name, date])` - Prevents duplicate races

**Critical Notes:**
- **REGISTRY PATTERN:** Search first, if exists use it, if not create it
- **NO direct ownership** - `createdBy` is optional tracking only
- **Many-to-many relationship** with `TrainingPlan` via `RaceTrainingPlan` junction table
- When creating a race, check for existing `(name, date)` before creating
- If duplicate found, return existing race instead of creating new one
- The "lock in" happens at the `RaceTrainingPlan` junction table level, not at the race level

---

#### `TrainingPlan`
**Table:** `TrainingPlan` (PascalCase, NO @@map directive - matches gofastapp-mvp)

**Purpose:** Training plan container (one plan per race goal)

**Key Fields:**
- `id` (String, cuid)
- `athleteId` (String) - Original creator/owner
- `trainingPlanName` (String)
- `trainingPlanGoalTime` (String?) - e.g., "3:30:00" for marathon
- `goalFiveKPace` (String?) - mm:ss format - **TARGET 5K pace** derived from goal time + race distance
- `trainingPlanStartDate` (DateTime)
- `trainingPlanTotalWeeks` (Int)
- `status` (String, default: "draft") - "draft", "active", "completed", "archived"

**Relations:**
- `athlete` → `Athlete` (many-to-one, via `athleteId`)
- `raceTrainingPlans` → `RaceTrainingPlan[]` (junction table - many-to-many with RaceRegistry)
- `athleteTrainingPlans` → `AthleteTrainingPlan[]` (junction table)
- `plannedDays` → `TrainingDayPlanned[]`

**Indexes:**
- `@@index([athleteId, status])` - Fast lookup of active plans

**Critical Notes:**
- **NO `raceRegistryId` field** - Use `RaceTrainingPlan` junction table instead
- `goalFiveKPace` is calculated automatically when `trainingPlanGoalTime` is set
- `goalFiveKPace` represents TARGET pace, NOT current fitness (that's `Athlete.fiveKPace`)

**Critical Notes:**
- **NO `@@map("training_plans")`** - Uses Prisma default PascalCase table name
- **NO `raceRegistryId` field** - Use `RaceTrainingPlan` junction table instead
- `goalFiveKPace` is calculated automatically when `trainingPlanGoalTime` is set (via `/api/training-plan/update` or `/api/training-plan/generate`)
- Status lifecycle: `draft` → `active` → `completed`/`archived`
- One plan can be assigned to multiple athletes via `AthleteTrainingPlan` junction table

---

#### `RaceTrainingPlan` (Junction Table)
**Table:** `race_training_plans` (snake_case via @@map)

**Purpose:** Many-to-many relationship between RaceRegistry and TrainingPlan

**Key Fields:**
- `id` (String, cuid)
- `raceRegistryId` (String)
- `trainingPlanId` (String)
- `createdAt` (DateTime, default: now())
- `updatedAt` (DateTime, updatedAt)

**Relations:**
- `raceRegistry` → `RaceRegistry` (many-to-one)
- `trainingPlan` → `TrainingPlan` (many-to-one)

**Constraints:**
- `@@unique([raceRegistryId, trainingPlanId])` - One race-plan pair
- `@@index([raceRegistryId])` - Fast lookup of all plans for a race
- `@@index([trainingPlanId])` - Fast lookup of race for a plan

**Critical Notes:**
- **This is where the "lock in" happens** - A plan is linked to a race via this junction
- RaceRegistry is global (search-first registry pattern)
- Multiple plans can link to the same race
- Use this junction table to find which race a plan is targeting

---

#### `AthleteTrainingPlan` (Junction Table)
**Table:** `athlete_training_plans` (snake_case via @@map)

**Purpose:** Many-to-many relationship between Athlete and TrainingPlan

**Key Fields:**
- `id` (String, cuid)
- `athleteId` (String)
- `trainingPlanId` (String)
- `assignedAt` (DateTime, default: now())

**Relations:**
- `athlete` → `Athlete` (many-to-one)
- `trainingPlan` → `TrainingPlan` (many-to-one)

**Constraints:**
- `@@unique([athleteId, trainingPlanId])` - One assignment per athlete-plan pair

**Critical Notes:**
- **NO BOOLEAN FLAGS** - No `isActive`, no `isPrimary`, no status fields
- **MVP1 Behavior:** Only created when plan is generated (in `/api/training-plan/generate`)
- **Future Use:** For "My Training Plans" selection screen
- **MVP1:** Do NOT use this table to determine active plan - continue loading "whatever training plan exists"
- Query pattern: `AthleteTrainingPlan.findFirst({ where: { athleteId }, orderBy: { assignedAt: 'desc' } })`

---

#### `TrainingDayPlanned`
**Table:** `training_days_planned` (snake_case via @@map)

**Purpose:** Individual planned workout days within a training plan

**Key Fields:**
- `id` (String, cuid)
- `trainingPlanId` (String)
- `athleteId` (String)
- `weekIndex` (Int) - Week number (1-based)
- `dayIndex` (Int) - Day of week (1=Monday, 7=Sunday)
- `phase` (String) - "base", "build", "peak", "taper"
- `date` (DateTime) - Computed date (calculated by backend)
- `plannedData` (Json) - Workout details (type, mileage, pace, etc.)

**Relations:**
- `trainingPlan` → `TrainingPlan` (many-to-one)
- `athlete` → `Athlete` (many-to-one)

**Constraints:**
- `@@unique([trainingPlanId, weekIndex, dayIndex])` - One planned day per plan/week/day

**Critical Notes:**
- `date` is computed by backend based on `trainingPlanStartDate` + `weekIndex` + `dayIndex`
- `plannedData` is JSON structure from AI generation
- No direct FK to `TrainingPlanExecution` - standalone planned days

---

#### `TrainingDayExecuted`
**Table:** `training_days_executed` (snake_case via @@map)

**Purpose:** Completed workout executions (links to AthleteActivity)

**Key Fields:**
- `id` (String, cuid)
- `athleteId` (String)
- `activityId` (String?, unique) - Links to `AthleteActivity.id`
- `weekIndex` (Int)
- `dayIndex` (Int)
- `date` (DateTime)
- `plannedData` (Json?) - Snapshot of planned workout
- `analysis` (Json?) - AI analysis of execution
- `feedback` (Json?) - AI feedback

**Relations:**
- `athlete` → `Athlete` (many-to-one)

**Critical Notes:**
- **NO direct FK to TrainingPlan** - Links via `athleteId` and `date` matching
- `activityId` links to `AthleteActivity` (Garmin sync)
- Can exist without `activityId` (manual entry)

---

**Critical Notes:**
- **NO SNAPSHOT TABLES** - All data lives on the main models (`TrainingPlan`, `Athlete`)
- `Athlete.fiveKPace` is the source of truth for 5K pace
- Use `TrainingPlan.trainingPlanGoalTime` for goal time (stored directly on plan)
- Preferred days can be added as a field on `TrainingPlan` if needed in the future

---

#### `AthleteActivity`
**Table:** `athlete_activities` (snake_case via @@map)

**Purpose:** Synced activities from Garmin (or other sources)

**Key Fields:**
- `id` (String, cuid)
- `athleteId` (String)
- `sourceActivityId` (String, unique) - External ID (Garmin activity ID)
- `source` (String, default: "garmin")
- `activityType` (String?)
- `startTime` (DateTime?)
- `duration` (Int?) - seconds
- `distance` (Float?) - miles
- `averageSpeed` (Float?)
- `averageHeartRate` (Int?)
- `summaryData` (Json?)
- `detailData` (Json?)

**Relations:**
- `athlete` → `Athlete` (many-to-one)

**Critical Notes:**
- Synced from Garmin via PKCE OAuth flow
- Linked to `TrainingDayExecuted` via `activityId`

---

#### `Race` (DEPRECATED)
**Table:** `races` (snake_case via @@map)

**Purpose:** Legacy race model - **DO NOT USE**

**Critical Notes:**
- **DEPRECATED** - Use `RaceRegistry` instead
- No relations to `TrainingPlan` (removed)
- Kept for migration purposes only

---

## Model Relationships

### Relationship Diagram

```
GoFastCompany (1) ──< (many) Athlete
Athlete (1) ──< (many) TrainingPlan (via athleteId)
Athlete (many) ──< (many) TrainingPlan (via AthleteTrainingPlan junction)
RaceRegistry (many) ──< (many) TrainingPlan (via RaceTrainingPlan junction)
TrainingPlan (1) ──< (many) TrainingDayPlanned
Athlete (1) ──< (many) TrainingDayExecuted
Athlete (1) ──< (many) AthleteActivity
TrainingDayExecuted (1) ──< (1) AthleteActivity (via activityId)
```

### Critical Relationship Rules

1. **RaceRegistry → TrainingPlan: MANY-TO-MANY via Junction**
   - One race can have many training plans
   - One plan can target one race (via `RaceTrainingPlan` junction table)
   - Query: `RaceRegistry.raceTrainingPlans` → `RaceTrainingPlan[]` → `TrainingPlan[]`
   - **This is where the "lock in" happens** - A plan is linked to a race via this junction
   - RaceRegistry is global (search-first registry pattern)

2. **Athlete → TrainingPlan: MANY-TO-MANY via Junction**
   - Use `AthleteTrainingPlan` for future "My Training Plans" selection screen
   - **MVP1:** Only created when plan is generated, NOT used to determine active plan
   - **MVP1:** Continue loading "whatever training plan exists" for the athlete
   - Query pattern: `AthleteTrainingPlan.findFirst({ where: { athleteId }, orderBy: { assignedAt: 'desc' } })`
   - Fallback: `TrainingPlan.findFirst({ where: { athleteId, status: 'active' } })`

3. **TrainingPlan → TrainingDayPlanned: ONE-TO-MANY**
   - Each plan has many planned days
   - Days are created during plan generation
   - Unique constraint: `(trainingPlanId, weekIndex, dayIndex)`

4. **TrainingDayExecuted → TrainingPlan: NO DIRECT FK**
   - Links via `athleteId` and `date` matching
   - No FK constraint - flexible matching

---

## API Endpoints

### Authentication & Athlete

#### `POST /api/athlete/create`
**Purpose:** Create or update athlete record from Firebase token

**Request:**
- Headers: `Authorization: Bearer <firebaseToken>`
- Body: `{}` (empty)

**Response:**
```json
{
  "success": true,
  "athleteId": "...",
  "data": { ... }
}
```

**Business Logic:**
- Verifies Firebase token
- Upserts `GoFastCompany` (single company)
- Upserts `Athlete` with `companyId`
- Returns athlete data

---

#### `POST /api/athlete/hydrate`
**Purpose:** Hydrate athlete data including active training plan

**Request:**
- Headers: `Authorization: Bearer <firebaseToken>`
- Body: `{}` (empty)

**Response:**
```json
{
  "success": true,
  "athlete": {
    "id": "...",
    "firebaseId": "...",
    "email": "...",
    "firstName": "...",
    "lastName": "...",
    "trainingPlanId": "..." // Active plan ID from junction table
  }
}
```

**Business Logic:**
- Finds athlete by Firebase token
- Queries `AthleteTrainingPlan` for active plan (any assignment = active)
- Bolts `trainingPlanId` onto athlete object
- Returns full athlete object

**Critical Notes:**
- `trainingPlanId` comes from junction table, not direct FK
- If no active plan, `trainingPlanId` is `null`

---

### Training Plan Setup (Hydrate-ID-First Pattern)

#### `POST /api/training-plan/create`
**Purpose:** Create draft training plan

**Request:**
```json
{
  "raceRegistryId": "..."
}
```

**Response:**
```json
{
  "success": true,
  "trainingPlanId": "..."
}
```

**Business Logic:**
- If `raceRegistryId` provided:
  - Validates race exists
  - Creates `TrainingPlan` with `status: "draft"`
  - Creates `RaceTrainingPlan` junction entry to link plan to race
- If no `raceRegistryId`:
  - Creates `TrainingPlan` with `status: "draft"` (race can be attached later)
- Returns `trainingPlanId` immediately
- **NO wizard state** - ID is the source of truth

---

#### `POST /api/training-plan/update`
**Purpose:** Update draft training plan fields

**Request:**
```json
{
  "trainingPlanId": "...",
  "updates": {
    "trainingPlanGoalTime": "3:30:00",
    "trainingPlanName": "Boston Marathon 2025",
    "trainingPlanStartDate": "2025-01-01T00:00:00Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "trainingPlan": { ... }
}
```

**Business Logic:**
- Validates plan exists and is `status: "draft"`
- Validates athlete ownership
- Updates fields atomically
- Returns updated plan

---

#### `POST /api/training-plan/generate`
**Purpose:** Generate and activate training plan

**Request:**
```json
{
  "trainingPlanId": "..."
}
```

**Response:**
```json
{
  "success": true,
  "trainingPlan": { ... }
}
```

**Business Logic:**
- Loads draft plan
- Validates required fields (`trainingPlanGoalTime`, `trainingPlanStartDate`, etc.)
- Calls AI generation service
- Creates all `TrainingDayPlanned` records
- Updates plan `status: "active"`
- Creates `AthleteTrainingPlan` junction entry (assignment = active)
- All within transaction

---

#### `GET /api/training-plan/[id]`
**Purpose:** Get training plan details

**Response:**
```json
{
  "success": true,
  "trainingPlan": {
    "id": "...",
    "raceRegistry": { ... },
    ...
  }
}
```

---

### Training Hub

#### `GET /api/training/hub`
**Purpose:** Get training hub data (today's workout, plan status, race readiness)

**Request:**
- Headers: `Authorization: Bearer <firebaseToken>`

**Response:**
```json
{
  "todayWorkout": {
    "id": "...",
    "date": "...",
    "plannedData": { ... },
    "status": "pending" | "completed" | "rest"
  },
  "planStatus": {
    "hasPlan": true,
    "totalWeeks": 16,
    "currentWeek": 5,
    "phase": "build"
  },
  "raceReadiness": {
    "current5kPace": "24:30",
    "goalDelta": "+2:15",
    "status": "on-track" | "behind" | "impossible"
  }
}
```

**Business Logic:**
- **CRITICAL:** Query `AthleteTrainingPlan` first for active plan
  ```typescript
  const activeAssignment = await prisma.athleteTrainingPlan.findFirst({
    where: { athleteId },
    include: { trainingPlan: { include: { raceRegistry: true } } }
  });
  ```
- Fallback: `TrainingPlan.findFirst({ where: { athleteId, status: 'active' } })`
- Finds today's `TrainingDayPlanned`
- Checks for `TrainingDayExecuted` to determine status
- Calculates current week from `trainingPlanStartDate`
- Returns `hasPlan: false` if no active plan

---

### Race Registry

#### `POST /api/race/search`
**Purpose:** Search races by name

**Request:**
```json
{
  "query": "Boston"
}
```

**Response:**
```json
{
  "success": true,
  "races": [
    {
      "id": "...",
      "name": "Boston Marathon",
      "date": "...",
      ...
    }
  ]
}
```

**Business Logic:**
- Searches `RaceRegistry` by `name` (case-insensitive)
- Returns empty array if no results (NOT an error)
- Handles `P2021` (table not found) gracefully → returns 503

---

#### `POST /api/race/create`
**Purpose:** Create new race in registry

**Request:**
```json
{
  "name": "Boston Marathon",
  "distance": "marathon",
  "date": "2025-04-21T00:00:00Z",
  "city": "Boston",
  "state": "MA",
  "country": "USA"
}
```

**Response:**
```json
{
  "success": true,
  "race": { ... }
}
```

**Business Logic:**
- **CRITICAL:** Check for existing race with `(name, date)` before creating
- If duplicate found, return existing race (don't create)
- Creates race with `createdBy: athleteId` from token
- Returns created or existing race

---

## Business Logic Rules

### Training Plan Lifecycle

1. **Draft Creation**
   - User selects/creates race → `POST /api/training-plan/create`
   - Returns `trainingPlanId` immediately
   - Plan status: `"draft"`

2. **Draft Updates**
   - Each setup step calls `POST /api/training-plan/update`
   - Updates single field (goal time, start date, etc.)
   - Plan remains `status: "draft"`

3. **Plan Generation**
   - Final step calls `POST /api/training-plan/generate`
   - Validates all required fields (goal time, race attached via junction)
   - Calculates `goalFiveKPace` if not already set (from goal time + race distance)
   - Calls AI generation service
   - Creates all `TrainingDayPlanned` records
   - Updates `status: "active"` and sets `goalFiveKPace`
   - Creates `AthleteTrainingPlan` junction entry (`assignedAt: now()`) - MVP1: only created when plan is generated

4. **Plan Activation**
   - Plan becomes visible in training hub
   - `todayWorkout` queries start working
   - **MVP1:** Continue loading "whatever training plan exists" - do NOT use junction table to determine active plan yet

### Active Plan Lookup Pattern

**ALWAYS use this pattern:**

```typescript
// MVP1: Continue loading "whatever training plan exists"
// Future: Use AthleteTrainingPlan junction table for "My Training Plans" selection

// 1. Try junction table first (for plans created via generate endpoint)
const activeAssignment = await prisma.athleteTrainingPlan.findFirst({
  where: {
    athleteId,
  },
  include: {
    trainingPlan: {
      include: {
        raceTrainingPlans: {
          include: {
            raceRegistry: true,
          },
        },
      },
    },
  },
  orderBy: {
    assignedAt: 'desc',
  },
});

let activePlan = activeAssignment?.trainingPlan;

// 2. Fallback to direct query (for legacy plans or plans not yet generated)
if (!activePlan) {
  activePlan = await prisma.trainingPlan.findFirst({
    where: {
      athleteId,
      status: 'active',
    },
    include: {
      raceTrainingPlans: {
        include: {
          raceRegistry: true,
        },
      },
    },
  });
}
```

### Race Registry Duplicate Prevention

**ALWAYS check before creating:**

```typescript
// Check for existing race
const existingRace = await prisma.raceRegistry.findUnique({
  where: {
    name_date: {
      name: raceData.name,
      date: raceData.date,
    },
  },
});

if (existingRace) {
  return NextResponse.json({ success: true, race: existingRace });
}

// Create new race
const newRace = await prisma.raceRegistry.create({ ... });
```

---

## Data Flow Patterns

### Hydrate-ID-First Setup Flow

```
1. User selects race
   → POST /api/training-plan/create { raceRegistryId }
   → Returns { trainingPlanId }
   → Redirect to /training-setup/[trainingPlanId]

2. User enters goal time
   → Load plan: GET /api/training-plan/[trainingPlanId]
   → Update: POST /api/training-plan/update { trainingPlanId, updates: { trainingPlanGoalTime } }
   → Redirect to /training-setup/[trainingPlanId]/review

3. User reviews and generates
   → Load plan: GET /api/training-plan/[trainingPlanId]
   → Generate: POST /api/training-plan/generate { trainingPlanId }
   → Redirect to /training?planId=xxx
```

**Key Principles:**
- NO wizard state in frontend
- Each page loads plan from DB
- Each update is atomic API call
- `trainingPlanId` is the source of truth

### Athlete Hydration Flow

```
1. User authenticates (Firebase)
   → POST /api/athlete/create
   → Upserts athlete with companyId

2. User lands on /welcome
   → POST /api/athlete/hydrate
   → Queries AthleteTrainingPlan for active plan
   → Bolts trainingPlanId onto athlete object
   → Stores in localStorage

3. User clicks "Let's Train"
   → Checks localStorage for trainingPlanId
   → If exists: redirect to /training
   → If not: redirect to /training-setup
```

---

## Critical Constraints

### Table Name Conventions

- **PascalCase (NO @@map):** `Athlete`, `TrainingPlan` - Matches gofastapp-mvp
- **snake_case (with @@map):** `race_registry`, `athlete_training_plans`, `training_days_planned`, etc.

### Foreign Key Rules

- `Athlete.companyId` → REQUIRED (single-tenant)
- `TrainingPlan` → NO direct `raceRegistryId` field - use `RaceTrainingPlan` junction table
- `TrainingDayExecuted` → NO FK to `TrainingPlan` (flexible matching)

### Unique Constraints

- `RaceRegistry`: `@@unique([name, date])` - Prevents duplicates
- `RaceTrainingPlan`: `@@unique([raceRegistryId, trainingPlanId])` - One race-plan pair
- `AthleteTrainingPlan`: `@@unique([athleteId, trainingPlanId])` - One assignment per pair
- `TrainingDayPlanned`: `@@unique([trainingPlanId, weekIndex, dayIndex])` - One day per plan/week/day

### Status Lifecycle

- `TrainingPlan.status`: `"draft"` → `"active"` → `"completed"` | `"archived"`
- `AthleteTrainingPlan`: MVP1 - Only created when plan is generated. Future: Used for "My Training Plans" selection screen.

### Goal Pace Derivation

- When `trainingPlanGoalTime` is set (via `/api/training-plan/update` or `/api/training-plan/generate`):
  - Get race distance from `RaceTrainingPlan` junction → `RaceRegistry.distance`
  - Convert goal time to seconds
  - Calculate pace per mile: `pacePerMileSec = raceGoalSeconds / raceMiles`
  - Convert to 5K target pace: `goalFiveKSec = pacePerMileSec * 3.10686`
  - Save as `TrainingPlan.goalFiveKPace` (mm:ss format)
- **Important:** `goalFiveKPace` is TARGET pace, NOT current fitness (that's `Athlete.fiveKPace`)

---

## Known Issues & Fixes

### Issue: Table Name Mismatch
**Problem:** Prisma schema had `@@map("athletes")` but database table is `Athlete`  
**Fix:** Removed `@@map` directive - uses Prisma default PascalCase  
**Status:** ✅ Fixed

### Issue: Missing `fiveKPace` Column
**Problem:** Schema had `fiveKPace` but column didn't exist in database  
**Fix:** Added column via migration  
**Status:** ✅ Fixed

### Issue: Race Registry Duplicates
**Problem:** Same race created multiple times  
**Fix:** Added `@@unique([name, date])` constraint + check before create  
**Status:** ✅ Fixed

### Issue: Active Plan Lookup
**Problem:** Querying `TrainingPlan` directly instead of using junction table  
**Fix:** Updated `/api/training/hub` to use `AthleteTrainingPlan` first  
**Status:** ✅ Fixed

### Issue: Training Plan Table Name
**Problem:** Schema had `@@map("training_plans")` but database table is `TrainingPlan`  
**Fix:** Removed `@@map` directive - uses Prisma default PascalCase  
**Status:** ✅ Fixed

### Issue: Deprecated `raceId` Column
**Problem:** `TrainingPlan` had `raceId` but should use `raceRegistryId`  
**Fix:** Added `raceRegistryId`, dropped `raceId` column  
**Status:** ✅ Fixed

---

## Validation Checklist

Before deploying, verify:

- [ ] All table names match (PascalCase vs snake_case)
- [ ] `RaceRegistry` has `@@unique([name, date])`
- [ ] `TrainingPlan` uses `raceRegistryId` (not `raceId`)
- [ ] Active plan lookup uses `AthleteTrainingPlan` junction table
- [ ] Race creation checks for duplicates before creating
- [ ] `Athlete.companyId` is always set
- [ ] `TrainingPlan.status` lifecycle is enforced
- [ ] All API endpoints validate athlete ownership

---

**END OF ARCHITECTURE DOCUMENT**

