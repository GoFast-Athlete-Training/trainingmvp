# Architecture Compliance Report

**Generated**: January 2025  
**Source**: `docs/SCHEMA_FIRST_ARCHITECTURE.md`  
**Status**: ARCHITECTURE LOADED ✅

---

## ARCHITECTURE LOADED ✅

The canonical architecture document (`docs/SCHEMA_FIRST_ARCHITECTURE.md`) has been parsed and ingested as the **definitive specification** for the GoFast Training System.

---

## Major Functional Domains Detected

### 1. **Athlete Identity & Profile Management**
- Firebase authentication integration
- Profile management (fiveKPace as source of truth)
- Single-tenant company isolation
- Garmin OAuth token management

### 2. **Race Registry & Selection**
- Global race catalog (RaceRegistry)
- Race search and creation
- One race → many training plans relationship

### 3. **Training Plan Generation (AI-Powered)**
- OpenAI-based plan generation
- Complete plan creation (all weeks/days in one call)
- Snapshot pattern for identity preservation (TrainingPlanFiveKPace)
- Date computation from weekIndex/dayIndex

### 4. **Training Plan Execution**
- Planned workouts (TrainingDayPlanned)
- Executed workouts (TrainingDayExecuted)
- Application-level linking (by date/weekIndex/dayIndex, not FK)
- Manual and Garmin-matched execution paths

### 5. **Activity Matching (Garmin Integration)**
- Garmin activity sync via webhook
- Auto-match algorithm (date/time proximity)
- Manual match flow (user selects activity → planned day)
- Unmatched activity tracking

### 6. **Analysis & Scoring**
- GoFastScore computation (pace, HR, mileage variance)
- Adaptive 5K pace updates based on performance
- Analysis stored in TrainingDayExecuted.analysis (JSON)

### 7. **Garmin Integration Infrastructure**
- PKCE OAuth 2.0 flow
- Webhook processing for activity data
- Token refresh and connection management

---

## Gaps Between Repo Code and Architecture

### Critical Missing APIs

#### 1. Manual Workout Completion API
- **Missing**: `POST /api/training/day/[dayId]/complete`
- **Architecture Spec**: Line 840-843
- **Purpose**: Create `TrainingDayExecuted` for manual entry (no Garmin activity)
- **Current State**: Only activity matching creates executed days
- **Impact**: Users cannot manually mark workouts complete

#### 2. Unmatched Activities API
- **Missing**: `GET /api/training/activities/unmatched`
- **Architecture Spec**: Line 845-848
- **Purpose**: List all `AthleteActivity` records not linked to `TrainingDayExecuted`
- **Current State**: No endpoint to view unmatched activities
- **Impact**: Users cannot see unmatched Garmin activities

#### 3. Weekly Aggregation API
- **Missing**: `GET /api/training/week/[weekIndex]/summary`
- **Architecture Spec**: Line 850-853
- **Purpose**: Aggregate weekly execution data (mileage, workouts completed, pace trends)
- **Current State**: No weekly summary endpoint
- **Impact**: Cannot display weekly progress summaries

#### 4. Plan Status Management API
- **Missing**: `PUT /api/training-plan/[id]/status`
- **Architecture Spec**: Line 865-868
- **Purpose**: Update plan status (`draft` → `active` → `completed`)
- **Current State**: Status only set during generation, no updates
- **Impact**: Cannot mark plans as completed or reactivate drafts

### Incomplete Implementations

#### 5. Race Readiness Calculation
- **Status**: Placeholder exists
- **Location**: `app/api/training/hub/route.ts` (lines 94-116)
- **Architecture Spec**: Line 855-858
- **Issue**: Uses placeholder goal pace calculation
- **Needed**: Proper algorithm from `trainingPlanGoalTime` + race distance
- **Impact**: Race readiness status may be inaccurate

#### 6. Auto-Match on Webhook
- **Status**: Logic exists but not triggered
- **Location**: `lib/services/match-logic.ts` → `autoMatchActivityToDay()`
- **Architecture Spec**: Line 747-752 (Activity Matching Flow)
- **Issue**: Function exists but not called in webhook handler
- **Needed**: Call `autoMatchActivityToDay()` in `POST /api/garmin/webhook`
- **Impact**: Activities not auto-matched on sync

### Unused Schema Elements

#### 7. TrainingPlanPreferredDays
- **Status**: Schema exists, unused (documented)
- **Architecture Spec**: Line 488-496
- **Action**: Keep for future feature, document as reserved
- **Impact**: None (intentionally unused in MVP1)

---

## Existing Implementation Status

### ✅ Fully Implemented

1. **Athlete Routes** - All 4 routes exist and match spec
2. **Race Routes** - Both search and create implemented
3. **Training Plan Generation** - Complete with snapshot creation
4. **Training Plan Viewing** - All routes exist (plan, week, day)
5. **Activity Matching** - Manual match flow complete
6. **Analysis & Scoring** - GoFastScore computation implemented
7. **Garmin OAuth** - PKCE flow complete
8. **Garmin Webhook** - Receives and stores activities

### ⚠️ Partially Implemented

1. **Training Execution** - Activity matching works, manual completion missing
2. **Race Readiness** - Placeholder exists, needs proper algorithm
3. **Auto-Match** - Function exists, not triggered on webhook

---

## Recommended Next Steps

### Priority 1: Critical Missing Features

1. **Implement Manual Workout Completion**
   - Create `POST /api/training/day/[dayId]/complete`
   - Accept optional manual data (distance, duration, pace)
   - Create `TrainingDayExecuted` with `activityId = null`
   - Trigger analysis and scoring

2. **Implement Unmatched Activities API**
   - Create `GET /api/training/activities/unmatched`
   - Query `AthleteActivity` where `id` not in `TrainingDayExecuted.activityId`
   - Return list for user to manually match

3. **Complete Race Readiness Algorithm**
   - Calculate goal pace from `trainingPlanGoalTime` + race distance
   - Use `lib/utils/pace.ts` → `calculateGoalPace()`
   - Replace placeholder in `/api/training/hub`

### Priority 2: Enhancements

4. **Add Auto-Match on Webhook**
   - In `POST /api/garmin/webhook`, after creating `AthleteActivity`
   - Call `autoMatchActivityToDay(athleteId, activityId)`
   - If match found, create `TrainingDayExecuted` automatically

5. **Implement Weekly Aggregation**
   - Create `GET /api/training/week/[weekIndex]/summary`
   - Aggregate `TrainingDayExecuted` for week
   - Calculate: total mileage, workouts completed, average pace, GoFastScore trends

6. **Add Plan Status Management**
   - Create `PUT /api/training-plan/[id]/status`
   - Validate status transitions (`draft` → `active` → `completed`)
   - Update `TrainingPlan.status` field

### Priority 3: Documentation & Cleanup

7. **Document TrainingPlanPreferredDays**
   - Add comment in schema: "Reserved for future feature"
   - Document in architecture as intentionally unused

8. **Create Architecture Reference Marker**
   - Add comment in README pointing to `docs/SCHEMA_FIRST_ARCHITECTURE.md`
   - Mark as "CANONICAL SOURCE OF TRUTH"

---

## File Structure Compliance

### Expected Structure (from Architecture)

```
lib/
  training/
    plan-generator.ts ✅
    save-plan.ts ✅
    dates.ts ✅
  services/
    analysis.ts ✅
    match-logic.ts ✅
  athlete/
    profile.ts ✅
  domain-athlete.ts ✅
  domain-garmin.ts ✅

app/api/
  athlete/ ✅
  race/ ✅
  training-plan/ ✅
  training/ ✅
  garmin/ ✅
  auth/garmin/ ✅
```

### Missing Domain Folders (Future)

The architecture suggests domain separation (mentioned in `GOFAST_TRAINING_ARCHITECTURE.md`):
- `lib/training-execution/` - Not yet needed (handled in services)
- `lib/activity-matching/` - Not yet needed (handled in services)
- `lib/training-review/` - Not yet needed (future feature)

**Status**: Current structure is acceptable for MVP1. Domain separation can be refactored later.

---

## Validation Checklist

### Schema Compliance ✅
- [x] All 10 models match Prisma schema
- [x] Relationships correctly defined
- [x] Constraints match (unique, foreign keys)
- [x] Field types match specification

### API Route Compliance ⚠️
- [x] All documented routes exist
- [ ] Missing: Manual completion endpoint
- [ ] Missing: Unmatched activities endpoint
- [ ] Missing: Weekly summary endpoint
- [ ] Missing: Plan status update endpoint

### Business Logic Compliance ⚠️
- [x] Plan generation matches spec
- [x] Date calculation matches formula
- [x] Snapshot creation matches pattern
- [x] Activity matching logic exists
- [ ] Auto-match not triggered on webhook
- [ ] Race readiness incomplete

### Data Flow Compliance ⚠️
- [x] Plan creation flow matches spec
- [x] Activity matching flow exists
- [ ] Manual execution flow incomplete
- [ ] Auto-match flow incomplete

---

## Architecture Reference Protocol

**From this point forward:**

1. **Before writing code**: Reference `docs/SCHEMA_FIRST_ARCHITECTURE.md`
2. **If code contradicts architecture**: Architecture wins
3. **When adding features**: Validate against architecture first
4. **When refactoring**: Ensure alignment with architecture patterns

**Master Reference**: `docs/SCHEMA_FIRST_ARCHITECTURE.md` (903 lines)

---

**End of Architecture Compliance Report**

