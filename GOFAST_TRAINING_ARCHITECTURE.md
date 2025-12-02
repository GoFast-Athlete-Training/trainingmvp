# TrainingMVP Architecture Document

## Current State Analysis

### Overview
The `trainingmvp` repository is a self-contained Next.js 14 training module that provides a complete training plan management system. Authentication and onboarding are now implemented, mirroring the `gofastapp-mvp` pattern.

## Database Schema - ACTUAL MODELS

### Athlete Model (Complete Structure)

```prisma
model Athlete {
  id         String @id @default(cuid())
  
  // Auth
  firebaseId String @unique
  email      String?

  // Company Link (Single-tenant) - REQUIRED
  companyId String
  company   GoFastCompany @relation(fields: [companyId], references: [id])

  // Universal profile
  firstName    String?
  lastName     String?
  gofastHandle String?  @unique
  photoURL     String?
  phoneNumber  String?
  birthday     DateTime?
  gender       String?
  city         String?
  state        String?
  primarySport String?
  bio          String?
  instagram    String?

  // Canonical Identity (can be updated)
  canonicalFiveKPace  String? // mm:ss format - THE SOURCE OF TRUTH
  preferredRunDays    Int[]   // e.g. [1,3,5] where 1=Monday, 7=Sunday (empty array if not set)

  // Legacy training fields (deprecated, keep for migration)
  myCurrentPace       String?  // ⚠️ DEPRECATED - use canonicalFiveKPace
  myWeeklyMileage     Int?
  myTrainingGoal      String?
  myTrainingStartDate DateTime?
  myTargetRace        String?
  preferredDistance   String?
  myPaceRange         String?
  timePreference      String?
  myRunningGoals      String?

  // Garmin PKCE Integration
  garmin_user_id         String?  @unique
  garmin_access_token    String?
  garmin_refresh_token   String?
  garmin_expires_in      Int?
  garmin_scope           String?
  garmin_connected_at     DateTime?
  garmin_last_sync_at    DateTime?
  garmin_is_connected     Boolean  @default(false)
  garmin_disconnected_at  DateTime?
  garmin_permissions      Json?
  garmin_user_profile     Json?
  garmin_user_sleep       Json?
  garmin_user_preferences Json?

  // Strava (future)
  strava_id             Int?     @unique
  strava_access_token   String?
  strava_refresh_token  String?
  strava_expires_at     Int?

  // System fields
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  trainingPlans              TrainingPlan[]
  plannedDays                TrainingDayPlanned[]
  executedDays               TrainingDayExecuted[]
  activities                 AthleteActivity[]
  trainingPlanFiveKPaces     TrainingPlanFiveKPace[]      // Junction table relation
  trainingPlanPreferredDays  TrainingPlanPreferredDays[] // Junction table relation

  @@map("athletes")
}
```

**Key Points:**
- ✅ `canonicalFiveKPace: String?` - **THE CANONICAL 5K PACE** (mm:ss format, e.g. "8:30")
- ✅ `preferredRunDays: Int[]` - **THE CANONICAL PREFERRED DAYS** (1-7, where 1=Monday, 7=Sunday)
- ⚠️ `myCurrentPace: String?` - **LEGACY FIELD** - kept for migration, should use `canonicalFiveKPace` instead
- ✅ Relations to snapshot junction tables: `trainingPlanFiveKPaces` and `trainingPlanPreferredDays`

---

### Snapshot Junction Tables (Plan-Specific Identity)

#### TrainingPlanFiveKPace (Snapshot Table)

```prisma
model TrainingPlanFiveKPace {
  id            String @id @default(cuid())
  trainingPlanId String
  athleteId      String
  fiveKPace      String // mm:ss format - SNAPSHOT at plan creation time

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  trainingPlan TrainingPlan @relation(fields: [trainingPlanId], references: [id], onDelete: Cascade)
  athlete      Athlete      @relation(fields: [athleteId], references: [id], onDelete: Cascade)

  @@unique([trainingPlanId])  // One snapshot per plan
  @@map("training_plan_five_k_pace")
}
```

**Purpose:** Captures the athlete's `canonicalFiveKPace` at the moment the plan was created. Prevents identity drift - if athlete updates their canonical pace later, old plans still reference the original pace.

---

#### TrainingPlanPreferredDays (Snapshot Table)

```prisma
model TrainingPlanPreferredDays {
  id            String @id @default(cuid())
  trainingPlanId String
  athleteId      String
  preferredDays  Int[] // e.g. [1,3,5] where 1=Monday, 7=Sunday - SNAPSHOT at plan creation

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  trainingPlan TrainingPlan @relation(fields: [trainingPlanId], references: [id], onDelete: Cascade)
  athlete      Athlete      @relation(fields: [athleteId], references: [id], onDelete: Cascade)

  @@unique([trainingPlanId])  // One snapshot per plan
  @@map("training_plan_preferred_days")
}
```

**Purpose:** Captures the athlete's `preferredRunDays` at the moment the plan was created. Prevents identity drift - if athlete updates their preferred days later, old plans still reference the original days.

---

### RaceRegistry Model (Global Race Catalog)

```prisma
model RaceRegistry {
  id        String   @id @default(cuid())
  name      String
  distance  String   // "marathon", "half", "5k", "10k", etc.
  date      DateTime
  city      String?
  state     String?
  country   String?
  createdBy String   // athleteId who created it
  isGlobal  Boolean  @default(false) // true = available to all users

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  trainingPlans TrainingPlan[]

  @@map("race_registry")
}
```

**Purpose:** Global catalog of races. Users can create their own races, and future global races can be added. Replaces the deprecated `Race` model.

---

### TrainingPlan Model (Master Container)

```prisma
model TrainingPlan {
  id        String @id @default(cuid())
  athleteId String
  raceRegistryId String // References RaceRegistry (NOT Race)

  // PLAN IDENTITY
  trainingPlanName String

  // CYCLE-LEVEL GOALS
  trainingPlanGoalTime String?

  // PLAN STRUCTURE
  trainingPlanStartDate  DateTime
  trainingPlanTotalWeeks Int

  // STATUS
  status String @default("draft")

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  athlete                Athlete                 @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  raceRegistry           RaceRegistry            @relation(fields: [raceRegistryId], references: [id], onDelete: Cascade)
  plannedDays            TrainingDayPlanned[]
  trainingPlanFiveKPace  TrainingPlanFiveKPace?  // Optional snapshot (one per plan)
  trainingPlanPreferredDays TrainingPlanPreferredDays? // Optional snapshot (one per plan)

  @@map("training_plans")
}
```

**Key Points:**
- ✅ Uses `raceRegistryId` (NOT `raceId`)
- ✅ Has optional relations to snapshot tables
- ❌ **REMOVED:** `trainingPlanBaseline5k`, `trainingPlanBaselineWeeklyMileage`, `trainingPlanAdaptive5kTime` - these live in snapshot tables or canonical fields

---

### TrainingDayPlanned Model (Atomic Workout Elements)

```prisma
model TrainingDayPlanned {
  id             String  @id @default(cuid())
  trainingPlanId String
  athleteId      String

  // Day Identification
  weekIndex Int
  dayIndex  Int  // MUST be 1-7 (1=Monday, 7=Sunday) - NOT 0-6
  phase     String // "base", "build", "peak", "taper"

  // Computed date (calculated by backend, not from AI)
  date      DateTime

  // PLANNED WORKOUT (atomic element)
  plannedData Json  // Contains: type, mileage, paceRange, targetPace, hrZone, segments, etc.

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  trainingPlan TrainingPlan @relation(fields: [trainingPlanId], references: [id], onDelete: Cascade)
  athlete      Athlete      @relation(fields: [athleteId], references: [id], onDelete: Cascade)

  @@unique([trainingPlanId, weekIndex, dayIndex])
  @@map("training_days_planned")
}
```

**Key Points:**
- ✅ `dayIndex` is **1-7** (1=Monday, 7=Sunday) - **NOT 0-6**
- ✅ `date` is **computed by backend** using `calculateTrainingDayDate()` - NOT from AI
- ❌ **REMOVED:** `dayName` field - use `getDayName(dayIndex)` utility instead
- ✅ `plannedData` is JSON containing workout details

---

### TrainingDayExecuted Model (Execution Records)

```prisma
model TrainingDayExecuted {
  id        String @id @default(cuid())
  athleteId String

  // THE LINK - shell container for AthleteActivity
  activityId String? @unique  // Links to AthleteActivity if matched

  // Optional metadata
  weekIndex Int
  dayIndex  Int
  date      DateTime

  // Snapshot/computed fields
  plannedData Json?  // Snapshot of planned workout
  analysis    Json?  // GoFastScore and analysis
  feedback    Json?  // User feedback

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  athlete Athlete @relation(fields: [athleteId], references: [id], onDelete: Cascade)

  @@map("training_days_executed")
}
```

**Key Points:**
- ✅ Links to `AthleteActivity` via `activityId` (optional - can be manual entry)
- ✅ Contains snapshot of `plannedData` at execution time
- ✅ Stores analysis results (GoFastScore) in `analysis` JSON field
- ❌ **NO relation to TrainingPlan** - standalone execution record

---

### GoFastCompany Model (Single-Tenant Container)

```prisma
model GoFastCompany {
  id           String      @id @default(cuid())
  name         String
  slug         String      @unique
  address      String?
  city         String?
  state        String?
  zip          String?
  domain       String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  athletes     Athlete[]

  @@map("go_fast_companies")
}
```

**Purpose:** Single-tenant architecture. All athletes belong to a company (default: "gofast").

---

### Legacy Race Model (Deprecated)

```prisma
// Legacy Race model - deprecated, use RaceRegistry instead
model Race {
  id String @id @default(cuid())

  // Race Event Details
  raceName      String
  raceType      String
  raceDate      DateTime
  location      String?
  distanceMiles Float

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations (deprecated - no new plans should use this)
  // trainingPlans TrainingPlan[] // Removed - use RaceRegistry instead

  @@map("races")
}
```

**Status:** ⚠️ **DEPRECATED** - Still exists in schema but should not be used. Use `RaceRegistry` instead.

---

## 5K Pace Architecture - How It Works

### Canonical vs Plan-Specific

**Canonical (Athlete Level):**
- `Athlete.canonicalFiveKPace: String?` - **THE SOURCE OF TRUTH**
- Updated when athlete improves (via analysis service)
- Used as input when creating NEW training plans
- Can be manually updated by athlete in profile settings

**Plan-Specific (Snapshot):**
- `TrainingPlanFiveKPace.fiveKPace: String` - **SNAPSHOT AT PLAN CREATION**
- Captured when plan is created
- Never changes after plan creation
- Used for historical accuracy and race readiness calculations

### Flow Example

1. **Athlete creates profile:**
   - Sets `canonicalFiveKPace = "8:30"`

2. **Athlete creates training plan:**
   - System reads `canonicalFiveKPace = "8:30"`
   - Creates `TrainingPlanFiveKPace` snapshot with `fiveKPace = "8:30"`
   - Plan is generated using this pace

3. **Athlete completes workouts:**
   - Analysis service updates `canonicalFiveKPace = "8:25"` (improved)
   - **BUT** `TrainingPlanFiveKPace.fiveKPace` stays `"8:30"` (snapshot)

4. **Athlete creates NEW plan:**
   - System reads NEW `canonicalFiveKPace = "8:25"`
   - Creates NEW snapshot with `fiveKPace = "8:25"`
   - Old plan still references `"8:30"` (historical accuracy)

---

## Preferred Run Days Architecture

### Canonical vs Plan-Specific

**Canonical (Athlete Level):**
- `Athlete.preferredRunDays: Int[]` - **THE SOURCE OF TRUTH**
- Example: `[1, 3, 5]` = Monday, Wednesday, Friday
- Updated when athlete changes preferences
- Used as input when creating NEW training plans

**Plan-Specific (Snapshot):**
- `TrainingPlanPreferredDays.preferredDays: Int[]` - **SNAPSHOT AT PLAN CREATION**
- Captured when plan is created
- Never changes after plan creation
- Used to show what days the plan was originally designed for

---

## Complete Model Relationships

```
Athlete (canonical identity)
  ├─ canonicalFiveKPace: "8:30"
  ├─ preferredRunDays: [1,3,5]
  │
  ├─→ TrainingPlan (plan container)
  │     ├─ raceRegistryId → RaceRegistry
  │     ├─→ TrainingPlanFiveKPace (snapshot: "8:30")
  │     ├─→ TrainingPlanPreferredDays (snapshot: [1,3,5])
  │     └─→ TrainingDayPlanned[] (all planned workouts)
  │
  ├─→ TrainingDayExecuted[] (completed workouts)
  │     └─→ activityId → AthleteActivity (if matched)
  │
  └─→ AthleteActivity[] (Garmin activities)
```

---

## Current State Analysis

### Current Architecture

#### 1. **Authentication Status: ✅ IMPLEMENTED**

**Current Implementation:**
- ✅ Firebase authentication (client + admin)
- ✅ User session management with Firebase tokens
- ✅ Auth guards on protected routes
- ✅ Server-side token verification
- ✅ Secure API routes (athleteId from token, not query params)

**Code Locations:**
- `lib/firebase.ts` - Firebase client initialization
- `lib/firebaseAdmin.ts` - Firebase admin (server-side token verification)
- `lib/auth.ts` - Client-side auth helpers (signInWithGoogle, getToken)
- `app/api/athlete/create/route.ts` - Upsert athlete by Firebase ID
- `app/api/athlete/hydrate/route.ts` - Hydrate athlete data
- `app/signup/page.tsx` - Firebase Google/Email sign-in
- `app/page.tsx` - Splash screen with auth state check
- `app/training/page.tsx` - Auth guard + onboarding check

**Flow:**
1. User signs in with Google/Email → Firebase auth
2. Get Firebase token → call `/api/athlete/create` (upsert)
3. Check if athlete has completed onboarding (`myTargetRace` field)
4. Route to `/onboarding` if new, `/training` if completed
5. Server-side: verify Firebase token → get athleteId from database

#### 2. **Training Plan Setup Status: ✅ IMPLEMENTED (as "onboarding")**

**Current Implementation:**
- ✅ Multi-step setup flow (`/onboarding` - needs rename to `/training-setup`)
- ✅ Collects race information (name, type, goal time, current 5K)
- ✅ Calculates goal pace automatically
- ✅ OpenAI-powered inference generation
- ✅ Saves setup data to Athlete and Race tables
- ⚠️ **TODO**: Create training plan automatically after setup

**Code Locations:**
- `app/onboarding/page.tsx` - 3-step setup UI (needs rename)
- `app/api/onboarding/inference/route.ts` - OpenAI inference generation (needs move)
- `app/api/onboarding/save/route.ts` - Save setup data (needs move)
- `lib/utils/pace.ts` - Goal pace calculation utilities

**Setup Flow:**
1. **Step 1 - Form**: Race name, race type, goal time, current 5K pace
   - Goal pace automatically calculated from goal time and race distance
2. **Step 2 - Dialogue**: 
   - "How well do you feel you did your last race?"
   - "Have you trained before?"
3. **Step 3 - Review**: 
   - Shows collected data
   - Displays AI-generated inference
   - Save button to persist to database
   - **TODO**: Auto-create training plan after save

**Data Saved:**
- `Athlete.myTargetRace` - Race name
- `Athlete.myTrainingGoal` - Goal time
- `Athlete.myCurrentPace` - Current 5K pace per mile
- `Race` record created/found in database
- **Missing**: Auto-create `TrainingPlan` and `TrainingDayPlanned` records

#### 3. **Local Storage: ✅ IMPLEMENTED**

**Current State:**
- ✅ localStorage API (`lib/localstorage.ts`)
- ✅ Athlete data persistence
- ✅ Hydration mechanism
- ✅ Caches athlete data between sessions

**Implementation:**
- `LocalStorageAPI.setAthlete()` - Store athlete data
- `LocalStorageAPI.getAthlete()` - Retrieve athlete data
- `LocalStorageAPI.setHydrationTimestamp()` - Track hydration freshness
- Used throughout app for quick access to athlete data

#### 3. **Lib Structure: ⚠️ NEEDS REORGANIZATION BY DOMAIN**

**Current Structure (Needs Refactoring):**
```
lib/
  prisma.ts              ✅ Basic Prisma client
  firebase.ts            ✅ Firebase client initialization
  firebaseAdmin.ts       ✅ Firebase admin (server-side)
  auth.ts                ✅ Client-side Firebase auth helpers
  localstorage.ts        ✅ LocalStorage API
  domain-athlete.ts      ✅ Athlete domain functions
  api.ts                 ✅ API client with token injection
  api-helpers.ts         ✅ Server-side auth helpers
  services/
    analysis.ts          ✅ GoFastScore computation
    extraction.ts        ✅ OpenAI extraction
    match-logic.ts        ✅ Garmin matching (should move to activity-matching)
    plan-generator.ts    ✅ AI plan generation (should move to training-setup)
  utils/
    dates.ts             ✅ Date utilities
    pace.ts              ✅ Pace calculations (includes goal pace calc)
```

**Proposed Structure (By Domain):**
```
lib/
  # Core Infrastructure
  prisma.ts
  firebase.ts
  firebaseAdmin.ts
  auth.ts
  localstorage.ts
  domain-athlete.ts
  api.ts
  api-helpers.ts
  
  # Domain 1: Training Plan Setup
  training-setup/
    index.ts              - Main setup functions
    validate.ts            - Validate setup completeness
    create-plan.ts         - Create plan from setup data
    inference.ts           - OpenAI insights generation
  
  # Domain 2: Training Plan Execution
  training-execution/
    index.ts              - Execution tracking
    get-todays-workout.ts - Get today's planned workout
    mark-complete.ts       - Mark workout as executed
    progress.ts            - Calculate progress metrics
  
  # Domain 3: Activity Matching
  activity-matching/
    index.ts              - Matching functions
    sync.ts                - Sync from Garmin
    auto-match.ts          - Auto-match algorithms
    manual-match.ts        - Manual matching logic
    unmatched.ts           - Get unmatched activities
  
  # Domain 4: Training Plan Review
  training-review/
    index.ts              - Review generation
    weekly.ts              - Weekly review data
    feedback.ts            - Feedback submission
    metrics.ts              - Adaptive metrics calculation
  
  # Shared Services
  services/
    analysis.ts            - GoFastScore, adaptive metrics (used by execution & review)
    extraction.ts          - OpenAI extraction utilities
  
  # Shared Utilities
  utils/
    dates.ts
    pace.ts
```

**Missing Libraries:**
- ❌ `lib/training-setup/` - Complete setup domain
- ❌ `lib/training-execution/` - Execution tracking domain
- ❌ `lib/activity-matching/` - Activity matching domain (separate from execution)
- ❌ `lib/training-review/` - Weekly review domain

#### 4. **API Route Pattern: ✅ IMPLEMENTED**

**Current Pattern:**
```typescript
// app/api/training/hub/route.ts
import { getAthleteIdFromRequest } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
  const athleteId = await getAthleteIdFromRequest(request);
  // Use athleteId for queries...
}
```

**Implementation:**
- ✅ Auth token verification via `getAthleteIdFromRequest()`
- ✅ Server-side athlete resolution from Firebase token
- ✅ Secure - no client-passed athleteId
- ✅ No test ID fallback

**Auth Helper:**
```typescript
// lib/api-helpers.ts
export async function getAthleteIdFromRequest(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('No auth token');
  const decoded = await verifyFirebaseIdToken(token);
  const athlete = await getAthleteByFirebaseId(decoded.uid);
  return athlete.id;
}
```

#### 5. **Page Components: ✅ AUTH CHECKS IMPLEMENTED**

**Current Flow:**
1. `app/page.tsx` (splash) → checks Firebase auth state → routes to `/signup` or `/training`
2. `app/signup/page.tsx` → Firebase Google/Email sign-in → creates/upserts athlete → routes based on onboarding status
3. `app/onboarding/page.tsx` → collects race info → generates inference → saves data
4. `app/training/page.tsx` → auth guard + onboarding check → redirects if needed → loads training data

**Auth Guards:**
- ✅ Firebase auth state checked on all protected routes
- ✅ Redirects to `/signup` if not authenticated
- ✅ Redirects to `/onboarding` if onboarding incomplete
- ✅ Uses athleteId from authenticated user

## Architecture: Separated Concerns

The training system is organized into four distinct domains, each with its own UX flow and data processing:

### 1. Training Plan Setup
**Purpose**: Collect athlete goals and preferences, then generate a personalized training plan.

**Flow:**
1. User provides race information (name, type, date)
2. User provides goal time and current fitness (5K pace)
3. User answers dialogue questions about experience
4. OpenAI generates personalized insights
5. System creates training plan from inputs
6. Plan saved to database with all planned workouts

**Key Data:**
- Race information (name, type, date, distance)
- Goal time and calculated goal pace
- Current 5K pace (baseline fitness)
- Training experience and preferences
- OpenAI inference/insights

**Database:**
- `Athlete` fields: `myTargetRace`, `myTrainingGoal`, `myCurrentPace`
- `Race` record
- `TrainingPlan` record
- `TrainingDayPlanned` records (all days)

**Files:**
- `app/training-setup/page.tsx` - Setup UI (formerly onboarding)
- `app/api/training-setup/inference/route.ts` - OpenAI insights
- `app/api/training-setup/save/route.ts` - Save setup data
- `app/api/training-setup/create-plan/route.ts` - Generate & save plan
- `lib/training-setup.ts` - Setup logic
- `lib/services/plan-generator.ts` - OpenAI plan generation

### 2. Training Plan Execution
**Purpose**: Track daily workout completion and progress through the plan.

**Flow:**
1. User views today's planned workout
2. User completes workout (manual entry or activity match)
3. System marks workout as executed
4. System tracks progress metrics
5. System updates adaptive metrics based on performance

**Key Data:**
- Planned workouts (`TrainingDayPlanned`)
- Executed workouts (`TrainingDayExecuted`)
- Completion status
- Progress metrics (weeks completed, workouts done)
- Weekly mileage actual vs planned

**Database:**
- `TrainingDayPlanned` - What should be done
- `TrainingDayExecuted` - What was done
- Links to `AthleteActivity` (if matched)

**Files:**
- `app/training-execution/page.tsx` - Today's workout view
- `app/training-execution/day/[dayId]/page.tsx` - Specific day view
- `app/api/training-execution/day/[dayId]/route.ts` - Get/update day
- `app/api/training-execution/complete/route.ts` - Mark as complete
- `lib/training-execution.ts` - Execution tracking logic
- `lib/services/analysis.ts` - Performance analysis

### 3. Activity Matching
**Purpose**: Separate UX for Garmin users to sync and match activities to planned workouts.

**Flow:**
1. User connects Garmin account (separate flow)
2. Garmin activities sync to `AthleteActivity` table
3. User views unmatched activities
4. User manually matches activity to planned workout OR
5. System auto-matches based on date/time proximity
6. Activity linked to `TrainingDayExecuted`

**Key Data:**
- `AthleteActivity` records from Garmin
- Unmatched activities list
- Matching suggestions
- Manual match confirmation

**Database:**
- `AthleteActivity` - Raw Garmin data
- `TrainingDayExecuted.activityId` - Link to activity
- Garmin connection metadata on `Athlete`

**Files:**
- `app/activity-matching/page.tsx` - Unmatched activities view
- `app/activity-matching/match/[activityId]/page.tsx` - Match activity to workout
- `app/api/activity-matching/sync/route.ts` - Sync from Garmin
- `app/api/activity-matching/unmatched/route.ts` - Get unmatched
- `app/api/activity-matching/match/route.ts` - Match activity to day
- `lib/activity-matching.ts` - Matching logic
- `lib/services/match-logic.ts` - Auto-match algorithms

### 4. Training Plan Athlete Review
**Purpose**: Weekly feedback mechanism for athletes to review progress and get insights.

**Flow:**
1. System generates weekly review (end of week)
2. User views weekly summary
3. Shows: workouts completed, mileage, pace trends
4. Shows: adaptive 5K time updates
5. Shows: race readiness status
6. Shows: AI-generated feedback and recommendations
7. User can provide feedback on the week

**Key Data:**
- Weekly aggregates (mileage, workouts, pace)
- Adaptive metrics (5K time, goal delta)
- Race readiness score
- Weekly feedback from athlete
- AI-generated weekly insights

**Database:**
- Aggregated from `TrainingDayExecuted`
- `TrainingPlan.trainingPlanAdaptive5kTime` - Updated weekly
- Weekly review records (future table)

**Files:**
- `app/training-review/weekly/page.tsx` - Weekly review view
- `app/training-review/weekly/[weekIndex]/page.tsx` - Specific week
- `app/api/training-review/weekly/[weekIndex]/route.ts` - Get weekly data
- `app/api/training-review/feedback/route.ts` - Submit feedback
- `lib/training-review.ts` - Review generation logic
- `lib/services/analysis.ts` - Adaptive metrics calculation

**Training Plan Structure:**
- **TrainingPlan**: Top-level plan with goal time, baseline 5K, total weeks, status
- **TrainingDayPlanned**: Individual workout days with plannedData (JSON)
  - Each day has: type, mileage, paceRange, hrZone, description, etc.
  - Organized by weekIndex and dayIndex
  - Phases: base, build, peak, taper

### Domain Separation Summary

**1. Training Plan Setup** → Creates the plan
- Input: Race info, goals, preferences
- Output: `TrainingPlan` + all `TrainingDayPlanned` records
- UX: Multi-step form → AI insights → Plan generation

**2. Training Plan Execution** → Tracks daily workouts
- Input: Planned workouts, completion status
- Output: `TrainingDayExecuted` records, progress metrics
- UX: Today's workout view, mark complete, track progress

**3. Activity Matching** → Separate Garmin sync flow
- Input: Garmin activities (`AthleteActivity`)
- Output: Matched activities linked to `TrainingDayExecuted`
- UX: Unmatched activities list, manual/auto matching

**4. Training Plan Athlete Review** → Weekly feedback
- Input: Weekly execution data, adaptive metrics
- Output: Weekly summary, AI feedback, race readiness
- UX: Weekly review page, progress visualization, feedback form

## Complete User Flow

### Authentication & Onboarding Flow
```
1. User visits app → Splash screen
2. Check Firebase auth state
   ├─ Not authenticated → /signup
   └─ Authenticated → Check onboarding
       ├─ No myTargetRace → /onboarding
       └─ Has myTargetRace → /training
3. Signup → Firebase auth → /api/athlete/create (upsert)
4. Onboarding → Collect race info → OpenAI inference → Save to DB
5. Training → Auth guard → Onboarding check → Load training data
```

### Training Plan Creation Flow
```
1. User completes onboarding
   ├─ Athlete.myTargetRace = "Boston Marathon"
   ├─ Athlete.myTrainingGoal = "3:30:00"
   ├─ Athlete.myCurrentPace = "8:30"
   └─ Race record created

2. User navigates to create plan OR auto-triggered
   ├─ Gather inputs from Athlete + Race
   ├─ Call generateTrainingPlanAI(inputs)
   │   └─ OpenAI generates complete plan (all weeks/days)
   ├─ Call saveTrainingPlanToDB(plan, inputs)
   │   ├─ Create TrainingPlan record
   │   └─ Create all TrainingDayPlanned records
   └─ Plan status = "active"

3. User views training hub
   ├─ Load active TrainingPlan
   ├─ Get today's workout (TrainingDayPlanned)
   ├─ Check if executed (TrainingDayExecuted)
   └─ Display plan status, race readiness
```

### Training Execution Flow
```
1. User views planned workout
   ├─ TrainingDayPlanned.plannedData (JSON)
   └─ Shows: type, mileage, paceRange, description

2. User completes workout
   ├─ Option A: Manual entry
   │   └─ Create TrainingDayExecuted manually
   └─ Option B: Garmin sync
       ├─ AthleteActivity created from Garmin
       ├─ match-logic.ts matches activity to planned day
       └─ TrainingDayExecuted created with activityId link

3. Analysis runs
   ├─ computeGoFastScore(executedDayId)
   ├─ Compare planned vs executed
   ├─ Calculate quality score
   └─ Update adaptive 5K time

4. Progress tracking
   ├─ Update TrainingPlan.trainingPlanAdaptive5kTime
   ├─ Track weekly mileage vs planned
   └─ Race readiness calculation
```

## Required Refactoring: Domain Separation

### Phase 1: Refactor Training Plan Setup Domain

**Rename & Reorganize:**
- `app/onboarding/` → `app/training-setup/`
- `app/api/onboarding/` → `app/api/training-setup/`
- Move `lib/services/plan-generator.ts` → `lib/training-setup/create-plan.ts`

**Create New Files:**
```
lib/training-setup/
  index.ts              - Main exports
  validate.ts           - Validate setup completeness
  create-plan.ts        - Create plan from setup data (from plan-generator.ts)
  inference.ts          - OpenAI insights (from onboarding/inference)
```

**Key Functions:**
```typescript
// lib/training-setup/index.ts
export { validateSetupComplete } from './validate';
export { createTrainingPlanFromSetup } from './create-plan';
export { generateSetupInference } from './inference';

// lib/training-setup/create-plan.ts
export async function createTrainingPlanFromSetup(athleteId: string): Promise<string> {
  // 1. Validate setup complete
  // 2. Get athlete + race data
  // 3. Build TrainingInputs
  // 4. Call OpenAI plan generation
  // 5. Save to database
  // 6. Return trainingPlanId
}
```

### Phase 2: Create Training Execution Domain

**New Files:**
```
lib/training-execution/
  index.ts              - Main exports
  get-todays-workout.ts - Get today's planned workout
  mark-complete.ts      - Mark workout as executed
  progress.ts           - Calculate progress metrics
```

**Key Functions:**
```typescript
// lib/training-execution/index.ts
export { getTodaysWorkout } from './get-todays-workout';
export { markWorkoutComplete } from './mark-complete';
export { calculateProgress } from './progress';

// lib/training-execution/mark-complete.ts
export async function markWorkoutComplete(
  athleteId: string,
  plannedDayId: string,
  manualData?: { distance?: number; duration?: number; pace?: string }
): Promise<TrainingDayExecuted> {
  // Create TrainingDayExecuted (no activityId for manual entry)
  // Trigger analysis
}
```

**API Routes:**
- `app/api/training-execution/day/[dayId]/route.ts` - GET/POST day
- `app/api/training-execution/complete/route.ts` - Mark complete
- `app/api/training-execution/progress/route.ts` - Get progress

### Phase 3: Create Activity Matching Domain (Separate from Execution)

**New Files:**
```
lib/activity-matching/
  index.ts              - Main exports
  sync.ts               - Sync from Garmin
  auto-match.ts         - Auto-match algorithms (from match-logic.ts)
  manual-match.ts       - Manual matching logic
  unmatched.ts          - Get unmatched activities
```

**Key Functions:**
```typescript
// lib/activity-matching/index.ts
export { syncGarminActivities } from './sync';
export { autoMatchActivity } from './auto-match';
export { manualMatchActivity } from './manual-match';
export { getUnmatchedActivities } from './unmatched';

// lib/activity-matching/manual-match.ts
export async function manualMatchActivity(
  athleteId: string,
  activityId: string,
  plannedDayId: string
): Promise<TrainingDayExecuted> {
  // Link activity to planned day
  // Create/update TrainingDayExecuted
}
```

**API Routes:**
- `app/api/activity-matching/sync/route.ts` - Sync from Garmin
- `app/api/activity-matching/unmatched/route.ts` - Get unmatched
- `app/api/activity-matching/match/route.ts` - Match activity to day

**Move Existing:**
- `lib/services/match-logic.ts` → `lib/activity-matching/auto-match.ts`

### Phase 4: Create Training Review Domain

**New Files:**
```
lib/training-review/
  index.ts              - Main exports
  weekly.ts             - Weekly review data aggregation
  feedback.ts           - Feedback submission
  metrics.ts            - Adaptive metrics calculation
```

**Key Functions:**
```typescript
// lib/training-review/index.ts
export { generateWeeklyReview } from './weekly';
export { submitFeedback } from './feedback';
export { calculateAdaptiveMetrics } from './metrics';

// lib/training-review/weekly.ts
export async function generateWeeklyReview(
  athleteId: string,
  weekIndex: number
): Promise<WeeklyReview> {
  // Aggregate weekly data
  // Calculate metrics
  // Generate AI feedback
}
```

**API Routes:**
- `app/api/training-review/weekly/[weekIndex]/route.ts` - Get weekly review
- `app/api/training-review/feedback/route.ts` - Submit feedback

**Move Existing:**
- `lib/services/analysis.ts` → Split between `training-execution/progress.ts` and `training-review/metrics.ts`

## Database Schema Notes

The Prisma schema in trainingmvp already has:
- `Athlete` model with `firebaseId` field (line 15)
- Proper relations to training plans, activities, etc.

**This is good!** The schema is ready for Firebase auth integration.

## Environment Variables Needed

```bash
# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Firebase Admin (Server-side)
FIREBASE_SERVICE_ACCOUNT=  # JSON string

# Database
DATABASE_URL=

# OpenAI (existing)
OPENAI_API_KEY=

# Remove this:
# NEXT_PUBLIC_TEST_ATHLETE_ID=  # DELETE THIS
```

## Summary

### Current State ✅
- ✅ **Authentication**: Firebase auth (client + admin) implemented
- ✅ **Onboarding**: Multi-step flow with OpenAI inference
- ✅ **LocalStorage**: Athlete data persistence
- ✅ **API Security**: Server-side token verification, secure routes
- ✅ **Auth Flow**: Signup → Onboarding → Training
- ✅ **Training Features**: Hub, plan, day, match (existing)
- ✅ **Database Schema**: Correct structure with relations
- ✅ **Services**: Analysis, extraction, match-logic, plan-generator

### What's Missing ⚠️
- ⚠️ **Domain Separation**: Need to refactor into 4 distinct domains
- ⚠️ **Training Setup Domain**: Refactor "onboarding" → "training-setup", add auto plan creation
- ⚠️ **Training Execution Domain**: Separate execution tracking from activity matching
- ⚠️ **Activity Matching Domain**: Separate UX/process for Garmin sync and matching
- ⚠️ **Training Review Domain**: Weekly feedback mechanism not yet implemented

### Priority Actions

#### Completed ✅
1. ✅ Add Firebase auth lib files
2. ✅ Update signup to actually authenticate
3. ✅ Add localStorage API
4. ✅ Update API routes to use token verification
5. ✅ Add auth guards to pages
6. ✅ Implement onboarding flow
7. ✅ Add goal pace calculation

#### Next Steps 🔄
1. **HIGH**: Refactor "onboarding" → "training-setup" (rename folders/files)
2. **HIGH**: Create `lib/training-setup/` domain with auto plan creation
3. **HIGH**: Create `lib/training-execution/` domain (separate from matching)
4. **HIGH**: Create `lib/activity-matching/` domain (separate UX/process)
5. **MEDIUM**: Create `lib/training-review/` domain for weekly feedback
6. **MEDIUM**: Reorganize API routes by domain
7. **LOW**: Add ability to edit setup data
8. **LOW**: Add race date picker to setup

### Architecture Status

**Authentication & Setup: ✅ COMPLETE (needs rename)**
- Firebase auth working
- Setup flow complete (currently called "onboarding")
- Data saved to database
- Auth guards in place
- ⚠️ Needs: Auto-create plan after setup

**Domain Separation: ⚠️ NEEDS REFACTORING**
- **Training Setup**: ✅ Exists but needs rename and auto-plan creation
- **Training Execution**: ⚠️ Exists but mixed with matching - needs separation
- **Activity Matching**: ⚠️ Exists but mixed with execution - needs separate domain
- **Training Review**: ❌ Not yet implemented - needs creation

**Recommended Folder Structure:**
```
app/
  training-setup/          (rename from onboarding)
  training-execution/
  activity-matching/
  training-review/

app/api/
  training-setup/          (rename from onboarding)
  training-execution/
  activity-matching/
  training-review/

lib/
  training-setup/
  training-execution/
  activity-matching/
  training-review/
```

