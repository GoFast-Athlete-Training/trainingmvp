# Training Plan Setup Flow - Complete Architecture

**Last Updated**: January 2025  
**Status**: MVP1 Implementation  
**Purpose**: Document the complete flow from race selection to training plan generation

---

## Overview

The training plan setup follows a **3-step flow**:
1. **Pick Your Race** - Search or create race in RaceRegistry
2. **Set Your Goals** - Enter goal time (requires fiveKPace in profile)
3. **Build My Plan** - Generate complete training plan via OpenAI

---

## Database Schema Verification

### ✅ RaceRegistry Model (Global Race Catalog)

```prisma
model RaceRegistry {
  id        String   @id @default(cuid())
  name      String                    // Race name (e.g., "Boston Marathon")
  distance  String                    // "marathon", "half", "5k", "10k", etc.
  date      DateTime                  // Race date
  city      String?
  state     String?
  country   String?
  createdBy String                    // athleteId who created it
  isGlobal  Boolean  @default(false) // true = available to all users

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  trainingPlans TrainingPlan[]

  @@map("race_registry")
}
```

**Key Points:**
- ✅ `distance` is a string (not enum) - flexible for any race type
- ✅ `createdBy` tracks who created the race
- ✅ `isGlobal` flag for future public races
- ✅ One race can have multiple training plans (different athletes)

---

### ✅ TrainingPlan Model (Master Container)

```prisma
model TrainingPlan {
  id             String @id @default(cuid())
  athleteId      String
  raceRegistryId String                    // References RaceRegistry (NOT Race)

  // PLAN IDENTITY
  trainingPlanName String                  // e.g., "Boston Marathon Training Plan"

  // CYCLE-LEVEL GOALS
  trainingPlanGoalTime String?              // Goal time (e.g., "3:30:00")

  // PLAN STRUCTURE
  trainingPlanStartDate  DateTime          // When plan starts (usually today)
  trainingPlanTotalWeeks Int               // Total weeks in plan

  // STATUS
  status String @default("draft")         // "draft", "active", "completed"

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  athlete                   Athlete                    @relation(...)
  raceRegistry              RaceRegistry               @relation(...)
  plannedDays               TrainingDayPlanned[]
  trainingPlanFiveKPace     TrainingPlanFiveKPace?     // Snapshot
  trainingPlanPreferredDays TrainingPlanPreferredDays? // UNUSED IN MVP1

  @@map("training_plans")
}
```

**Key Points:**
- ✅ Uses `raceRegistryId` (NOT deprecated `raceId`)
- ✅ `trainingPlanGoalTime` is optional (can be set later)
- ✅ `trainingPlanStartDate` is computed (usually today)
- ✅ `trainingPlanTotalWeeks` calculated from race date
- ✅ Status defaults to "draft", set to "active" after generation

---

### ✅ TrainingPlanFiveKPace (Snapshot Table)

```prisma
model TrainingPlanFiveKPace {
  id             String @id @default(cuid())
  trainingPlanId String
  athleteId      String
  fiveKPace      String                    // mm:ss format - SNAPSHOT at plan creation

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  trainingPlan TrainingPlan @relation(...)
  athlete      Athlete      @relation(...)

  @@unique([trainingPlanId])               // One snapshot per plan
  @@map("training_plan_five_k_pace")
}
```

**Purpose:** Captures athlete's `fiveKPace` at plan creation time. Prevents identity drift - if athlete updates their pace later, old plans still reference the original pace.

---

### ✅ TrainingDayPlanned (Atomic Workout Elements)

```prisma
model TrainingDayPlanned {
  id             String @id @default(cuid())
  trainingPlanId String
  athleteId      String

  // Day Identification
  weekIndex Int                              // 1-based (first week is 1)
  dayIndex  Int                              // 1-7 (1=Monday, 7=Sunday)
  phase     String                           // "base", "build", "peak", "taper"

  // Computed date (calculated by backend, not from AI)
  date      DateTime

  // PLANNED WORKOUT (atomic element)
  plannedData Json                            // Contains: type, mileage, paceRange, etc.

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  trainingPlan TrainingPlan @relation(...)
  athlete      Athlete      @relation(...)

  @@unique([trainingPlanId, weekIndex, dayIndex])
  @@map("training_days_planned")
}
```

**Key Points:**
- ✅ `dayIndex` is **1-7** (1=Monday, 7=Sunday) - **NOT 0-6**
- ✅ `weekIndex` is **1-based** (first week is 1, not 0)
- ✅ `date` is **computed by backend** using `calculateTrainingDayDate()` - NOT from AI
- ✅ `plannedData` is JSON containing workout details

---

### ✅ Athlete Model (Profile Identity)

```prisma
model Athlete {
  // ... other fields ...

  // Profile Identity (can be updated)
  fiveKPace String?                          // mm:ss format - THE SOURCE OF TRUTH for 5K pace

  // Relations
  trainingPlans             TrainingPlan[]
  trainingPlanFiveKPaces    TrainingPlanFiveKPace[]

  @@map("athletes")
}
```

**Key Points:**
- ✅ `fiveKPace: String?` - **THE SOURCE OF TRUTH** (mm:ss format, e.g. "8:30")
- ✅ Required for plan generation (validated in `/api/training-plan/generate`)
- ✅ Can be updated via `/api/athlete/profile` (PUT)

---

## Complete Setup Flow

### Step 1: Pick Your Race (RaceRegistry)

**Purpose:** User selects or creates a race from the global catalog.

#### Option A: Search Existing Race

**Endpoint:** `POST /api/race/search`

**Request:**
```json
{
  "query": "Boston Marathon"
}
```

**Response:**
```json
{
  "success": true,
  "races": [
    {
      "id": "race_123",
      "name": "Boston Marathon",
      "distance": "marathon",
      "date": "2025-04-21T00:00:00Z",
      "city": "Boston",
      "state": "MA",
      "country": "USA"
    }
  ]
}
```

**Implementation:**
- Fuzzy search by name (case-insensitive, partial match)
- Returns up to 20 results
- Ordered by date (ascending)
- No auth required (public catalog)

---

#### Option B: Create New Race

**Endpoint:** `POST /api/race/create`

**Request:**
```json
{
  "name": "My Local 5K",
  "distance": "5k",
  "date": "2025-06-15T00:00:00Z",
  "city": "Arlington",
  "state": "VA",
  "country": "USA"
}
```

**Response:**
```json
{
  "success": true,
  "race": {
    "id": "race_456",
    "name": "My Local 5K",
    "distance": "5k",
    "date": "2025-06-15T00:00:00Z",
    "city": "Arlington",
    "state": "VA",
    "country": "USA"
  }
}
```

**Implementation:**
- Auth required (Firebase token)
- `createdBy` set to authenticated athleteId
- `isGlobal` defaults to `false` (user's private race)
- Returns created race object

**Validation:**
- `name`, `distance`, `date` are required
- `city`, `state`, `country` are optional

---

### Step 2: Set Your Goals

**Purpose:** User sets goal time for the race. Requires `fiveKPace` in profile.

#### Prerequisite: Set 5K Pace (Profile)

**Endpoint:** `PUT /api/athlete/profile`

**Request:**
```json
{
  "fiveKPace": "8:30"
}
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "fiveKPace": "8:30",
    // ... other profile fields
  }
}
```

**Implementation:**
- Updates `Athlete.fiveKPace` in database
- Format: `mm:ss` (e.g., "8:30" = 8 minutes 30 seconds per mile)
- **REQUIRED** before plan generation

---

#### Save Training Setup (Optional - MVP1)

**Endpoint:** `POST /api/training-setup/save`

**Request:**
```json
{
  "raceRegistryId": "race_123",
  "goalTime": "3:30:00"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Training setup saved",
  "raceRegistryId": "race_123",
  "goalTime": "3:30:00"
}
```

**Implementation:**
- **MVP1**: This endpoint exists but doesn't persist data
- Validates race exists
- Returns success (plan generation happens separately)
- **Future**: Could store setup in a separate table for multi-step flows

**Note:** In MVP1, this is optional. User can go directly to plan generation.

---

### Step 3: Build My Plan (Generate Training Plan)

**Endpoint:** `POST /api/training-plan/generate`

**Request:**
```json
{
  "raceRegistryId": "race_123",
  "goalTime": "3:30:00"
}
```

**Response:**
```json
{
  "success": true,
  "trainingPlanId": "plan_789",
  "totalWeeks": 16
}
```

**Implementation Flow:**

1. **Validate Inputs:**
   - `raceRegistryId` and `goalTime` are required
   - Athlete must exist (from Firebase token)
   - Athlete must have `fiveKPace` set

2. **Load Data:**
   - Get athlete (read `fiveKPace`)
   - Get race from RaceRegistry (read `name`, `distance`, `date`)

3. **Calculate Plan Parameters:**
   - `planStartDate` = today (normalized to midnight)
   - `raceDate` = race.date (normalized to midnight)
   - `daysUntilRace` = raceDate - planStartDate
   - `totalWeeks` = max(8, floor(daysUntilRace / 7)) // Minimum 8 weeks

4. **Generate Plan via OpenAI:**
   ```typescript
   const plan = await generateTrainingPlanAI({
     raceName: race.name,
     raceDistance: race.distance,
     goalTime: "3:30:00",
     fiveKPace: athlete.fiveKPace, // e.g., "8:30"
     totalWeeks: 16
   });
   ```

5. **Save Plan to Database:**
   ```typescript
   const trainingPlanId = await saveTrainingPlanToDB(
     athleteId,
     raceRegistryId,
     planStartDate,
     plan,
     race.name,
     goalTime,
     athlete.fiveKPace
   );
   ```

**What Gets Created:**

1. **TrainingPlan Record:**
   - `id`: Generated CUID
   - `athleteId`: From Firebase token
   - `raceRegistryId`: From request
   - `trainingPlanName`: `${raceName} Training Plan`
   - `trainingPlanGoalTime`: From request
   - `trainingPlanStartDate`: Today
   - `trainingPlanTotalWeeks`: Calculated
   - `status`: "active"

2. **TrainingPlanFiveKPace Snapshot:**
   - `trainingPlanId`: Links to plan
   - `athleteId`: Links to athlete
   - `fiveKPace`: Snapshot of `athlete.fiveKPace` at creation

3. **All TrainingDayPlanned Records:**
   - One record per day in plan
   - `weekIndex`: 1 to `totalWeeks`
   - `dayIndex`: 1-7 (Monday-Sunday)
   - `phase`: "base", "build", "peak", or "taper"
   - `date`: Computed using `calculateTrainingDayDate()`
   - `plannedData`: JSON from OpenAI (type, mileage, paceRange, etc.)

**Date Calculation:**
```typescript
// Formula: ((weekIndex - 1) * 7) + (dayIndex - 1) days from planStartDate
// Example: weekIndex 1, dayIndex 1 = day 0 (first Monday)
//          weekIndex 1, dayIndex 2 = day 1 (first Tuesday)
//          weekIndex 2, dayIndex 1 = day 7 (second Monday)
const computedDate = calculateTrainingDayDate(planStartDate, weekIndex, dayIndex);
```

---

## OpenAI Plan Generation

### Input Contract

```typescript
interface TrainingInputs {
  raceName: string;        // e.g., "Boston Marathon"
  raceDistance: string;     // e.g., "marathon"
  goalTime: string;         // e.g., "3:30:00"
  fiveKPace: string;        // e.g., "8:30" (mm:ss per mile)
  totalWeeks: number;       // e.g., 16
}
```

### Output Contract

```typescript
interface GeneratedPlan {
  totalWeeks: number;
  weeks: Week[];
}

interface Week {
  weekIndex: number;        // 1-based (first week is 1)
  phase: string;            // "base", "build", "peak", "taper"
  days: WeekDay[];
}

interface WeekDay {
  dayIndex: number;         // 1-7 (1=Monday, 7=Sunday)
  plannedData: {
    type: string;           // "easy", "tempo", "intervals", "long_run", "rest"
    mileage: number;        // e.g., 4
    paceRange?: string;     // e.g., "8:30-9:00"
    targetPace?: string;    // e.g., "8:45"
    hrZone?: string;        // e.g., "2"
    hrRange?: string;       // e.g., "130-150"
    segments?: Array<{      // For interval workouts
      type: string;
      distance?: number;
      duration?: number;
      pace?: string;
      reps?: number;
    }>;
    label?: string;         // e.g., "Easy Run"
    description?: string;   // e.g., "Comfortable pace, conversational"
    coachNotes?: string;
  };
}
```

### Phase Distribution

- **Base Phase**: ~25% of total weeks (foundation building, easy runs)
- **Build Phase**: ~35% of total weeks (gradual mileage increase, tempo runs)
- **Peak Phase**: ~20% of total weeks (highest mileage, race-specific workouts)
- **Taper Phase**: Remaining weeks (reduce mileage 30% per week, maintain intensity)

### Critical Rules

- ✅ **NO dates** - OpenAI doesn't generate dates, backend computes them
- ✅ **dayIndex MUST be 1-7** (1=Monday, 7=Sunday)
- ✅ **weekIndex starts at 1** (first week is 1, not 0)
- ✅ **Each week MUST have exactly 7 days** (dayIndex 1 through 7)
- ✅ **Generate ALL weeks** from weekIndex 1 to `totalWeeks`
- ✅ **Include rest days** appropriately
- ✅ **Progress mileage** gradually
- ✅ **Match phases to weeks** correctly

---

## Frontend Flow Requirements

### Complete User Journey

```
1. User lands on Training page (home/dashboard)
   ├─ Check if athlete has active plan
   │   ├─ Has plan → Show training hub
   │   └─ No plan → Show "Set Up Training" button
   │
2. User clicks "Set Up Training" → Training Setup Flow
   │
3. Step 1: Pick Your Race
   ├─ Search races: POST /api/race/search
   ├─ OR Create race: POST /api/race/create
   └─ Select race → Store raceRegistryId
   │
4. Step 2: Set Your Goals
   ├─ Check if fiveKPace exists in profile
   │   ├─ Missing → Prompt to set 5K pace first
   │   │   └─ PUT /api/athlete/profile { fiveKPace: "8:30" }
   │   └─ Exists → Continue
   ├─ Enter goal time (e.g., "3:30:00")
   └─ Optional: POST /api/training-setup/save (MVP1 doesn't persist)
   │
5. Step 3: Build My Plan
   ├─ POST /api/training-plan/generate
   │   Body: { raceRegistryId, goalTime }
   ├─ Show loading state (OpenAI generation takes time)
   ├─ On success → Redirect to Training Hub
   └─ On error → Show error message
```

---

## API Endpoints Summary

### Race Management

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/race/search` | POST | ❌ No | Search RaceRegistry by name |
| `/api/race/create` | POST | ✅ Yes | Create new race in RaceRegistry |

### Profile Management

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/athlete/profile` | GET | ✅ Yes | Get athlete profile |
| `/api/athlete/profile` | PUT | ✅ Yes | Update profile (including fiveKPace) |

### Training Setup

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/training-setup/save` | POST | ✅ Yes | Save race + goal (MVP1: validation only) |
| `/api/training-plan/generate` | POST | ✅ Yes | Generate complete training plan |

---

## Data Validation Requirements

### Before Plan Generation

**Required:**
- ✅ Athlete exists (from Firebase token)
- ✅ `athlete.fiveKPace` is set (not null)
- ✅ Race exists in RaceRegistry
- ✅ `raceRegistryId` and `goalTime` provided in request
- ✅ Race date is in the future
- ✅ At least 8 weeks until race date

**Validation Errors:**
- `400`: Missing `raceRegistryId` or `goalTime`
- `400`: Athlete must have `fiveKPace` set
- `404`: Race not found
- `400`: Race date must be at least 8 weeks away

---

## Error Handling

### Common Errors

**1. Missing fiveKPace:**
```json
{
  "success": false,
  "error": "Athlete must have fiveKPace set in profile"
}
```
**Frontend Action:** Prompt user to set 5K pace first

**2. Race Not Found:**
```json
{
  "success": false,
  "error": "Race not found"
}
```
**Frontend Action:** Show error, allow user to search/create again

**3. Insufficient Time:**
```json
{
  "success": false,
  "error": "Race date must be at least 8 weeks away"
}
```
**Frontend Action:** Show error, suggest different race or date

**4. OpenAI Generation Failed:**
```json
{
  "success": false,
  "error": "Failed to generate training plan",
  "details": "..."
}
```
**Frontend Action:** Show error, allow retry

---

## Frontend Components Needed

### 1. Training Home/Dashboard (`/training`)

**Purpose:** Main landing page after welcome

**States:**
- **Has Active Plan:** Show training hub (today's workout, progress, etc.)
- **No Plan:** Show "Set Up Training" button → `/training-setup`

**API Calls:**
- `GET /api/training/hub` - Check for active plan

---

### 2. Training Setup Flow (`/training-setup`)

**Purpose:** Multi-step form for plan setup

**Steps:**
1. **Pick Race** - Search/create race
2. **Set Goals** - Enter goal time (validate fiveKPace exists)
3. **Build Plan** - Generate plan (show loading, handle errors)

**API Calls:**
- `POST /api/race/search` - Search races
- `POST /api/race/create` - Create race
- `GET /api/athlete/profile` - Check fiveKPace
- `PUT /api/athlete/profile` - Set fiveKPace if missing
- `POST /api/training-plan/generate` - Generate plan

---

## Database State After Plan Generation

### Example: 16-Week Marathon Plan

**TrainingPlan (1 record):**
```json
{
  "id": "plan_789",
  "athleteId": "athlete_123",
  "raceRegistryId": "race_456",
  "trainingPlanName": "Boston Marathon Training Plan",
  "trainingPlanGoalTime": "3:30:00",
  "trainingPlanStartDate": "2025-01-06T00:00:00Z",
  "trainingPlanTotalWeeks": 16,
  "status": "active"
}
```

**TrainingPlanFiveKPace (1 record):**
```json
{
  "id": "snapshot_001",
  "trainingPlanId": "plan_789",
  "athleteId": "athlete_123",
  "fiveKPace": "8:30"
}
```

**TrainingDayPlanned (112 records):**
- 16 weeks × 7 days = 112 days
- Each with `weekIndex` (1-16), `dayIndex` (1-7), `phase`, `date`, `plannedData`

---

## Next Steps for Frontend

1. **Create `/training-setup` page** with 3-step flow
2. **Update `/training` page** to show setup button if no plan
3. **Add race search UI** (search input + results list)
4. **Add race creation form** (name, distance, date, location)
5. **Add goal time input** (with validation)
6. **Add plan generation UI** (loading state, error handling)
7. **Add 5K pace setup** (if missing from profile)

---

## Testing Checklist

- [ ] Search returns races matching query
- [ ] Create race saves to RaceRegistry
- [ ] Profile update sets fiveKPace
- [ ] Plan generation requires fiveKPace
- [ ] Plan generation creates all records
- [ ] Dates are computed correctly
- [ ] weekIndex starts at 1
- [ ] dayIndex is 1-7
- [ ] Snapshot captures fiveKPace at creation
- [ ] Plan status is "active" after generation

---

**End of Training Plan Setup Flow Documentation**

