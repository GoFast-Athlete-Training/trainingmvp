# Training Engine Refactoring Summary

## Overview
Refactored GoFast Training Engine to match true architecture with canonical identity, plan snapshots, race registry, and AI-first plan generation.

---

## ✅ STEP 1: Canonical → Plan Snapshot Junction Tables

### Changes Made:
1. **Added to Athlete model:**
   - `canonicalFiveKPace String?` - Canonical 5K pace (mm:ss)
   - `preferredRunDays Int[]?` - Preferred run days (1-7, where 1=Monday, 7=Sunday)

2. **Created junction tables:**
   - `TrainingPlanFiveKPace` - Snapshot of 5K pace at plan creation
   - `TrainingPlanPreferredDays` - Snapshot of preferred days at plan creation

**Why:** Prevents identity drift. Plan-specific data is frozen at creation time.

---

## ✅ STEP 2: Race Registry Table

### Changes Made:
1. **Created `RaceRegistry` model:**
   - Stores user-created and global races
   - Fields: name, distance, date, city, state, country, createdBy, isGlobal

2. **Updated `TrainingPlan`:**
   - Changed `raceId` → `raceRegistryId`
   - Removed direct `Race` relation
   - Now references `RaceRegistry`

**Why:** Race becomes a global catalogue, not tied to individual plans.

---

## ✅ STEP 3: TrainingDayPlanned Cleanup

### Changes Made:
1. **Removed `dayName` field** - Computed from dayIndex
2. **Changed dayIndex constraint:** Now 1-7 (1=Monday, 7=Sunday) instead of 0-6
3. **Date is computed** - Not from AI, calculated by backend

**Why:** Simplifies model, ensures consistency, removes AI date errors.

---

## ✅ STEP 4: AI Prompt Refactoring

### Changes Made:
1. **Removed date computation from prompt:**
   - AI no longer generates calendar dates
   - AI only returns dayIndex (1-7) and plannedData

2. **Updated prompt instructions:**
   - "DO NOT generate calendar dates"
   - "dayIndex MUST be 1-7 (1=Monday, 7=Sunday)"
   - Removed date examples from JSON structure

3. **Updated interfaces:**
   - `WeekDay` no longer has `date` field
   - `TrainingInputs` simplified (removed raceDate, weeklyMileage)
   - `GeneratedPlan` removed `phaseOverview` and `weeklyMileagePlan`

**Why:** Dates computed by backend ensure consistency. AI focuses on workout structure only.

---

## ✅ STEP 5: Save Pipeline Updates

### Changes Made:
1. **Updated `saveTrainingPlanToDB()`:**
   - Now uses `raceRegistryId` instead of `raceId`
   - Takes `planStartDate` as parameter (not computed)
   - Creates `TrainingPlanFiveKPace` snapshot
   - Creates `TrainingPlanPreferredDays` snapshot (if provided)
   - Computes dates using `calculateTrainingDayDate()` utility
   - Uses `prisma.$transaction()` for atomicity

2. **Added date utility:**
   - `calculateTrainingDayDate(planStartDate, weekIndex, dayIndex)`
   - Formula: `(weekIndex * 7) + (dayIndex - 1)` days from start

**Why:** Ensures data consistency, prevents date errors, maintains referential integrity.

---

## ✅ STEP 6: Old Code Removal

### Removed/Updated:
1. **TrainingPlan fields removed:**
   - `trainingPlanBaseline5k` → Now in snapshot table
   - `trainingPlanBaselineWeeklyMileage` → Not needed
   - `trainingPlanAdaptive5kTime` → Use canonical instead
   - `trainingPlanGoalPace` → Can calculate from goal time

2. **Function renamed:**
   - `updateAdaptive5KTime()` → `updateCanonicalFiveKPace()`
   - Updates canonical identity, not plan-specific data

3. **Updated references:**
   - `app/api/training/hub/route.ts` - Uses `raceRegistry` instead of `race`
   - `app/api/training/match/[dayId]/route.ts` - Uses new function name
   - `app/training/page.tsx` - Updated race readiness display

4. **Legacy fields kept:**
   - `Athlete.myCurrentPace` - Kept for migration compatibility
   - `Race` model - Kept but deprecated (marked in comments)

**Why:** Clean architecture, remove confusion, maintain backward compatibility during migration.

---

## ⚠️ STEP 7: Frontend Requirements (Documentation)

### Required Frontend Changes:

#### 1. Canonical Identity Management
**Pages needed:**
- Settings/Profile page to update:
  - `canonicalFiveKPace` (5K pace input)
  - `preferredRunDays` (multi-select: Monday-Sunday, stored as 1-7)

**API routes needed:**
- `PUT /api/athlete/canonical` - Update canonical fields

#### 2. Race Registry Management
**Pages needed:**
- Race creation form:
  - Name, distance, date, location (city, state, country)
  - Option to make global (if user has permissions)
  - Returns `raceRegistryId`

**API routes needed:**
- `POST /api/race-registry` - Create race entry
- `GET /api/race-registry` - List races (user's + global)
- `GET /api/race-registry/:id` - Get race details

#### 3. Plan Generation Flow
**Updated flow:**
1. User selects `raceRegistryId` (from registry)
2. System gets canonical data:
   - `athlete.canonicalFiveKPace`
   - `athlete.preferredRunDays`
3. Calculate `totalWeeks` from race date and start date
4. Call `generateTrainingPlanAI()` with:
   ```typescript
   {
     raceName: raceRegistry.name,
     raceDistance: raceRegistry.distance,
     goalTime: userInput,
     canonicalFiveKPace: athlete.canonicalFiveKPace,
     preferredRunDays: athlete.preferredRunDays,
     totalWeeks: calculated
   }
   ```
5. Call `saveTrainingPlanToDB()` with:
   - `athleteId`
   - `raceRegistryId`
   - `planStartDate` (user-selected or today)
   - `plan` (from AI)
   - `inputs`

#### 4. Training Viewer Updates
**Week view:**
- Filter: `trainingPlanId + weekIndex`
- Display: All 7 days (dayIndex 1-7)
- Use `getDayName(dayIndex)` for day names

**Day view:**
- Display `plannedData` JSON directly
- No date computation needed (already stored)

---

## Database Migration Required

### New Tables:
- `race_registry`
- `training_plan_five_k_pace`
- `training_plan_preferred_days`

### Modified Tables:
- `athletes` - Added `canonicalFiveKPace`, `preferredRunDays`
- `training_plans` - Changed `raceId` → `raceRegistryId`, removed old fields
- `training_days_planned` - Removed `dayName`, dayIndex now 1-7

### Migration Steps:
1. Run `prisma migrate dev --name refactor_training_engine`
2. Migrate existing data:
   - Copy `myCurrentPace` → `canonicalFiveKPace` for existing athletes
   - Create `RaceRegistry` entries from existing `Race` records
   - Update `TrainingPlan.raceId` → `raceRegistryId`
   - Create snapshot records for existing plans

---

## Breaking Changes

### API Changes:
- `saveTrainingPlanToDB()` signature changed:
  - Old: `(athleteId, raceId, plan, inputs)`
  - New: `(athleteId, raceRegistryId, planStartDate, plan, inputs)`

### Data Model Changes:
- `dayIndex` now 1-7 (was 0-6)
- `TrainingPlan.raceId` → `raceRegistryId`
- Removed fields from `TrainingPlan`

### Frontend Impact:
- Any code using `dayIndex` 0-6 must be updated
- Race selection must use `RaceRegistry` instead of `Race`
- Plan generation must pass `planStartDate` explicitly

---

## Next Steps

1. **Run Prisma migration**
2. **Create API routes:**
   - Race registry CRUD
   - Canonical identity update
   - Plan generation endpoint
3. **Update frontend:**
   - Race selection UI
   - Canonical settings page
   - Plan generation flow
4. **Test:**
   - Create race registry entry
   - Generate plan with new structure
   - Verify dates computed correctly
   - Verify snapshots created

---

## Files Modified

### Schema:
- `prisma/schema.prisma` - Complete refactor

### Services:
- `lib/services/plan-generator.ts` - Updated prompt, interfaces, save function
- `lib/services/analysis.ts` - Renamed function, uses canonical

### Utils:
- `lib/utils/dates.ts` - Added `calculateTrainingDayDate()`, updated `getDayName()`

### API Routes:
- `app/api/training/hub/route.ts` - Updated to use raceRegistry
- `app/api/training/match/[dayId]/route.ts` - Updated function name

### Frontend:
- `app/training/page.tsx` - Updated race readiness display

---

**Status:** ✅ Core refactoring complete. Ready for migration and frontend updates.

