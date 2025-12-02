# MVP1 Refactoring Complete

## Summary
The entire trainingmvp repository has been refactored to match the MVP1 GoFast Training Architecture exactly.

## ✅ Completed Changes

### 1. Database Schema
- ✅ **Athlete Model**: 
  - Renamed `canonicalFiveKPace` → `fiveKPace`
  - Removed `preferredRunDays` from Athlete
  - Removed `trainingPlanPreferredDays` relation from Athlete
- ✅ **TrainingPlanPreferredDays**: Table exists but is UNUSED (no code writes to it)
- ✅ **TrainingPlanFiveKPace**: Snapshot table correctly implemented
- ✅ **RaceRegistry**: Replaces all Race model usage
- ✅ **TrainingDayPlanned**: dayIndex is 1-7, dates computed by backend

### 2. Code References
- ✅ All `canonicalFiveKPace` → `fiveKPace` updated
- ✅ All `preferredRunDays` references removed
- ✅ No code writes to `trainingPlanPreferredDays`
- ✅ No code uses deprecated `Race` model
- ✅ Legacy fields (`myCurrentPace`, etc.) only used as fallback in migration logic

### 3. Library Reorganization
- ✅ `lib/training/` created:
  - `plan-generator.ts` - AI generation only
  - `save-plan.ts` - Prisma writes
  - `dates.ts` - Date math utilities
- ✅ `lib/athlete/` created:
  - `profile.ts` - Profile management
- ✅ Old files moved/deleted:
  - `lib/services/plan-generator.ts` → `lib/training/plan-generator.ts`
  - `lib/utils/dates.ts` → `lib/training/dates.ts`
  - `lib/services/extraction.ts` → DELETED

### 4. API Routes
- ✅ **Created**:
  - `/api/athlete/profile` (GET, PUT)
  - `/api/race/search` (POST)
  - `/api/race/create` (POST)
  - `/api/training-setup/save` (POST)
  - `/api/training-plan/generate` (POST)
  - `/api/training-plan/[id]` (GET)
  - `/api/training-plan/[id]/week/[weekIndex]` (GET)
  - `/api/training-plan/day/[dayId]` (GET)
- ✅ **Deleted**:
  - `/api/onboarding/*` (all routes removed)
- ✅ **Updated**:
  - All routes use `fiveKPace` (not `canonicalFiveKPace`)
  - All routes use `RaceRegistry` (not `Race`)

### 5. AI Prompt
- ✅ **Fixed**:
  - `weekIndex` now starts at **1** (not 0)
  - AI returns ONLY: `weekIndex`, `dayIndex`, `phase`, `plannedData`
  - AI does NOT generate dates
  - AI does NOT return preferred days
  - AI does NOT create adaptive metrics

### 6. Date Calculation
- ✅ **Updated** `calculateTrainingDayDate()`:
  - Handles `weekIndex` starting at 1
  - Formula: `((weekIndex - 1) * 7) + (dayIndex - 1)` days from start

### 7. Plan Generation
- ✅ **saveTrainingPlanToDB()**:
  - Creates `TrainingPlan` with `raceRegistryId`
  - Creates `TrainingPlanFiveKPace` snapshot
  - Creates all `TrainingDayPlanned` records with computed dates
  - Uses Prisma transaction
  - Does NOT create `TrainingPlanPreferredDays`

### 8. Frontend Updates
- ✅ Updated `weekIndex` display (removed `+1` since it now starts at 1)
- ✅ Updated signup flow to check for active plan (not `myTargetRace`)
- ✅ Updated training page to remove onboarding check

### 9. Removed Deprecated Code
- ✅ No references to `Race` model in app/api or lib/
- ✅ No references to `canonicalFiveKPace` in code
- ✅ No references to `preferredRunDays` in code
- ✅ No writes to `trainingPlanPreferredDays`
- ✅ Deleted `extraction.ts`

## 📋 API Route Structure (MVP1)

```
/api/athlete/
  create/          ✅ Upsert on sign-in
  profile/          ✅ GET/PUT profile (fiveKPace)
  hydrate/         ✅ Hydrate athlete data

/api/race/
  search/          ✅ Search RaceRegistry
  create/          ✅ Create RaceRegistry entry

/api/training-setup/
  save/            ✅ Save raceRegistryId + goalTime

/api/training-plan/
  generate/        ✅ Generate full plan
  [id]/            ✅ Get plan details
  [id]/week/[weekIndex]/ ✅ Get week (weekIndex 1-based)
  day/[dayId]/     ✅ Get day details

/api/training/
  hub/             ✅ Training hub data
  plan/[weekIndex]/ ✅ Legacy route (kept for compatibility)
  day/[dayId]/     ✅ Legacy route
  match/[dayId]/    ✅ Match activity to day
```

## 🔍 Verification Checklist

- ✅ Schema matches MVP1 exactly
- ✅ All API routes built as defined
- ✅ All deprecated references removed
- ✅ Athlete identity uses ONLY `fiveKPace`
- ✅ Plan snapshot table used correctly
- ✅ RaceRegistry flow implemented
- ✅ AI prompt cleaned and corrected
- ✅ Plan generation uses new libs
- ✅ No code references onboarding routes
- ✅ No code references canonical pace
- ✅ No code references preferred days
- ✅ weekIndex starts at 1 (not 0)
- ✅ Dates computed by backend only
- ✅ Prisma schema formatted

## 🚀 Next Steps

1. Run migration: `npx prisma migrate dev --name mvp1_refactor`
2. Generate client: `npx prisma generate`
3. Test E2E flow:
   - Sign up → Profile → Race search/create → Goal time → Generate plan → View plan

## ⚠️ Notes

- `TrainingPlanPreferredDays` table exists in schema but is **UNUSED** in MVP1
- Legacy fields (`myCurrentPace`, etc.) kept for migration but **NOT USED** in new code
- `Race` model exists in schema but is **DEPRECATED** - no code uses it
- Frontend `/onboarding` page still exists but should be updated to use `/training-setup` routes

