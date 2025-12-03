# GoFast Training System - Complete Models Reference

**Last Updated**: January 2025  
**Source**: `prisma/schema.prisma`  
**Purpose**: Complete reference for all database models, fields, relationships, and constraints

---

## Table of Contents

1. [Athlete](#1-athlete)
2. [GoFastCompany](#2-gofastcompany)
3. [RaceRegistry](#3-raceregistry)
4. [Race (Deprecated)](#4-race-deprecated)
5. [TrainingPlan](#5-trainingplan)
6. [TrainingDayPlanned](#6-trainingdayplanned)
7. [TrainingPlanFiveKPace](#7-trainingplanfivekpace)
8. [TrainingPlanPreferredDays](#8-trainingplanpreferreddays)
9. [TrainingDayExecuted](#9-trainingdayexecuted)
10. [AthleteActivity](#10-athleteactivity)

---

## 1. Athlete

**Table**: `athletes`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `firebaseId`, `gofastHandle`, `garmin_user_id`, `strava_id`

### Complete Model Definition

```prisma
model Athlete {
  id String @id @default(cuid())

  // Auth
  firebaseId String  @unique
  email      String?

  // Company Link (Single-tenant) - REQUIRED
  companyId String
  company   GoFastCompany @relation(fields: [companyId], references: [id])

  // Universal profile
  firstName    String?
  lastName     String?
  gofastHandle String?   @unique
  photoURL     String?
  phoneNumber  String?
  birthday     DateTime?
  gender       String?
  city         String?
  state        String?
  primarySport String?
  bio          String?
  instagram    String?

  // Profile Identity (can be updated)
  fiveKPace String? // mm:ss format - THE SOURCE OF TRUTH for 5K pace

  // Legacy training fields (deprecated, keep for migration)
  myCurrentPace       String?
  myWeeklyMileage     Int?
  myTrainingGoal      String?
  myTrainingStartDate DateTime?
  myTargetRace        String?
  preferredDistance   String?
  myPaceRange         String?
  timePreference      String?
  myRunningGoals      String?

  // Garmin PKCE Integration
  garmin_user_id          String?   @unique
  garmin_access_token     String?
  garmin_refresh_token    String?
  garmin_expires_in       Int?
  garmin_scope            String?
  garmin_connected_at     DateTime?
  garmin_last_sync_at     DateTime?
  garmin_is_connected     Boolean   @default(false)
  garmin_disconnected_at  DateTime?
  garmin_permissions      Json?
  garmin_user_profile     Json?
  garmin_user_sleep       Json?
  garmin_user_preferences Json?

  // Strava (future)
  strava_id            Int?    @unique
  strava_access_token  String?
  strava_refresh_token String?
  strava_expires_at    Int?

  // System fields
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  trainingPlans             TrainingPlan[]
  plannedDays               TrainingDayPlanned[]
  executedDays              TrainingDayExecuted[]
  activities                AthleteActivity[]
  trainingPlanFiveKPaces    TrainingPlanFiveKPace[]
  trainingPlanPreferredDays TrainingPlanPreferredDays[]

  @@map("athletes")
}
```

### Field Reference

#### Identity Fields
| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✅ | ✅ | Primary key (cuid) |
| `firebaseId` | String | ✅ | ✅ | Firebase authentication ID |
| `email` | String? | ❌ | ❌ | Email address |

#### Company Link
| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `companyId` | String | ✅ | ❌ | Foreign key to GoFastCompany |
| `company` | GoFastCompany | ✅ | ❌ | Relation to company |

#### Profile Fields
| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `firstName` | String? | ❌ | ❌ | First name |
| `lastName` | String? | ❌ | ❌ | Last name |
| `gofastHandle` | String? | ❌ | ✅ | Unique username |
| `photoURL` | String? | ❌ | ❌ | Profile photo URL |
| `phoneNumber` | String? | ❌ | ❌ | Phone number |
| `birthday` | DateTime? | ❌ | ❌ | Date of birth |
| `gender` | String? | ❌ | ❌ | Gender |
| `city` | String? | ❌ | ❌ | City |
| `state` | String? | ❌ | ❌ | State |
| `primarySport` | String? | ❌ | ❌ | Primary sport |
| `bio` | String? | ❌ | ❌ | Biography |
| `instagram` | String? | ❌ | ❌ | Instagram handle |

#### Training Profile
| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `fiveKPace` | String? | ❌ | ❌ | **SOURCE OF TRUTH** - 5K pace in mm:ss format (e.g., "8:30") |

#### Legacy Fields (Deprecated)
| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `myCurrentPace` | String? | ❌ | ❌ | ⚠️ DEPRECATED - Use `fiveKPace` |
| `myWeeklyMileage` | Int? | ❌ | ❌ | ⚠️ DEPRECATED |
| `myTrainingGoal` | String? | ❌ | ❌ | ⚠️ DEPRECATED |
| `myTrainingStartDate` | DateTime? | ❌ | ❌ | ⚠️ DEPRECATED |
| `myTargetRace` | String? | ❌ | ❌ | ⚠️ DEPRECATED |
| `preferredDistance` | String? | ❌ | ❌ | ⚠️ DEPRECATED |
| `myPaceRange` | String? | ❌ | ❌ | ⚠️ DEPRECATED |
| `timePreference` | String? | ❌ | ❌ | ⚠️ DEPRECATED |
| `myRunningGoals` | String? | ❌ | ❌ | ⚠️ DEPRECATED |

#### Garmin Integration Fields
| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `garmin_user_id` | String? | ❌ | ✅ | Garmin user ID |
| `garmin_access_token` | String? | ❌ | ❌ | OAuth access token |
| `garmin_refresh_token` | String? | ❌ | ❌ | OAuth refresh token |
| `garmin_expires_in` | Int? | ❌ | ❌ | Token expiration (seconds) |
| `garmin_scope` | String? | ❌ | ❌ | OAuth scopes |
| `garmin_connected_at` | DateTime? | ❌ | ❌ | Connection timestamp |
| `garmin_last_sync_at` | DateTime? | ❌ | ❌ | Last sync timestamp |
| `garmin_is_connected` | Boolean | ❌ | ❌ | Connection status (default: false) |
| `garmin_disconnected_at` | DateTime? | ❌ | ❌ | Disconnection timestamp |
| `garmin_permissions` | Json? | ❌ | ❌ | Garmin permissions (JSON) |
| `garmin_user_profile` | Json? | ❌ | ❌ | Garmin user profile (JSON) |
| `garmin_user_sleep` | Json? | ❌ | ❌ | Garmin sleep data (JSON) |
| `garmin_user_preferences` | Json? | ❌ | ❌ | Garmin preferences (JSON) |

#### Strava Integration Fields (Future)
| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `strava_id` | Int? | ❌ | ✅ | Strava user ID |
| `strava_access_token` | String? | ❌ | ❌ | OAuth access token |
| `strava_refresh_token` | String? | ❌ | ❌ | OAuth refresh token |
| `strava_expires_at` | Int? | ❌ | ❌ | Token expiration (Unix timestamp) |

#### System Fields
| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `createdAt` | DateTime | ✅ | ❌ | Auto-set on creation |
| `updatedAt` | DateTime | ✅ | ❌ | Auto-updated on modification |

### Relations

- **One-to-Many**: `trainingPlans` → `TrainingPlan[]`
- **One-to-Many**: `plannedDays` → `TrainingDayPlanned[]`
- **One-to-Many**: `executedDays` → `TrainingDayExecuted[]`
- **One-to-Many**: `activities` → `AthleteActivity[]`
- **One-to-Many**: `trainingPlanFiveKPaces` → `TrainingPlanFiveKPace[]`
- **One-to-Many**: `trainingPlanPreferredDays` → `TrainingPlanPreferredDays[]`
- **Many-to-One**: `company` → `GoFastCompany`

---

## 2. GoFastCompany

**Table**: `go_fast_companies`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraint**: `slug`

### Complete Model Definition

```prisma
model GoFastCompany {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  address   String?
  city      String?
  state     String?
  zip       String?
  domain    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  athletes Athlete[]

  @@map("go_fast_companies")
}
```

### Field Reference

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✅ | ✅ | Primary key (cuid) |
| `name` | String | ✅ | ❌ | Company name |
| `slug` | String | ✅ | ✅ | URL-friendly identifier |
| `address` | String? | ❌ | ❌ | Street address |
| `city` | String? | ❌ | ❌ | City |
| `state` | String? | ❌ | ❌ | State |
| `zip` | String? | ❌ | ❌ | ZIP code |
| `domain` | String? | ❌ | ❌ | Company domain |
| `createdAt` | DateTime | ✅ | ❌ | Auto-set on creation |
| `updatedAt` | DateTime | ✅ | ❌ | Auto-updated on modification |

### Relations

- **One-to-Many**: `athletes` → `Athlete[]`

---

## 3. RaceRegistry

**Table**: `race_registry`  
**Primary Key**: `id` (String, cuid)

### Complete Model Definition

```prisma
model RaceRegistry {
  id        String   @id @default(cuid())
  name      String
  distance  String // "marathon", "half", "5k", "10k", etc.
  date      DateTime
  city      String?
  state     String?
  country   String?
  createdBy String // athleteId who created it
  isGlobal  Boolean  @default(false) // true = available to all users

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  trainingPlans TrainingPlan[]

  @@map("race_registry")
}
```

### Field Reference

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✅ | ✅ | Primary key (cuid) |
| `name` | String | ✅ | ❌ | Race name (e.g., "Boston Marathon") |
| `distance` | String | ✅ | ❌ | Race distance ("marathon", "half", "5k", "10k", etc.) |
| `date` | DateTime | ✅ | ❌ | Race date |
| `city` | String? | ❌ | ❌ | City |
| `state` | String? | ❌ | ❌ | State |
| `country` | String? | ❌ | ❌ | Country |
| `createdBy` | String | ✅ | ❌ | athleteId who created the race |
| `isGlobal` | Boolean | ✅ | ❌ | Public availability flag (default: false) |
| `createdAt` | DateTime | ✅ | ❌ | Auto-set on creation |
| `updatedAt` | DateTime | ✅ | ❌ | Auto-updated on modification |

### Relations

- **One-to-Many**: `trainingPlans` → `TrainingPlan[]`

---

## 4. Race (Deprecated)

**Table**: `races`  
**Status**: ⚠️ **DEPRECATED** - Do not use

### Complete Model Definition

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

### Field Reference

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✅ | ✅ | Primary key (cuid) |
| `raceName` | String | ✅ | ❌ | Race name |
| `raceType` | String | ✅ | ❌ | Race type |
| `raceDate` | DateTime | ✅ | ❌ | Race date |
| `location` | String? | ❌ | ❌ | Location |
| `distanceMiles` | Float | ✅ | ❌ | Distance in miles |
| `createdAt` | DateTime | ✅ | ❌ | Auto-set on creation |
| `updatedAt` | DateTime | ✅ | ❌ | Auto-updated on modification |

### Relations

- **None** - Relations removed (deprecated model)

---

## 5. TrainingPlan

**Table**: `training_plans`  
**Primary Key**: `id` (String, cuid)

### Complete Model Definition

```prisma
model TrainingPlan {
  id             String @id @default(cuid())
  athleteId      String
  raceRegistryId String // References RaceRegistry

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
  athlete                   Athlete                    @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  raceRegistry              RaceRegistry               @relation(fields: [raceRegistryId], references: [id], onDelete: Cascade)
  plannedDays               TrainingDayPlanned[]
  trainingPlanFiveKPace     TrainingPlanFiveKPace?
  trainingPlanPreferredDays TrainingPlanPreferredDays?

  @@map("training_plans")
}
```

### Field Reference

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✅ | ✅ | Primary key (cuid) |
| `athleteId` | String | ✅ | ❌ | Foreign key to Athlete |
| `raceRegistryId` | String | ✅ | ❌ | Foreign key to RaceRegistry |
| `trainingPlanName` | String | ✅ | ❌ | Plan name (e.g., "Boston Marathon Training Plan") |
| `trainingPlanGoalTime` | String? | ❌ | ❌ | Goal time (e.g., "3:30:00") |
| `trainingPlanStartDate` | DateTime | ✅ | ❌ | Plan start date (usually today) |
| `trainingPlanTotalWeeks` | Int | ✅ | ❌ | Total weeks in plan |
| `status` | String | ✅ | ❌ | Status: "draft", "active", "completed" (default: "draft") |
| `createdAt` | DateTime | ✅ | ❌ | Auto-set on creation |
| `updatedAt` | DateTime | ✅ | ❌ | Auto-updated on modification |

### Relations

- **Many-to-One**: `athlete` → `Athlete` (Cascade delete)
- **Many-to-One**: `raceRegistry` → `RaceRegistry` (Cascade delete)
- **One-to-Many**: `plannedDays` → `TrainingDayPlanned[]`
- **One-to-One**: `trainingPlanFiveKPace` → `TrainingPlanFiveKPace?` (optional)
- **One-to-One**: `trainingPlanPreferredDays` → `TrainingPlanPreferredDays?` (optional)

---

## 6. TrainingDayPlanned

**Table**: `training_days_planned`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraint**: `[trainingPlanId, weekIndex, dayIndex]`

### Complete Model Definition

```prisma
model TrainingDayPlanned {
  id             String @id @default(cuid())
  trainingPlanId String
  athleteId      String

  // Day Identification
  weekIndex Int
  dayIndex  Int // MUST be 1-7 (1=Monday, 7=Sunday)
  phase     String // "base", "build", "peak", "taper"

  // Computed date (calculated by backend, not from AI)
  date      DateTime

  // PLANNED WORKOUT (atomic element)
  plannedData Json

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

### Field Reference

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✅ | ✅ | Primary key (cuid) |
| `trainingPlanId` | String | ✅ | ❌ | Foreign key to TrainingPlan |
| `athleteId` | String | ✅ | ❌ | Foreign key to Athlete |
| `weekIndex` | Int | ✅ | ❌ | Week number (1-based: first week is 1) |
| `dayIndex` | Int | ✅ | ❌ | Day of week (1-7: 1=Monday, 7=Sunday) |
| `phase` | String | ✅ | ❌ | Training phase ("base", "build", "peak", "taper") |
| `date` | DateTime | ✅ | ❌ | Computed date (calculated by backend) |
| `plannedData` | Json | ✅ | ❌ | Workout data (type, mileage, pace, HR, etc.) |
| `createdAt` | DateTime | ✅ | ❌ | Auto-set on creation |
| `updatedAt` | DateTime | ✅ | ❌ | Auto-updated on modification |

### Constraints

- **Unique**: `[trainingPlanId, weekIndex, dayIndex]` - One planned day per plan/week/day combination

### Relations

- **Many-to-One**: `trainingPlan` → `TrainingPlan` (Cascade delete)
- **Many-to-One**: `athlete` → `Athlete` (Cascade delete)

### plannedData JSON Structure

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

---

## 7. TrainingPlanFiveKPace

**Table**: `training_plan_five_k_pace`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraint**: `[trainingPlanId]` (one snapshot per plan)

### Complete Model Definition

```prisma
// Plan-specific snapshot: 5K pace at time of plan creation
model TrainingPlanFiveKPace {
  id             String @id @default(cuid())
  trainingPlanId String
  athleteId      String
  fiveKPace      String // mm:ss format

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  trainingPlan TrainingPlan @relation(fields: [trainingPlanId], references: [id], onDelete: Cascade)
  athlete      Athlete      @relation(fields: [athleteId], references: [id], onDelete: Cascade)

  @@unique([trainingPlanId])
  @@map("training_plan_five_k_pace")
}
```

### Field Reference

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✅ | ✅ | Primary key (cuid) |
| `trainingPlanId` | String | ✅ | ❌ | Foreign key to TrainingPlan |
| `athleteId` | String | ✅ | ❌ | Foreign key to Athlete |
| `fiveKPace` | String | ✅ | ❌ | **SNAPSHOT** - 5K pace in mm:ss format (e.g., "8:30") |
| `createdAt` | DateTime | ✅ | ❌ | Auto-set on creation |
| `updatedAt` | DateTime | ✅ | ❌ | Auto-updated on modification |

### Constraints

- **Unique**: `[trainingPlanId]` - One snapshot per plan

### Relations

- **One-to-One**: `trainingPlan` → `TrainingPlan` (Cascade delete)
- **Many-to-One**: `athlete` → `Athlete` (Cascade delete)

### Purpose

**Snapshot Pattern**: Captures athlete's `fiveKPace` at plan creation time to prevent identity drift. If athlete improves pace later, old plans still reference the original pace for historical accuracy.

---

## 8. TrainingPlanPreferredDays

**Table**: `training_plan_preferred_days`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraint**: `[trainingPlanId]` (one snapshot per plan)  
**Status**: ⚠️ **UNUSED IN MVP1**

### Complete Model Definition

```prisma
// Plan-specific snapshot: Preferred run days at time of plan creation
model TrainingPlanPreferredDays {
  id             String @id @default(cuid())
  trainingPlanId String
  athleteId      String
  preferredDays  Int[] // e.g. [1,3,5] where 1=Monday, 7=Sunday

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  trainingPlan TrainingPlan @relation(fields: [trainingPlanId], references: [id], onDelete: Cascade)
  athlete      Athlete      @relation(fields: [athleteId], references: [id], onDelete: Cascade)

  @@unique([trainingPlanId])
  @@map("training_plan_preferred_days")
}
```

### Field Reference

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✅ | ✅ | Primary key (cuid) |
| `trainingPlanId` | String | ✅ | ❌ | Foreign key to TrainingPlan |
| `athleteId` | String | ✅ | ❌ | Foreign key to Athlete |
| `preferredDays` | Int[] | ✅ | ❌ | **SNAPSHOT** - Array of day indices (1=Monday, 7=Sunday) |
| `createdAt` | DateTime | ✅ | ❌ | Auto-set on creation |
| `updatedAt` | DateTime | ✅ | ❌ | Auto-updated on modification |

### Constraints

- **Unique**: `[trainingPlanId]` - One snapshot per plan

### Relations

- **One-to-One**: `trainingPlan` → `TrainingPlan` (Cascade delete)
- **Many-to-One**: `athlete` → `Athlete` (Cascade delete)

### Status

⚠️ **UNUSED IN MVP1** - Table exists in schema but no code writes to it. Reserved for future feature.

---

## 9. TrainingDayExecuted

**Table**: `training_days_executed`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraint**: `activityId` (one execution per activity)

### Complete Model Definition

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

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  athlete Athlete @relation(fields: [athleteId], references: [id], onDelete: Cascade)

  @@map("training_days_executed")
}
```

### Field Reference

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✅ | ✅ | Primary key (cuid) |
| `athleteId` | String | ✅ | ❌ | Foreign key to Athlete |
| `activityId` | String? | ❌ | ✅ | Link to AthleteActivity (optional, unique) |
| `weekIndex` | Int | ✅ | ❌ | Week number (copied from planned day) |
| `dayIndex` | Int | ✅ | ❌ | Day of week (copied from planned day) |
| `date` | DateTime | ✅ | ❌ | Date of execution (copied from planned day) |
| `plannedData` | Json? | ❌ | ❌ | **SNAPSHOT** - Planned workout data at execution time |
| `analysis` | Json? | ❌ | ❌ | GoFastScore and analysis results |
| `feedback` | Json? | ❌ | ❌ | User feedback on workout |
| `createdAt` | DateTime | ✅ | ❌ | Auto-set on creation |
| `updatedAt` | DateTime | ✅ | ❌ | Auto-updated on modification |

### Constraints

- **Unique**: `activityId` - One execution record per activity (if activityId is set)

### Relations

- **Many-to-One**: `athlete` → `Athlete` (Cascade delete)
- **One-to-One (optional)**: `AthleteActivity` via `activityId` (no Prisma relation defined)

### Important Notes

- **No FK to TrainingPlan**: Linking done by matching `date`, `weekIndex`, `dayIndex` (application logic)
- **Shell Container**: Links `AthleteActivity` to planned workouts
- **Optional Activity**: Can be manual entry (`activityId = null`) or Garmin match (`activityId` set)

### analysis JSON Structure

```typescript
{
  paceVariance: number,
  hrZoneHitPercent: number,
  mileageVariance: number,
  workoutQualityScore: number,
  weekTrendScore: number,
  overallScore: number
}
```

---

## 10. AthleteActivity

**Table**: `athlete_activities`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraint**: `sourceActivityId` (one DB record per Garmin activity)

### Complete Model Definition

```prisma
model AthleteActivity {
  id               String @id @default(cuid())
  athleteId        String
  sourceActivityId String @unique
  source           String @default("garmin")

  activityType     String?
  activityName     String?
  startTime        DateTime?
  duration         Int?
  distance         Float?
  calories         Int?
  averageSpeed     Float?
  averageHeartRate Int?
  maxHeartRate     Int?
  elevationGain    Float?
  steps            Int?

  // Location + Polyline
  startLatitude   Float?
  startLongitude  Float?
  endLatitude     Float?
  endLongitude    Float?
  summaryPolyline String?

  summaryData Json?
  detailData  Json?
  hydratedAt  DateTime?

  athlete Athlete @relation(fields: [athleteId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("athlete_activities")
}
```

### Field Reference

#### Identity Fields
| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `id` | String | ✅ | ✅ | Primary key (cuid) |
| `athleteId` | String | ✅ | ❌ | Foreign key to Athlete |
| `sourceActivityId` | String | ✅ | ✅ | Source activity ID (Garmin activity ID) |
| `source` | String | ✅ | ❌ | Source system (default: "garmin") |

#### Activity Data Fields
| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `activityType` | String? | ❌ | ❌ | Activity type (e.g., "running") |
| `activityName` | String? | ❌ | ❌ | Activity name |
| `startTime` | DateTime? | ❌ | ❌ | Activity start time |
| `duration` | Int? | ❌ | ❌ | Duration in seconds |
| `distance` | Float? | ❌ | ❌ | Distance in meters |
| `calories` | Int? | ❌ | ❌ | Calories burned |
| `averageSpeed` | Float? | ❌ | ❌ | Average speed in m/s |
| `averageHeartRate` | Int? | ❌ | ❌ | Average heart rate (bpm) |
| `maxHeartRate` | Int? | ❌ | ❌ | Maximum heart rate (bpm) |
| `elevationGain` | Float? | ❌ | ❌ | Elevation gain in meters |
| `steps` | Int? | ❌ | ❌ | Step count |

#### Location Fields
| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `startLatitude` | Float? | ❌ | ❌ | Start latitude |
| `startLongitude` | Float? | ❌ | ❌ | Start longitude |
| `endLatitude` | Float? | ❌ | ❌ | End latitude |
| `endLongitude` | Float? | ❌ | ❌ | End longitude |
| `summaryPolyline` | String? | ❌ | ❌ | Encoded polyline for route |

#### Raw Data Fields
| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `summaryData` | Json? | ❌ | ❌ | Full Garmin summary JSON |
| `detailData` | Json? | ❌ | ❌ | Full Garmin detail JSON |
| `hydratedAt` | DateTime? | ❌ | ❌ | Timestamp when data was hydrated |

#### System Fields
| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `createdAt` | DateTime | ✅ | ❌ | Auto-set on creation |
| `updatedAt` | DateTime | ✅ | ❌ | Auto-updated on modification |

### Constraints

- **Unique**: `sourceActivityId` - One DB record per Garmin activity

### Relations

- **Many-to-One**: `athlete` → `Athlete` (Cascade delete)
- **One-to-One (optional)**: `TrainingDayExecuted` via `activityId` (no Prisma relation defined)

---

## Model Relationships Summary

### Entity Relationship Diagram (Text)

```
Athlete (1) ──< (Many) TrainingPlan
Athlete (1) ──< (Many) TrainingDayPlanned
Athlete (1) ──< (Many) TrainingDayExecuted
Athlete (1) ──< (Many) AthleteActivity
Athlete (1) ──< (Many) TrainingPlanFiveKPace
Athlete (1) ──< (Many) TrainingPlanPreferredDays
Athlete (Many) >── (1) GoFastCompany

RaceRegistry (1) ──< (Many) TrainingPlan

TrainingPlan (1) ──< (Many) TrainingDayPlanned
TrainingPlan (1) ── (1) TrainingPlanFiveKPace (optional)
TrainingPlan (1) ── (1) TrainingPlanPreferredDays (optional)

TrainingDayExecuted ──> AthleteActivity (via activityId, no FK)
```

### Cascade Delete Rules

- **TrainingPlan** → Deletes all `TrainingDayPlanned`, `TrainingPlanFiveKPace`, `TrainingPlanPreferredDays`
- **Athlete** → Deletes all related records (plans, days, activities, snapshots)
- **RaceRegistry** → No cascade (plans reference it, but deletion handled separately)

---

## Indexes and Constraints

### Unique Constraints

1. `Athlete.firebaseId` - One athlete per Firebase user
2. `Athlete.gofastHandle` - Unique username
3. `Athlete.garmin_user_id` - One athlete per Garmin user
4. `Athlete.strava_id` - One athlete per Strava user
5. `GoFastCompany.slug` - Unique company slug
6. `RaceRegistry` - No unique constraints (multiple races can have same name/date)
7. `TrainingPlan` - No unique constraints (athlete can have multiple plans)
8. `TrainingDayPlanned` - `[trainingPlanId, weekIndex, dayIndex]` - One day per plan/week/day
9. `TrainingPlanFiveKPace` - `[trainingPlanId]` - One snapshot per plan
10. `TrainingPlanPreferredDays` - `[trainingPlanId]` - One snapshot per plan
11. `TrainingDayExecuted.activityId` - One execution per activity
12. `AthleteActivity.sourceActivityId` - One DB record per Garmin activity

### Foreign Key Constraints

All foreign keys use `onDelete: Cascade` except:
- `Athlete.companyId` → `GoFastCompany.id` (no cascade - company deletion handled separately)
- `TrainingPlan.raceRegistryId` → `RaceRegistry.id` (no cascade - race deletion handled separately)

---

**End of Models Reference**

