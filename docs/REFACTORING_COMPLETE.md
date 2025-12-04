# Training Engine Refactoring - COMPLETE ✅

## All Steps Completed

### ✅ STEP 1: Canonical → Plan Snapshot Junction Tables
- Added `canonicalFiveKPace` and `preferredRunDays` to Athlete
- Created `TrainingPlanFiveKPace` junction table
- Created `TrainingPlanPreferredDays` junction table

### ✅ STEP 2: Race Registry Table
- Created `RaceRegistry` model
- Updated `TrainingPlan` to use `raceRegistryId` instead of `raceId`
- Marked old `Race` model as deprecated

### ✅ STEP 3: TrainingDayPlanned Cleanup
- Removed `dayName` field
- Changed `dayIndex` to 1-7 (was 0-6)
- Date is computed by backend, not from AI

### ✅ STEP 4: AI Prompt Refactoring
- Removed all date computation from prompt
- Updated to use dayIndex 1-7
- Removed `date` field from `WeekDay` interface
- Simplified `TrainingInputs` interface

### ✅ STEP 5: Save Pipeline Updates
- Updated `saveTrainingPlanToDB()` to use transactions
- Creates snapshot tables
- Computes dates using `calculateTrainingDayDate()`
- Uses `raceRegistryId` and `planStartDate` parameters

### ✅ STEP 6: Old Code Removal
- Removed `trainingPlanBaseline5k`, `trainingPlanBaselineWeeklyMileage`, `trainingPlanAdaptive5kTime`
- Renamed `updateAdaptive5KTime()` → `updateCanonicalFiveKPace()`
- Updated all references to use new structure

### ✅ STEP 7: Frontend Requirements Documented
- Created comprehensive documentation in `REFACTORING_SUMMARY.md`

---

## Next Actions Required

### 1. Run Prisma Migration
```bash
cd /Users/adamcole/Documents/GoFast/trainingmvp
npx prisma migrate dev --name refactor_training_engine
```

**Note:** If you get Prisma 7 CLI errors, ensure you're using Prisma 6 CLI:
```bash
npm install prisma@^6.16.3 --save-dev
```

### 2. Generate Prisma Client
```bash
npx prisma generate
```

### 3. Update TypeScript Types
TypeScript will automatically pick up new types after `prisma generate`

### 4. Create Migration Script (Optional)
If you have existing data, create a migration script to:
- Copy `myCurrentPace` → `canonicalFiveKPace`
- Create `RaceRegistry` entries from `Race` records
- Update `TrainingPlan.raceId` → `raceRegistryId`
- Create snapshot records for existing plans

---

## Key Changes Summary

### Schema Changes:
- ✅ `Athlete.canonicalFiveKPace` (new)
- ✅ `Athlete.preferredRunDays` (new)
- ✅ `RaceRegistry` (new table)
- ✅ `TrainingPlanFiveKPace` (new junction)
- ✅ `TrainingPlanPreferredDays` (new junction)
- ✅ `TrainingPlan.raceRegistryId` (replaces raceId)
- ✅ `TrainingDayPlanned.dayIndex` (now 1-7, was 0-6)
- ✅ Removed: `trainingPlanBaseline5k`, `trainingPlanBaselineWeeklyMileage`, `trainingPlanAdaptive5kTime`

### Code Changes:
- ✅ `plan-generator.ts` - Refactored prompt, removed dates, updated interfaces
- ✅ `saveTrainingPlanToDB()` - New signature, uses snapshots, computes dates
- ✅ `dates.ts` - Added `calculateTrainingDayDate()`, updated `getDayName()`
- ✅ `analysis.ts` - Renamed function, uses canonical
- ✅ API routes updated to use `raceRegistry`

### Breaking Changes:
- ⚠️ `dayIndex` now 1-7 (was 0-6)
- ⚠️ `saveTrainingPlanToDB()` signature changed
- ⚠️ `TrainingPlan.raceId` → `raceRegistryId`
- ⚠️ Plan generation requires `planStartDate` parameter

---

## Files Modified

1. `prisma/schema.prisma` - Complete refactor
2. `lib/services/plan-generator.ts` - AI prompt and save function
3. `lib/services/analysis.ts` - Function rename
4. `lib/utils/dates.ts` - Date calculation utility
5. `app/api/training/hub/route.ts` - Race registry reference
6. `app/api/training/match/[dayId]/route.ts` - Function name update
7. `app/training/page.tsx` - Display update
8. `lib/services/extraction.ts` - Day index update (1-7)

---

## Ready for Migration

All code changes are complete. Run the Prisma migration to apply schema changes to the database.

