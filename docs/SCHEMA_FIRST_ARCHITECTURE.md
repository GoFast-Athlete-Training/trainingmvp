# GoFast Training System - Schema-First Architecture

**Last Updated**: January 2025  
**Source of Truth**: `prisma/schema.prisma`  
**Purpose**: Complete system architecture mapped from database schema

---

## Table of Contents

1. [Schema Foundation](#schema-foundation)
2. [Model-by-Model Architecture](#model-by-model-architecture)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [API Route Mapping](#api-route-mapping)
5. [Business Logic Mapping](#business-logic-mapping)
6. [Missing Implementations](#missing-implementations)

---

## Schema Foundation

### Database: PostgreSQL
- **Provider**: Prisma Client
- **Connection**: `DATABASE_URL` environment variable
- **Migration Strategy**: Prisma Migrate

### Core Models (10 Total)

1. **Athlete** - User identity and profile
2. **GoFastCompany** - Single-tenant container
3. **RaceRegistry** - Global race catalog
4. **Race** - Legacy model (deprecated)
5. **TrainingPlan** - Plan container
6. **TrainingDayPlanned** - Planned workout days
7. **TrainingPlanFiveKPace** - Snapshot table (5K pace at plan creation)
8. **TrainingPlanPreferredDays** - Snapshot table (unused in MVP1)
9. **TrainingDayExecuted** - Completed workout records
10. **AthleteActivity** - Garmin activity data

---

## Model-by-Model Architecture

### 1. Athlete Model

**Table**: `athletes`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `firebaseId`, `gofastHandle`, `garmin_user_id`, `strava_id`

#### Schema Definition
```prisma
model Athlete {
  id String @id @default(cuid())
  
  // Auth
  firebaseId String @unique
  email String?
  
  // Company Link (Single-tenant) - REQUIRED
  companyId String
  company GoFastCompany @relation(...)
  
  // Profile Identity
  fiveKPace String? // mm:ss format - THE SOURCE OF TRUTH
  
  // Relations
  trainingPlans TrainingPlan[]
  plannedDays TrainingDayPlanned[]
  executedDays TrainingDayExecuted[]
  activities AthleteActivity[]
  trainingPlanFiveKPaces TrainingPlanFiveKPace[]
  trainingPlanPreferredDays TrainingPlanPreferredDays[]
}
```

#### Architecture Mapping

**Identity Layer:**
- **Firebase Auth**: `firebaseId` links Firebase user to database athlete
- **Email**: Optional, can be null
- **Company**: Required single-tenant isolation via `companyId`

**Profile Layer:**
- **fiveKPace**: `String?` in `mm:ss` format (e.g., "8:30")
  - **Source of Truth**: This is THE canonical 5K pace
  - **Updated By**: 
    - Manual: `PUT /api/athlete/profile`
    - Automatic: `lib/services/analysis.ts` → `updateFiveKPace()`
  - **Used By**: Plan generation reads this value

**Legacy Fields (Deprecated):**
- `myCurrentPace`, `myWeeklyMileage`, `myTrainingGoal`, etc.
- **Status**: Kept for migration, not used in new code
- **Migration Path**: Eventually migrate data to `fiveKPace`

**Garmin Integration:**
- **PKCE OAuth**: `garmin_user_id`, `garmin_access_token`, `garmin_refresh_token`
- **Connection Status**: `garmin_is_connected`, `garmin_connected_at`
- **Sync Tracking**: `garmin_last_sync_at`
- **Metadata**: `garmin_permissions`, `garmin_user_profile` (JSON)

**API Routes:**
- `POST /api/athlete/create` - Upsert athlete on Firebase sign-in
- `GET /api/athlete/profile` - Get athlete profile
- `PUT /api/athlete/profile` - Update profile (including `fiveKPace`)
- `POST /api/athlete/hydrate` - Hydrate athlete data with relations

**Business Logic:**
- `lib/domain-athlete.ts` - Athlete domain functions
- `lib/athlete/profile.ts` - Profile management
- `lib/services/analysis.ts` - Updates `fiveKPace` based on workout quality

**Relationships:**
- **One-to-Many**: `trainingPlans`, `plannedDays`, `executedDays`, `activities`
- **One-to-Many**: `trainingPlanFiveKPaces`, `trainingPlanPreferredDays` (via snapshots)

---

### 2. GoFastCompany Model

**Table**: `go_fast_companies`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraint**: `slug`

#### Schema Definition
```prisma
model GoFastCompany {
  id String @id @default(cuid())
  name String
  slug String @unique
  address String?
  city String?
  state String?
  zip String?
  domain String?
  
  athletes Athlete[]
}
```

#### Architecture Mapping

**Purpose**: Single-tenant architecture container
- **Isolation**: All athletes belong to a company
- **Default Company**: "gofast" (slug)
- **Future**: Multi-tenant support via company isolation

**API Routes:**
- None (managed internally)

**Business Logic:**
- Company creation handled in `POST /api/athlete/create`
- Default company lookup/creation

---

### 3. RaceRegistry Model

**Table**: `race_registry`  
**Primary Key**: `id` (String, cuid)

#### Schema Definition
```prisma
model RaceRegistry {
  id String @id @default(cuid())
  name String
  distance String // "marathon", "half", "5k", "10k", etc.
  date DateTime
  city String?
  state String?
  country String?
  createdBy String // athleteId
  isGlobal Boolean @default(false)
  
  trainingPlans TrainingPlan[]
}
```

#### Architecture Mapping

**Purpose**: Global catalog of races
- **Public Races**: `isGlobal = true` (future feature)
- **Private Races**: `isGlobal = false`, `createdBy` tracks creator
- **One Race, Many Plans**: Multiple athletes can train for same race

**API Routes:**
- `POST /api/race/search` - Fuzzy search by name (public, no auth)
- `POST /api/race/create` - Create race (auth required)

**Business Logic:**
- Search: Case-insensitive partial match, ordered by date
- Create: Sets `createdBy` to authenticated `athleteId`
- Validation: `name`, `distance`, `date` required

**Relationships:**
- **One-to-Many**: `trainingPlans` (multiple athletes can train for same race)

**Data Flow:**
```
User searches race → POST /api/race/search → Returns RaceRegistry[]
User creates race → POST /api/race/create → Creates RaceRegistry → Returns race
User selects race → Stores raceRegistryId → Uses in plan generation
```

---

### 4. Race Model (Deprecated)

**Table**: `races`  
**Status**: ⚠️ **DEPRECATED** - Do not use

#### Schema Definition
```prisma
model Race {
  id String @id @default(cuid())
  raceName String
  raceType String
  raceDate DateTime
  location String?
  distanceMiles Float
  // NO relations to TrainingPlan
}
```

#### Architecture Mapping

**Purpose**: Legacy model kept for migration
- **Status**: No new code should use this
- **Migration**: Existing data should migrate to `RaceRegistry`
- **Relations**: Commented out - no `TrainingPlan` relation

**Action Required**: 
- Migrate existing `Race` records to `RaceRegistry`
- Remove model after migration complete

---

### 5. TrainingPlan Model

**Table**: `training_plans`  
**Primary Key**: `id` (String, cuid)

#### Schema Definition
```prisma
model TrainingPlan {
  id String @id @default(cuid())
  athleteId String
  raceRegistryId String // References RaceRegistry
  
  // PLAN IDENTITY
  trainingPlanName String
  
  // CYCLE-LEVEL GOALS
  trainingPlanGoalTime String?
  
  // PLAN STRUCTURE
  trainingPlanStartDate DateTime
  trainingPlanTotalWeeks Int
  
  // STATUS
  status String @default("draft") // "draft", "active", "completed"
  
  // Relations
  athlete Athlete @relation(...)
  raceRegistry RaceRegistry @relation(...)
  plannedDays TrainingDayPlanned[]
  trainingPlanFiveKPace TrainingPlanFiveKPace?
  trainingPlanPreferredDays TrainingPlanPreferredDays?
}
```

#### Architecture Mapping

**Purpose**: Master container for training plan
- **One Plan Per Athlete**: Currently one active plan (can be extended)
- **Status Flow**: `draft` → `active` → `completed`

**Plan Creation Flow:**
1. User selects race → `raceRegistryId`
2. User enters goal time → `trainingPlanGoalTime`
3. System calculates weeks → `trainingPlanTotalWeeks`
4. System generates plan → Creates `TrainingPlan` + all `TrainingDayPlanned`
5. Status set to `active`

**API Routes:**
- `POST /api/training-plan/generate` - Generate complete plan
- `GET /api/training-plan/[id]` - Get plan details
- `GET /api/training-plan/[id]/week/[weekIndex]` - Get specific week
- `GET /api/training/hub` - Get active plan with today's workout

**Business Logic:**
- `lib/training/plan-generator.ts` - OpenAI plan generation
- `lib/training/save-plan.ts` - Saves plan to database
- `lib/training/dates.ts` - Date calculation utilities

**Relationships:**
- **Many-to-One**: `athlete` (one athlete, many plans possible)
- **Many-to-One**: `raceRegistry` (one race, many plans)
- **One-to-Many**: `plannedDays` (all workout days)
- **One-to-One**: `trainingPlanFiveKPace` (snapshot)
- **One-to-One**: `trainingPlanPreferredDays` (snapshot, unused)

**Data Flow:**
```
POST /api/training-plan/generate
  → Load athlete (read fiveKPace)
  → Load race (read name, distance, date)
  → Calculate totalWeeks from race date
  → generateTrainingPlanAI() → GeneratedPlan
  → saveTrainingPlanToDB() → Creates:
    - TrainingPlan record
    - TrainingPlanFiveKPace snapshot
    - All TrainingDayPlanned records
```

---

### 6. TrainingDayPlanned Model

**Table**: `training_days_planned`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraint**: `[trainingPlanId, weekIndex, dayIndex]`

#### Schema Definition
```prisma
model TrainingDayPlanned {
  id String @id @default(cuid())
  trainingPlanId String
  athleteId String
  
  // Day Identification
  weekIndex Int // 1-based (first week is 1)
  dayIndex Int // 1-7 (1=Monday, 7=Sunday)
  phase String // "base", "build", "peak", "taper"
  
  // Computed date (calculated by backend, not from AI)
  date DateTime
  
  // PLANNED WORKOUT (atomic element)
  plannedData Json
  
  // Relations
  trainingPlan TrainingPlan @relation(...)
  athlete Athlete @relation(...)
}
```

#### Architecture Mapping

**Purpose**: Individual planned workout days
- **Atomic Elements**: Each day is a complete workout unit
- **Date Computation**: Backend calculates `date` from `planStartDate`, `weekIndex`, `dayIndex`
- **No AI Dates**: OpenAI doesn't generate dates, backend computes them

**Date Calculation Formula:**
```typescript
// Formula: ((weekIndex - 1) * 7) + (dayIndex - 1) days from planStartDate
// Example: weekIndex 1, dayIndex 1 = day 0 (first Monday)
//          weekIndex 1, dayIndex 2 = day 1 (first Tuesday)
//          weekIndex 2, dayIndex 1 = day 7 (second Monday)
const computedDate = calculateTrainingDayDate(planStartDate, weekIndex, dayIndex);
```

**plannedData JSON Structure:**
```typescript
{
  type: "easy" | "tempo" | "intervals" | "long_run" | "rest",
  mileage: number,
  paceRange?: string, // e.g., "8:30-9:00"
  targetPace?: string, // e.g., "8:45"
  hrZone?: string, // e.g., "2"
  hrRange?: string, // e.g., "130-150"
  segments?: Array<{
    type: string,
    distance?: number,
    duration?: number,
    pace?: string,
    reps?: number
  }>,
  label?: string, // e.g., "Easy Run"
  description?: string,
  coachNotes?: string
}
```

**API Routes:**
- `GET /api/training/day/[dayId]` - Get specific day
- `GET /api/training/plan/[weekIndex]` - Get all days in week
- `GET /api/training/hub` - Get today's planned workout

**Business Logic:**
- `lib/training/dates.ts` - `calculateTrainingDayDate()` function
- `lib/training/save-plan.ts` - Creates all days in batch

**Relationships:**
- **Many-to-One**: `trainingPlan` (one plan, many days)
- **Many-to-One**: `athlete` (one athlete, many planned days)

**Data Flow:**
```
Plan Generation:
  OpenAI generates plan → Returns weeks[] with days[]
  For each week:
    For each day:
      Calculate date from weekIndex + dayIndex
      Create TrainingDayPlanned record
      Store plannedData as JSON
```

---

### 7. TrainingPlanFiveKPace Model

**Table**: `training_plan_five_k_pace`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraint**: `[trainingPlanId]` (one snapshot per plan)

#### Schema Definition
```prisma
model TrainingPlanFiveKPace {
  id String @id @default(cuid())
  trainingPlanId String
  athleteId String
  fiveKPace String // mm:ss format - SNAPSHOT at plan creation
  
  // Relations
  trainingPlan TrainingPlan @relation(...)
  athlete Athlete @relation(...)
}
```

#### Architecture Mapping

**Purpose**: Snapshot of athlete's 5K pace at plan creation time
- **Identity Drift Prevention**: If athlete improves pace later, old plans still reference original pace
- **Historical Accuracy**: Race readiness calculations use snapshot, not current pace
- **One Per Plan**: `@@unique([trainingPlanId])` ensures one snapshot per plan

**Creation Flow:**
```
Plan Generation:
  1. Read athlete.fiveKPace (e.g., "8:30")
  2. Create TrainingPlan
  3. Create TrainingPlanFiveKPace snapshot with same value
  4. Plan uses snapshot for all calculations
```

**Usage:**
- Race readiness calculations (`/api/training/hub`)
- Historical plan analysis
- Goal delta calculations

**API Routes:**
- Included in `GET /api/training/hub` response
- Included in `GET /api/training-plan/[id]` response

**Business Logic:**
- `lib/training/save-plan.ts` - Creates snapshot during plan generation

**Relationships:**
- **One-to-One**: `trainingPlan` (one plan, one snapshot)
- **Many-to-One**: `athlete` (one athlete, many snapshots across plans)

---

### 8. TrainingPlanPreferredDays Model

**Table**: `training_plan_preferred_days`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraint**: `[trainingPlanId]` (one snapshot per plan)

#### Schema Definition
```prisma
model TrainingPlanPreferredDays {
  id String @id @default(cuid())
  trainingPlanId String
  athleteId String
  preferredDays Int[] // e.g., [1,3,5] where 1=Monday, 7=Sunday
  
  // Relations
  trainingPlan TrainingPlan @relation(...)
  athlete Athlete @relation(...)
}
```

#### Architecture Mapping

**Purpose**: Snapshot of preferred run days at plan creation
- **Status**: ⚠️ **UNUSED IN MVP1**
- **Future**: Will be used when preferred days feature is implemented
- **Schema Ready**: Table exists, relations defined, but no code writes to it

**Action Required:**
- Keep schema for future use
- Document as "reserved for future feature"
- Do not create records until feature is implemented

**Relationships:**
- **One-to-One**: `trainingPlan` (one plan, one snapshot)
- **Many-to-One**: `athlete` (one athlete, many snapshots)

---

### 9. TrainingDayExecuted Model

**Table**: `training_days_executed`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraint**: `activityId` (one execution per activity)

#### Schema Definition
```prisma
model TrainingDayExecuted {
  id String @id @default(cuid())
  athleteId String
  
  // THE LINK - shell container for AthleteActivity
  activityId String? @unique
  
  // Optional metadata
  weekIndex Int
  dayIndex Int
  date DateTime
  
  // Snapshot/computed fields
  plannedData Json?
  analysis Json?
  feedback Json?
  
  // Relations
  athlete Athlete @relation(...)
  // NO relation to TrainingPlan or TrainingDayPlanned
}
```

#### Architecture Mapping

**Purpose**: Record of completed workouts
- **Shell Container**: Links `AthleteActivity` to planned workouts
- **No FK to Plan**: Linking done by matching `date`, `weekIndex`, `dayIndex`
- **Optional Activity**: Can be manual entry (`activityId = null`) or Garmin match (`activityId` set)

**Linking Strategy:**
```
Matching Algorithm (application logic, not DB constraint):
  1. Find TrainingDayPlanned by date/weekIndex/dayIndex
  2. Create TrainingDayExecuted with same date/weekIndex/dayIndex
  3. If Garmin activity matched: Set activityId
  4. Store snapshot of plannedData at execution time
```

**Execution Flow:**
```
Manual Entry:
  User marks workout complete
  → Create TrainingDayExecuted
  → activityId = null
  → plannedData = snapshot from TrainingDayPlanned
  → Trigger analysis

Garmin Match:
  Activity synced from Garmin
  → Match activity to TrainingDayPlanned (by date)
  → Create TrainingDayExecuted
  → activityId = AthleteActivity.id
  → plannedData = snapshot from TrainingDayPlanned
  → Trigger analysis
```

**API Routes:**
- `POST /api/training/match/[dayId]` - Match activity to planned day
- `GET /api/training/day/[dayId]` - Get day (includes executed status)

**Business Logic:**
- `lib/services/match-logic.ts` - Activity matching algorithms
- `lib/services/analysis.ts` - Computes GoFastScore, updates analysis JSON

**Relationships:**
- **Many-to-One**: `athlete` (one athlete, many executed days)
- **One-to-One (optional)**: `AthleteActivity` via `activityId` (no Prisma relation)

**Data Flow:**
```
Workout Completion:
  TrainingDayPlanned (planned workout)
    ↓
  User completes workout
    ↓
  TrainingDayExecuted created
    ├─ activityId: null (manual) OR AthleteActivity.id (matched)
    ├─ plannedData: snapshot from TrainingDayPlanned
    ├─ weekIndex, dayIndex, date: copied from planned day
    └─ analysis: computed GoFastScore
```

---

### 10. AthleteActivity Model

**Table**: `athlete_activities`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraint**: `sourceActivityId` (one DB record per Garmin activity)

#### Schema Definition
```prisma
model AthleteActivity {
  id String @id @default(cuid())
  athleteId String
  sourceActivityId String @unique
  source String @default("garmin")
  
  // Activity Data
  activityType String?
  activityName String?
  startTime DateTime?
  duration Int? // seconds
  distance Float? // meters
  calories Int?
  averageSpeed Float? // m/s
  averageHeartRate Int?
  maxHeartRate Int?
  elevationGain Float?
  steps Int?
  
  // Location
  startLatitude Float?
  startLongitude Float?
  endLatitude Float?
  endLongitude Float?
  summaryPolyline String?
  
  // Raw Data
  summaryData Json?
  detailData Json?
  hydratedAt DateTime?
  
  // Relations
  athlete Athlete @relation(...)
}
```

#### Architecture Mapping

**Purpose**: Raw activity data from Garmin (or other sources)
- **Source Tracking**: `source` field (default "garmin")
- **Unique by Source**: `sourceActivityId` ensures one DB record per Garmin activity
- **Raw Storage**: `summaryData`, `detailData` store full Garmin JSON

**Sync Flow:**
```
Garmin Webhook:
  POST /api/garmin/webhook
    → Receives activity data
    → Creates/updates AthleteActivity
    → Stores summaryData + detailData
    → Sets hydratedAt timestamp
```

**Matching Flow:**
```
Activity Matching:
  Unmatched Activity (AthleteActivity with no TrainingDayExecuted.activityId)
    ↓
  Auto-match algorithm (by date/time proximity)
    OR
  Manual match (user selects planned day)
    ↓
  Create TrainingDayExecuted
    → activityId = AthleteActivity.id
    → Links activity to planned workout
```

**API Routes:**
- `POST /api/garmin/webhook` - Receives Garmin activity data
- `GET /api/training/match/[dayId]` - Get unmatched activities for matching

**Business Logic:**
- `lib/domain-garmin.ts` - Garmin domain functions
- `lib/services/match-logic.ts` - Auto-match algorithms

**Relationships:**
- **Many-to-One**: `athlete` (one athlete, many activities)
- **One-to-One (optional)**: `TrainingDayExecuted` via `activityId` (no Prisma relation)

**Data Flow:**
```
Garmin Sync:
  Garmin webhook → POST /api/garmin/webhook
    → Parse activity data
    → Find athlete by garmin_user_id
    → Create/update AthleteActivity
    → Store raw JSON in summaryData/detailData
    → Set hydratedAt = now()
```

---

## Data Flow Diagrams

### Complete Training Plan Lifecycle

```
1. ATHLETE CREATION
   Firebase Sign-In
     ↓
   POST /api/athlete/create
     ↓
   Upsert Athlete (firebaseId)
     ↓
   Set fiveKPace (via PUT /api/athlete/profile)

2. RACE SELECTION
   POST /api/race/search OR /api/race/create
     ↓
   RaceRegistry created/found
     ↓
   Store raceRegistryId

3. PLAN GENERATION
   POST /api/training-plan/generate
     ├─ Load athlete (read fiveKPace)
     ├─ Load race (read name, distance, date)
     ├─ Calculate totalWeeks
     ├─ generateTrainingPlanAI()
     │   └─ OpenAI generates complete plan
     └─ saveTrainingPlanToDB()
         ├─ Create TrainingPlan
         ├─ Create TrainingPlanFiveKPace (snapshot)
         └─ Create all TrainingDayPlanned records

4. EXECUTION
   TrainingDayPlanned (planned workout)
     ↓
   User completes workout
     ↓
   Create TrainingDayExecuted
     ├─ Manual: activityId = null
     └─ Garmin: activityId = AthleteActivity.id
     ↓
   Compute GoFastScore
     ↓
   Update athlete.fiveKPace (if improved)
```

### Activity Matching Flow

```
Garmin Activity Sync:
  Garmin Webhook → AthleteActivity created
     ↓
  Check for match (by date/time)
     ├─ Auto-match found → Create TrainingDayExecuted
     └─ No match → Store as unmatched
         ↓
     User views unmatched activities
         ↓
     User selects planned day
         ↓
     Create TrainingDayExecuted
         └─ activityId = AthleteActivity.id
```

---

## API Route Mapping

### Athlete Routes
| Route | Method | Purpose | Creates/Updates |
|-------|--------|---------|------------------|
| `/api/athlete/create` | POST | Upsert athlete on sign-in | `Athlete` |
| `/api/athlete/profile` | GET | Get athlete profile | Reads `Athlete` |
| `/api/athlete/profile` | PUT | Update profile | Updates `Athlete.fiveKPace` |
| `/api/athlete/hydrate` | POST | Hydrate athlete data | Reads `Athlete` + relations |

### Race Routes
| Route | Method | Purpose | Creates/Updates |
|-------|--------|---------|------------------|
| `/api/race/search` | POST | Search RaceRegistry | Reads `RaceRegistry` |
| `/api/race/create` | POST | Create race | Creates `RaceRegistry` |

### Training Plan Routes
| Route | Method | Purpose | Creates/Updates |
|-------|--------|---------|------------------|
| `/api/training-plan/generate` | POST | Generate plan | Creates `TrainingPlan`, `TrainingPlanFiveKPace`, `TrainingDayPlanned[]` |
| `/api/training-plan/[id]` | GET | Get plan details | Reads `TrainingPlan` + relations |
| `/api/training-plan/[id]/week/[weekIndex]` | GET | Get week | Reads `TrainingDayPlanned[]` |
| `/api/training/day/[dayId]` | GET | Get day | Reads `TrainingDayPlanned` + `TrainingDayExecuted` |

### Training Execution Routes
| Route | Method | Purpose | Creates/Updates |
|-------|--------|---------|------------------|
| `/api/training/hub` | GET | Get hub data | Reads `TrainingPlan`, `TrainingDayPlanned`, `TrainingDayExecuted` |
| `/api/training/match/[dayId]` | POST | Match activity | Creates `TrainingDayExecuted` |

### Garmin Routes
| Route | Method | Purpose | Creates/Updates |
|-------|--------|---------|------------------|
| `/api/auth/garmin/authorize` | GET | Start OAuth | Updates `Athlete` (tokens) |
| `/api/auth/garmin/callback` | GET | OAuth callback | Updates `Athlete` (tokens) |
| `/api/garmin/webhook` | POST | Receive activities | Creates `AthleteActivity` |

---

## Business Logic Mapping

### Plan Generation
- **File**: `lib/training/plan-generator.ts`
- **Function**: `generateTrainingPlanAI()`
- **Input**: `TrainingInputs` (raceName, raceDistance, goalTime, fiveKPace, totalWeeks)
- **Output**: `GeneratedPlan` (weeks[] with days[])
- **Database**: Creates `TrainingPlan`, `TrainingPlanFiveKPace`, `TrainingDayPlanned[]`

### Plan Saving
- **File**: `lib/training/save-plan.ts`
- **Function**: `saveTrainingPlanToDB()`
- **Process**: Transaction creates plan + snapshot + all days
- **Date Calculation**: Uses `calculateTrainingDayDate()`

### Date Calculation
- **File**: `lib/training/dates.ts`
- **Function**: `calculateTrainingDayDate(planStartDate, weekIndex, dayIndex)`
- **Formula**: `((weekIndex - 1) * 7) + (dayIndex - 1)` days from start

### Activity Matching
- **File**: `lib/services/match-logic.ts`
- **Purpose**: Match `AthleteActivity` to `TrainingDayPlanned`
- **Strategy**: Date/time proximity matching
- **Result**: Creates `TrainingDayExecuted` with `activityId`

### Analysis & Scoring
- **File**: `lib/services/analysis.ts`
- **Functions**:
  - `computeGoFastScore()` - Calculates workout quality score
  - `updateFiveKPace()` - Updates `Athlete.fiveKPace` based on performance
- **Storage**: Stores score in `TrainingDayExecuted.analysis` (JSON)

---

## Missing Implementations

### 1. TrainingDayExecuted Creation API
- **Missing**: Direct API to create `TrainingDayExecuted` for manual entry
- **Current**: Only via activity matching
- **Needed**: `POST /api/training/day/[dayId]/complete` for manual completion

### 2. Unmatched Activities API
- **Missing**: API to list unmatched `AthleteActivity` records
- **Current**: No endpoint to view unmatched activities
- **Needed**: `GET /api/training/activities/unmatched`

### 3. Weekly Aggregation
- **Missing**: API to aggregate weekly execution data
- **Current**: No weekly summary endpoint
- **Needed**: `GET /api/training/week/[weekIndex]/summary`

### 4. Race Readiness Calculation
- **Missing**: Complete algorithm for race readiness
- **Current**: Placeholder in `/api/training/hub`
- **Needed**: Proper goal pace calculation from `trainingPlanGoalTime` + race distance

### 5. TrainingPlanPreferredDays Usage
- **Missing**: Code to create/use preferred days snapshot
- **Current**: Table exists but unused
- **Needed**: Feature implementation or removal

### 6. Plan Status Transitions
- **Missing**: API to update plan status (`draft` → `active` → `completed`)
- **Current**: Status set during generation, no updates
- **Needed**: `PUT /api/training-plan/[id]/status`

### 7. Multiple Active Plans
- **Missing**: Support for multiple active plans per athlete
- **Current**: Assumes one active plan
- **Needed**: Plan selection/activation logic

---

## Summary

### Schema as Foundation
The Prisma schema (`prisma/schema.prisma`) is the **single source of truth** for:
- Database structure
- Relationships
- Constraints
- Data types

### Documentation Hierarchy
1. **Schema** (`prisma/schema.prisma`) - What exists
2. **Setup Flow** (`docs/TRAINING_PLAN_SETUP_FLOW.md`) - How to create plans
3. **This Document** (`docs/SCHEMA_FIRST_ARCHITECTURE.md`) - Complete system mapping
4. **Implementation Files** - How code uses schema

### Key Architectural Patterns
1. **Snapshot Pattern**: `TrainingPlanFiveKPace` prevents identity drift
2. **Application-Level Linking**: `TrainingDayExecuted` linked by date, not FK
3. **JSON Storage**: `plannedData`, `analysis`, `summaryData` use JSON for flexibility
4. **Single-Tenant**: `: `GoFastCompany` provides isolation
5. **Legacy Support**: `Race` model kept for migration

---

**End of Schema-First Architecture Document**

