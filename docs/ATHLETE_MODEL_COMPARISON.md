# Athlete Model Comparison: GoFast MVP vs TrainingMVP

## Database Status (Verified)

**Table Name:** `Athlete` (PascalCase, Prisma default - both repos match ✅)

**Total Columns:** 45 columns

**Key Finding:** `fiveKPace` column **NOW EXISTS** in database ✅

---

## Field-by-Field Comparison

### ✅ Core Identity Fields (MATCH)

| Field | GoFast MVP | TrainingMVP | Database | Status |
|-------|-----------|-------------|----------|--------|
| `id` | ✅ String @id | ✅ String @id | ✅ text | ✅ Match |
| `firebaseId` | ✅ String @unique | ✅ String @unique | ✅ text | ✅ Match |
| `email` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `companyId` | ✅ String | ✅ String | ✅ text | ✅ Match |

### ✅ Universal Profile Fields (MATCH)

| Field | GoFast MVP | TrainingMVP | Database | Status |
|-------|-----------|-------------|----------|--------|
| `firstName` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `lastName` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `gofastHandle` | ✅ String? @unique | ✅ String? @unique | ✅ text | ✅ Match |
| `photoURL` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `phoneNumber` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `birthday` | ✅ DateTime? | ✅ DateTime? | ✅ timestamp | ✅ Match |
| `gender` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `city` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `state` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `primarySport` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `bio` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `instagram` | ✅ String? | ✅ String? | ✅ text | ✅ Match |

### ⚠️ Training Profile Fields

| Field | GoFast MVP | TrainingMVP | Database | Status |
|-------|-----------|-------------|----------|--------|
| `myCurrentPace` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `myWeeklyMileage` | ✅ Int? | ✅ Int? | ✅ integer | ✅ Match |
| `myTrainingGoal` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `myTrainingStartDate` | ✅ DateTime? | ✅ DateTime? | ✅ timestamp | ✅ Match |
| `myTargetRace` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `preferredDistance` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `myPaceRange` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `timePreference` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `myRunningGoals` | ✅ String? | ✅ String? | ✅ text | ✅ Match |

### 🔴 TrainingMVP-Specific Field

| Field | GoFast MVP | TrainingMVP | Database | Status |
|-------|-----------|-------------|----------|--------|
| `fiveKPace` | ❌ **NOT IN SCHEMA** | ✅ String? | ✅ **NOW EXISTS** | ⚠️ TrainingMVP-only |

**Note:** This field was added to the database specifically for TrainingMVP. GoFast MVP doesn't use it, but it won't cause issues since it's nullable.

### ✅ Garmin Integration Fields (MATCH)

| Field | GoFast MVP | TrainingMVP | Database | Status |
|-------|-----------|-------------|----------|--------|
| `garmin_user_id` | ✅ String? @unique | ✅ String? @unique | ✅ text | ✅ Match |
| `garmin_access_token` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `garmin_refresh_token` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `garmin_expires_in` | ✅ Int? | ✅ Int? | ✅ integer | ✅ Match |
| `garmin_scope` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `garmin_connected_at` | ✅ DateTime? | ✅ DateTime? | ✅ timestamp | ✅ Match |
| `garmin_last_sync_at` | ✅ DateTime? | ✅ DateTime? | ✅ timestamp | ✅ Match |
| `garmin_is_connected` | ✅ Boolean @default(false) | ✅ Boolean @default(false) | ✅ boolean | ✅ Match |
| `garmin_disconnected_at` | ✅ DateTime? | ✅ DateTime? | ✅ timestamp | ✅ Match |
| `garmin_permissions` | ✅ Json? | ✅ Json? | ✅ jsonb | ✅ Match |
| `garmin_user_profile` | ✅ Json? | ✅ Json? | ✅ jsonb | ✅ Match |
| `garmin_user_sleep` | ✅ Json? | ✅ Json? | ✅ jsonb | ✅ Match |
| `garmin_user_preferences` | ✅ Json? | ✅ Json? | ✅ jsonb | ✅ Match |

### ✅ Strava Integration Fields (MATCH)

| Field | GoFast MVP | TrainingMVP | Database | Status |
|-------|-----------|-------------|----------|--------|
| `strava_id` | ✅ Int? @unique | ✅ Int? @unique | ✅ integer | ✅ Match |
| `strava_access_token` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `strava_refresh_token` | ✅ String? | ✅ String? | ✅ text | ✅ Match |
| `strava_expires_at` | ✅ Int? | ✅ Int? | ✅ integer | ✅ Match |

### ✅ System Fields (MATCH)

| Field | GoFast MVP | TrainingMVP | Database | Status |
|-------|-----------|-------------|----------|--------|
| `createdAt` | ✅ DateTime @default(now()) | ✅ DateTime @default(now()) | ✅ timestamp | ✅ Match |
| `updatedAt` | ✅ DateTime @updatedAt | ✅ DateTime @updatedAt | ✅ timestamp | ✅ Match |

---

## Relations Comparison

### GoFast MVP Relations (RunCrew-focused)

```prisma
// Relations
activities           AthleteActivity[]
runCrewMemberships   RunCrewMembership[]
runCrewManagers      RunCrewManager[]
runCrewMessages      RunCrewMessage[]
runCrewAnnouncements RunCrewAnnouncement[]
runCrewRuns          RunCrewRun[]
runCrewRunRSVPs      RunCrewRunRSVP[]
runCrewEvents        RunCrewEvent[]
runCrewEventRSVPs    RunCrewEventRSVP[]

// Training relations
trainingPlans        TrainingPlan[]
plannedDays          TrainingDayPlanned[]
executedDays         TrainingDayExecuted[]
createdRaces         Race[]
```

### TrainingMVP Relations (Training-focused)

```prisma
// Relations
trainingPlans             TrainingPlan[]
athleteTrainingPlans      AthleteTrainingPlan[] // Junction table
plannedDays               TrainingDayPlanned[]
executedDays              TrainingDayExecuted[]
activities                AthleteActivity[]
trainingPlanFiveKPaces    TrainingPlanFiveKPace[]
trainingPlanPreferredDays TrainingPlanPreferredDays[]
```

### Differences

| Relation | GoFast MVP | TrainingMVP | Notes |
|----------|-----------|-------------|-------|
| `runCrewMemberships` | ✅ | ❌ | GoFast MVP only |
| `runCrewManagers` | ✅ | ❌ | GoFast MVP only |
| `runCrewMessages` | ✅ | ❌ | GoFast MVP only |
| `runCrewAnnouncements` | ✅ | ❌ | GoFast MVP only |
| `runCrewRuns` | ✅ | ❌ | GoFast MVP only |
| `runCrewRunRSVPs` | ✅ | ❌ | GoFast MVP only |
| `runCrewEvents` | ✅ | ❌ | GoFast MVP only |
| `runCrewEventRSVPs` | ✅ | ❌ | GoFast MVP only |
| `athleteTrainingPlans` | ❌ | ✅ | TrainingMVP only (junction table) |
| `trainingPlanFiveKPaces` | ❌ | ✅ | TrainingMVP only |
| `trainingPlanPreferredDays` | ❌ | ✅ | TrainingMVP only |
| `createdRaces` | ✅ | ❌ | GoFast MVP only |

**Note:** These relation differences are expected - each repo focuses on different features. The database tables exist for both, but each schema only declares the relations it uses.

---

## Table Name Mapping

| Model | GoFast MVP | TrainingMVP | Database Table |
|-------|-----------|-------------|----------------|
| `Athlete` | ✅ No `@@map` (default: `Athlete`) | ✅ No `@@map` (default: `Athlete`) | ✅ `Athlete` |

**Status:** ✅ **ALIGNED** - Both use Prisma default naming (PascalCase)

---

## Summary

### ✅ What Matches

1. **All core fields** - id, firebaseId, email, companyId
2. **All profile fields** - firstName, lastName, gofastHandle, etc.
3. **All legacy training fields** - myCurrentPace, myWeeklyMileage, etc.
4. **All Garmin fields** - Complete match
5. **All Strava fields** - Complete match
6. **System fields** - createdAt, updatedAt
7. **Table name** - Both use `Athlete` (no `@@map`)

### ⚠️ TrainingMVP-Specific

1. **`fiveKPace` field** - TrainingMVP only, now exists in database ✅
2. **Training relations** - `trainingPlanFiveKPaces`, `trainingPlanPreferredDays`, `athleteTrainingPlans`

### ❌ GoFast MVP-Specific

1. **RunCrew relations** - `runCrewMemberships`, `runCrewManagers`, etc. (8 relations)
2. **`createdRaces` relation** - GoFast MVP only

---

## Database Alignment Status

✅ **FULLY ALIGNED**

- All shared fields exist in database
- `fiveKPace` column now exists (TrainingMVP-specific)
- Table name matches (`Athlete`)
- No schema conflicts
- Both repos can coexist on same database

---

## Why `fiveKPace` Was Missing

**Root Cause:** The migration script didn't actually execute the SQL. The column was added to the Prisma schema but never created in the database.

**Fix Applied:** Ran `ALTER TABLE "Athlete" ADD COLUMN "fiveKPace" TEXT;` directly on the database.

**Current Status:** ✅ Column exists and Prisma can query it.

---

## Verification Commands

```bash
# Check if column exists
npx prisma db execute --stdin <<'EOF'
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'Athlete' AND column_name = 'fiveKPace';
EOF

# Test Prisma query
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.athlete.findFirst({ select: { fiveKPace: true } })
  .then(r => console.log('✅ Works:', r))
  .catch(e => console.error('❌ Error:', e.message))
  .finally(() => prisma.\$disconnect());
"
```

