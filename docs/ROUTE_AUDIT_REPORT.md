# API Route Audit Report
**Date:** 2025-01-XX  
**Purpose:** Align all API routes with final architecture (TRAINING_ARCHITECTURE.md)

---

## Executive Summary

All API routes have been audited and updated to match the final architecture specification. Key changes:
- ✅ Removed all references to deprecated fields (`raceId`, `raceRegistryId` on `TrainingPlan`, boolean flags)
- ✅ Updated all routes to use `RaceTrainingPlan` junction table
- ✅ Fixed MVP1 behavior: Load latest active OR draft plan (do NOT require `AthleteTrainingPlan` junction)
- ✅ Added `trainingPlanStartDate` validation in generate route
- ✅ All routes now correctly use `goalFiveKPace` field on `TrainingPlan`

---

## Routes Audited & Fixed

### 1. `/api/athlete/create` ✅
**Status:** PASS - No changes needed

**Checks:**
- ✅ Uses `companyId` (required)
- ✅ Uses correct table name `Athlete` (no `@@map("athletes")`)
- ✅ Uses Firebase Admin correctly
- ✅ No deprecated fields

**Notes:** Route correctly creates/updates athlete with company association.

---

### 2. `/api/athlete/hydrate` ✅
**Status:** FIXED

**Changes Made:**
- ✅ Updated to load latest **active OR draft** plan (MVP1 behavior)
- ✅ Removed requirement for `AthleteTrainingPlan` junction table
- ✅ Falls back to draft plan if no active plan exists

**Before:**
```typescript
const activePlan = await prisma.trainingPlan.findFirst({
  where: { 
    athleteId: athlete.id,
    status: 'active'
  },
  ...
});
```

**After:**
```typescript
// First try active plan
let plan = await prisma.trainingPlan.findFirst({
  where: { athleteId: athlete.id, status: 'active' },
  ...
});

// If no active plan, try draft plan
if (!plan) {
  plan = await prisma.trainingPlan.findFirst({
    where: { athleteId: athlete.id, status: 'draft' },
    ...
  });
}
```

**Architecture Compliance:** ✅ Matches MVP1 rule: "Continue loading 'whatever training plan exists' for the athlete"

---

### 3. `/api/race/search` ✅
**Status:** PASS - No changes needed

**Checks:**
- ✅ Uses `RaceRegistry` model (not deprecated `Race`)
- ✅ Case-insensitive search (`mode: 'insensitive'`)
- ✅ Graceful error handling for `P2021` (table not found)
- ✅ No direct FK references

**Notes:** Route correctly searches race registry with proper error handling.

---

### 4. `/api/race/create` ✅
**Status:** PASS - No changes needed

**Checks:**
- ✅ Uses `RaceRegistry` model
- ✅ Duplicate check uses `@@unique([name, date])` constraint
- ✅ Returns existing race if found (search-first pattern)
- ✅ Case-insensitive comparison
- ✅ No direct FK on `TrainingPlan`

**Notes:** Route correctly implements registry pattern with duplicate prevention.

---

### 5. `/api/training-plan/create` ✅
**Status:** PASS - No changes needed

**Checks:**
- ✅ Creates `TrainingPlan` with `status: "draft"`
- ✅ Sets `athleteId` from token
- ✅ If `raceRegistryId` provided:
  - ✅ Validates race exists
  - ✅ Creates `RaceTrainingPlan` junction entry (NOT direct FK)
- ✅ Does NOT write fields not allowed in draft step
- ✅ Returns `trainingPlanId` immediately (hydrate-id-first pattern)

**Architecture Compliance:** ✅ Correctly uses junction table, no direct `raceRegistryId` on `TrainingPlan`

---

### 6. `/api/training-plan/update` ✅
**Status:** FIXED

**Changes Made:**
- ✅ Added `trainingPlanStartDate` to `allowedFields`
- ✅ When `trainingPlanGoalTime` changes:
  - ✅ Gets race from `RaceTrainingPlan` junction table
  - ✅ Calculates `goalFiveKPace` using `calculateGoalFiveKPace()`
  - ✅ Updates both fields atomically
- ✅ Validates plan is in `draft` state
- ✅ No snapshot tables

**Before:**
```typescript
const allowedFields = [
  'trainingPlanGoalTime',
  'trainingPlanName',
  'trainingPlanTotalWeeks',
];
```

**After:**
```typescript
const allowedFields = [
  'trainingPlanGoalTime',
  'trainingPlanName',
  'trainingPlanStartDate',  // ✅ Added
  'trainingPlanTotalWeeks',
];

// ✅ Added goal pace calculation
if (updates.trainingPlanGoalTime) {
  const raceTrainingPlan = existingPlan.raceTrainingPlans[0];
  const race = raceTrainingPlan.raceRegistry;
  updateData.goalFiveKPace = calculateGoalFiveKPace(
    updates.trainingPlanGoalTime,
    race.distance
  );
}
```

**Architecture Compliance:** ✅ Matches spec: "When trainingPlanGoalTime is set, compute goalFiveKPace from goal time + race distance"

---

### 7. `/api/training-plan/generate` ✅
**Status:** FIXED

**Changes Made:**
- ✅ Added validation for `trainingPlanStartDate` (required field)
- ✅ Validates `raceTrainingPlans` exists (race must be attached)
- ✅ Recomputes `goalFiveKPace` if missing (from goal time + race distance)
- ✅ Creates `AthleteTrainingPlan` junction entry (MVP1: only created when plan is generated)
- ✅ All operations in Prisma transaction
- ✅ No snapshot tables

**Before:**
```typescript
if (!existingPlan.trainingPlanGoalTime) {
  return NextResponse.json(...);
}
// Missing: trainingPlanStartDate validation
```

**After:**
```typescript
// ✅ Validate required fields
if (!existingPlan.trainingPlanGoalTime) {
  return NextResponse.json(...);
}

if (!existingPlan.trainingPlanStartDate) {
  return NextResponse.json(
    { success: false, error: 'Start date must be set before generating plan' },
    { status: 400 }
  );
}

// ✅ Validate race attached via junction table
const raceTrainingPlan = existingPlan.raceTrainingPlans[0];
if (!raceTrainingPlan) {
  return NextResponse.json(...);
}

// ✅ Recompute goalFiveKPace if missing
let goalFiveKPace = existingPlan.goalFiveKPace;
if (!goalFiveKPace) {
  goalFiveKPace = calculateGoalFiveKPace(goalTime, race.distance);
}
```

**Architecture Compliance:** ✅ Matches spec: "Validate trainingPlanGoalTime, trainingPlanStartDate, raceTrainingPlans exists"

---

### 8. `/api/training-plan/[id]` ✅
**Status:** PASS - No changes needed

**Checks:**
- ✅ Joins race through `raceTrainingPlans` junction table:
  ```typescript
  include: {
    raceTrainingPlans: {
      include: {
        raceRegistry: true,
      },
    },
  }
  ```
- ✅ Returns `goalFiveKPace` field
- ✅ No deprecated fields

**Architecture Compliance:** ✅ Correctly uses junction table for race relationship

---

### 9. `/api/training/hub` ✅
**Status:** FIXED

**Changes Made:**
- ✅ Orders `AthleteTrainingPlan` by `assignedAt: 'desc'` (MVP1)
- ✅ Falls back to latest active OR draft plan (MVP1 behavior)
- ✅ Includes race via junction table correctly
- ✅ Computes `currentWeek` from `startDate`
- ✅ Finds today's `TrainingDayPlanned`
- ✅ Matches executed days via `athleteId + date` (no direct FK)

**Before:**
```typescript
const activeAssignment = await prisma.athleteTrainingPlan.findFirst({
  where: { athleteId },
  // Missing: orderBy
});

let activePlan = activeAssignment?.trainingPlan || undefined;
if (!activePlan) {
  // Only checked active status
  activePlan = await prisma.trainingPlan.findFirst({
    where: { athleteId, status: 'active' },
    ...
  });
}
```

**After:**
```typescript
// ✅ Order by assignedAt desc (MVP1)
const activeAssignment = await prisma.athleteTrainingPlan.findFirst({
  where: { athleteId },
  orderBy: { assignedAt: 'desc' },
  ...
});

// ✅ Fallback: Try active first, then draft (MVP1)
let activePlan = activeAssignment?.trainingPlan || undefined;
if (!activePlan) {
  let foundPlan = await prisma.trainingPlan.findFirst({
    where: { athleteId, status: 'active' },
    ...
  });
  
  // ✅ Also check draft plans (MVP1)
  if (!foundPlan) {
    foundPlan = await prisma.trainingPlan.findFirst({
      where: { athleteId, status: 'draft' },
      ...
    });
  }
  activePlan = foundPlan || undefined;
}
```

**Architecture Compliance:** ✅ Matches MVP1 rule: "First try AthleteTrainingPlan ordered by assignedAt desc, then fallback to latest active or draft plan"

---

### 10. `/api/training-plan/draft` ✅
**Status:** PASS - No changes needed

**Checks:**
- ✅ Uses `AthleteTrainingPlan` junction table
- ✅ Orders by `assignedAt: 'desc'`
- ✅ Falls back to direct `TrainingPlan` lookup (legacy support)
- ✅ Includes race via `raceTrainingPlans` junction table
- ✅ Checks what's "bolted on" (hasRace, hasGoalTime)
- ✅ No boolean flags (`isActive`, `isPrimary`)

**Architecture Compliance:** ✅ Correctly implements state-aware checklist logic

---

## Deprecated Fields Check

### ✅ No References Found To:
- `raceId` (deprecated, replaced by `raceRegistryId` in junction table)
- `raceRegistryId` on `TrainingPlan` (moved to `RaceTrainingPlan` junction table)
- `canonicalFiveKPace` (not in schema)
- `isActive` boolean flags (removed from `AthleteTrainingPlan`)
- `isPrimary` boolean flags (removed from `AthleteTrainingPlan`)
- `TrainingPlanFiveKPace` snapshot table (removed)
- `TrainingPlanPreferredDays` snapshot table (removed)

### ✅ Correct Usage:
- `RaceTrainingPlan` junction table for race-plan relationships
- `AthleteTrainingPlan` junction table for athlete-plan assignments
- `goalFiveKPace` field directly on `TrainingPlan` (not snapshot)
- `RaceRegistry` model (not deprecated `Race`)

---

## Junction Table Usage

### ✅ `RaceTrainingPlan` Junction Table
**Used In:**
- `/api/training-plan/create` - Creates junction entry when race attached
- `/api/training-plan/update` - Reads race from junction table for goal pace calculation
- `/api/training-plan/generate` - Validates race attached via junction table
- `/api/training-plan/[id]` - Includes race via junction table
- `/api/training/hub` - Includes race via junction table
- `/api/training-plan/draft` - Includes race via junction table

**Pattern:**
```typescript
include: {
  raceTrainingPlans: {
    include: {
      raceRegistry: true,
    },
  },
}
```

### ✅ `AthleteTrainingPlan` Junction Table
**Used In:**
- `/api/training-plan/generate` - Creates entry when plan is generated (MVP1)
- `/api/training/hub` - Finds most recent assigned plan (ordered by `assignedAt`)
- `/api/training-plan/draft` - Finds most recent assigned plan

**MVP1 Behavior:**
- Only created when plan is generated (not used to determine active plan yet)
- Future: Will be used for "My Training Plans" selection screen

---

## Goal Pace Calculation

### ✅ Implementation
**Function:** `calculateGoalFiveKPace(goalTime: string, raceDistance: string): string`

**Location:** `lib/training/goal-pace.ts`

**Used In:**
- `/api/training-plan/update` - When `trainingPlanGoalTime` is updated
- `/api/training-plan/generate` - If `goalFiveKPace` not already set

**Business Rules:**
- Converts goal time to total seconds
- Gets race distance in miles (marathon=26.2, half=13.1, 10k=6.21371, 5k=3.10686)
- Computes pace per mile: `pacePerMileSec = raceGoalSeconds / raceMiles`
- Converts to 5K target pace: `goalFiveKSec = pacePerMileSec * 3.10686`
- Formats as mm:ss string

**Architecture Compliance:** ✅ Matches spec exactly

---

## MVP1 Behavior Compliance

### ✅ Active Plan Lookup
**Architecture Rule:** "Continue loading 'whatever training plan exists' for the athlete"

**Implementation:**
1. Try `AthleteTrainingPlan` junction table (ordered by `assignedAt: 'desc'`)
2. Fallback to latest `TrainingPlan` with `status: 'active'`
3. Fallback to latest `TrainingPlan` with `status: 'draft'` (MVP1)

**Routes Updated:**
- ✅ `/api/athlete/hydrate` - Loads active OR draft
- ✅ `/api/training/hub` - Falls back to draft if no active

### ✅ Junction Table Creation
**Architecture Rule:** "MVP1: Only created when plan is generated"

**Implementation:**
- ✅ `/api/training-plan/generate` - Creates `AthleteTrainingPlan` entry with `assignedAt: now()`
- ✅ `/api/training-plan/create` - Does NOT create `AthleteTrainingPlan` entry (only creates plan)

---

## Validation Summary

### ✅ All Routes Pass:
- No deprecated field references
- Correct junction table usage
- MVP1 behavior compliance
- Proper error handling
- TypeScript compilation successful

### ✅ Build Status:
```
✓ Compiled successfully
✓ All routes validated
✓ No TypeScript errors
```

---

## Future Enhancements

### Not Implemented (Future Work):
1. **"My Training Plans" Selection Screen**
   - Will use `AthleteTrainingPlan` junction table to show all assigned plans
   - Will allow user to select which plan is "active"
   - Currently: MVP1 continues loading "whatever plan exists"

2. **Plan Selection Logic**
   - Future: Use `AthleteTrainingPlan` to determine active plan
   - Future: Add UI for switching between multiple plans
   - Currently: MVP1 uses simple fallback pattern

3. **Preferred Days Selection**
   - Placeholder route exists: `/training-setup/[trainingPlanId]/preferred-days`
   - Future: Will save `trainingPlanPreferredDays` (not yet implemented)

---

## Conclusion

✅ **All API routes are now aligned with the final architecture specification.**

**Key Achievements:**
- Removed all deprecated fields and snapshot tables
- Implemented correct junction table patterns
- Added MVP1-compliant fallback logic
- Validated all required fields in generate route
- Implemented goal pace calculation correctly

**Next Steps:**
- Continue building frontend UI using these validated routes
- Future: Implement "My Training Plans" selection screen
- Future: Add preferred days selection flow

---

**Report Generated:** 2025-01-XX  
**Architecture Reference:** `TRAINING_ARCHITECTURE.md`

